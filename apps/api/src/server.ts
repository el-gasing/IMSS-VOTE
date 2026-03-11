import "dotenv/config";
import cors from "cors";
import crypto from "node:crypto";
import express from "express";
import { SignJWT } from "jose";
import { z } from "zod";
import { isAddress, getAddress, verifyMessage } from "viem";
import { env } from "./env.js";
import {
  addAdminUsername,
  initDb,
  insertActivityLog,
  listActivityLogs,
  listAdminUsernames,
  pool,
  removeAdminUsername
} from "./db.js";
import { decodeSession, requireAdmin, requireAuth, requireInternalKey } from "./auth.js";
import { castVoteByUserSubOnChain, whitelistOnChain } from "./chain.js";
import { buildCasLoginUrl, buildCasLogoutUrl, validateCasTicket } from "./cas.js";
import type { CasUser, RegistrationRecord, RegistrationStatus } from "./types.js";

const app = express();
const jwtSecret = new TextEncoder().encode(env.SESSION_JWT_SECRET);

app.set("trust proxy", true);
app.use(express.json());
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
    methods: ["GET", "POST", "DELETE", "OPTIONS"]
  })
);

app.use(async (req, res, next) => {
  if (req.path === "/health") {
    next();
    return;
  }

  if (req.method.toUpperCase() === "DELETE") {
    next();
    return;
  }

  if (req.path.startsWith("/admin")) {
    next();
    return;
  }

  let actorSub: string | null = null;
  let actorEmail: string | null = null;

  try {
    const user = await decodeSession(req);
    actorSub = user.sub;
    actorEmail = user.email;
  } catch {
    // Keep anonymous actor for unauthenticated requests.
  }

  const startedAt = Date.now();
  const ip = getRequestIp(req);
  const userAgent = req.header("user-agent") || null;
  const method = req.method.toUpperCase();
  const path = req.path;
  const action = `${method} ${path}`;

  res.on("finish", () => {
    void insertActivityLog({
      actorSub,
      actorEmail,
      action,
      method,
      path,
      statusCode: res.statusCode,
      ip,
      userAgent,
      detail: {
        duration_ms: Date.now() - startedAt
      }
    }).catch((error) => {
      console.error("activity_log_insert_failed", (error as Error).message);
    });
  });

  next();
});

const nonceBodySchema = z.object({ wallet: z.string() });
const bindBodySchema = z.object({
  wallet: z.string(),
  nonce: z.string().min(32),
  signature: z.string().min(10)
});
const adminUserBodySchema = z.object({
  username: z.string().min(3).max(100).regex(/^[a-zA-Z0-9._-]+$/)
});
const voteRecordBodySchema = z.object({
  ketumCandidateId: z.coerce.number().int().positive(),
  waketumCandidateId: z.coerce.number().int().positive(),
  txHashKetum: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  txHashWaketum: z.string().regex(/^0x[0-9a-fA-F]{64}$/)
});
const voteCastBodySchema = z.object({
  choice: z.enum(["paslon1", "kotak_kosong"])
});
const deleteLogParamsSchema = z.object({
  id: z.string().uuid()
});

type AdminVoteChoice = "paslon1" | "kotak_kosong" | "unknown";

function nowPlusMinutes(minutes: number): Date {
  return new Date(Date.now() + minutes * 60_000);
}

function toRegistration(row: Record<string, unknown>): RegistrationRecord {
  return {
    id: String(row.id),
    ui_subject_id: String(row.ui_subject_id),
    email_ui: String(row.email_ui),
    wallet: String(row.wallet),
    status: row.status as RegistrationStatus,
    approved_at: row.approved_at ? String(row.approved_at) : null,
    tx_hash_whitelist: row.tx_hash_whitelist ? String(row.tx_hash_whitelist) : null,
    nonce: row.nonce ? String(row.nonce) : null,
    nonce_expires_at: row.nonce_expires_at ? String(row.nonce_expires_at) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at)
  };
}

function buildBindMessage(uiSubjectId: string, nonce: string): string {
  return `IMSS Voting wallet binding\nsub:${uiSubjectId}\nnonce:${nonce}`;
}

function normalizeBaseUrl(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

function sanitizeRedirectPath(path: string | undefined): string {
  if (!path || !path.startsWith("/")) {
    return "/";
  }
  return path;
}

function normalizeForwardedHeader(value: string | undefined): string | null {
  if (!value) return null;
  const first = value.split(",")[0]?.trim();
  return first || null;
}

function getRequestIp(req: express.Request): string {
  const forwarded = normalizeForwardedHeader(req.header("x-forwarded-for"));
  if (forwarded) return forwarded;
  return req.ip || req.socket.remoteAddress || "unknown";
}

function normalizePublicBaseUrl(baseUrl: string, req: express.Request): string {
  const url = new URL(baseUrl);
  const forwardedProto = normalizeForwardedHeader(req.header("x-forwarded-proto"));
  const forwardedPort = normalizeForwardedHeader(req.header("x-forwarded-port"));
  const forwardedHost = normalizeForwardedHeader(req.header("x-forwarded-host"));
  const host = normalizeForwardedHeader(req.header("host"));
  const referer = normalizeForwardedHeader(req.header("referer"));

  if (forwardedProto) {
    url.protocol = `${forwardedProto}:`;
  } else if (forwardedPort === "443" || req.secure) {
    url.protocol = "https:";
  } else if (referer) {
    try {
      url.protocol = new URL(referer).protocol;
    } catch {
      // Ignore malformed referrer and keep configured protocol.
    }
  }
  if (forwardedHost || host) {
    url.host = (forwardedHost || host)!;
  }

  return normalizeBaseUrl(url.toString());
}

function buildCallbackUrl(req: express.Request, redirectPath: string): string {
  const apiBase = normalizePublicBaseUrl(env.API_PUBLIC_URL, req);
  return `${apiBase}/auth/cas/callback?redirect=${encodeURIComponent(redirectPath)}`;
}

function buildWebRedirectUrl(req: express.Request, redirectPath: string): string {
  const appBase = normalizePublicBaseUrl(env.APP_WEB_URL, req);
  return `${appBase}${redirectPath}`;
}

function buildPostLogoutReturnUrl(req: express.Request): string {
  const appBase = normalizePublicBaseUrl(env.APP_WEB_URL, req);
  return `${appBase}/auth/login`;
}

function clearSessionCookie(res: express.Response): void {
  res.clearCookie("imss_session", {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/"
  });
}

async function createSessionToken(user: CasUser): Promise<string> {
  return new SignJWT({ user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("imss-voting-api")
    .setAudience("imss-voting-web")
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(jwtSecret);
}

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/auth/cas/login", (req, res) => {
  const redirectPath = sanitizeRedirectPath(typeof req.query.redirect === "string" ? req.query.redirect : "/vote");
  const callbackUrl = buildCallbackUrl(req, redirectPath);
  const loginUrl = buildCasLoginUrl(callbackUrl);
  res.redirect(loginUrl);
});

app.get("/auth/cas/callback", async (req, res) => {
  const redirectPath = sanitizeRedirectPath(typeof req.query.redirect === "string" ? req.query.redirect : "/vote");
  const ticket = typeof req.query.ticket === "string" ? req.query.ticket : null;

  if (!ticket) {
    res.status(400).send("Missing CAS ticket");
    return;
  }

  const callbackUrl = buildCallbackUrl(req, redirectPath);

  try {
    const user = await validateCasTicket(ticket, callbackUrl);
    const token = await createSessionToken(user);

    res.cookie("imss_session", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: env.NODE_ENV === "production",
      path: "/"
    });

    res.redirect(buildWebRedirectUrl(req, redirectPath));
  } catch (error) {
    res.status(401).send(`CAS login failed: ${(error as Error).message}`);
  }
});

app.get("/auth/me", async (req, res) => {
  try {
    const user = await decodeSession(req);
    res.json({ authenticated: true, user });
  } catch (_error) {
    res.status(401).json({ authenticated: false });
  }
});

app.get("/auth/logout", (req, res) => {
  clearSessionCookie(res);
  const returnUrl = buildPostLogoutReturnUrl(req);
  const casLogoutUrl = buildCasLogoutUrl(returnUrl);
  res.redirect(casLogoutUrl);
});

app.post("/auth/logout", (req, res) => {
  clearSessionCookie(res);
  const returnUrl = buildPostLogoutReturnUrl(req);
  const casLogoutUrl = buildCasLogoutUrl(returnUrl);
  res.json({ ok: true, logoutUrl: casLogoutUrl });
});

app.get("/registration/me", requireAuth, async (req, res) => {
  const result = await pool.query(
    `SELECT * FROM registrations WHERE ui_subject_id = $1 LIMIT 1`,
    [req.user!.sub]
  );

  if (!result.rows.length) {
    res.json({ registration: null });
    return;
  }

  res.json({ registration: toRegistration(result.rows[0]) });
});

app.post("/registration/nonce", requireAuth, async (req, res) => {
  const parsed = nonceBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", detail: parsed.error.flatten() });
    return;
  }

  if (!isAddress(parsed.data.wallet)) {
    res.status(400).json({ error: "Invalid wallet address" });
    return;
  }

  const wallet = getAddress(parsed.data.wallet);
  const nonce = crypto.randomBytes(24).toString("hex");
  const expiresAt = nowPlusMinutes(10);
  const userSub = req.user!.sub;

  const existingVote = await pool.query(`SELECT 1 FROM votes WHERE ui_subject_id = $1 LIMIT 1`, [userSub]);
  if (existingVote.rows.length) {
    res.status(409).json({ error: "Anda sudah menggunakan hak pilih" });
    return;
  }

  const existingRegistration = await pool.query(`SELECT * FROM registrations WHERE ui_subject_id = $1 LIMIT 1`, [userSub]);
  if (existingRegistration.rows.length) {
    const reg = existingRegistration.rows[0];
    const currentWallet = String(reg.wallet || "");
    const isApproved = String(reg.status || "").toLowerCase() === "approved";
    const hasWhitelistTx = Boolean(reg.tx_hash_whitelist);
    if (isApproved && hasWhitelistTx && currentWallet && currentWallet.toLowerCase() !== wallet.toLowerCase()) {
      res.status(400).json({ error: "Wallet sudah terkunci setelah approval, tidak bisa diganti" });
      return;
    }
  }

  await pool.query(
    `
      INSERT INTO registrations (ui_subject_id, email_ui, wallet, status, nonce, nonce_expires_at)
      VALUES ($1, $2, $3, 'pending', $4, $5)
      ON CONFLICT (ui_subject_id)
      DO UPDATE SET wallet = EXCLUDED.wallet, nonce = EXCLUDED.nonce, nonce_expires_at = EXCLUDED.nonce_expires_at
    `,
    [userSub, req.user!.email, wallet, nonce, expiresAt]
  );

  const message = buildBindMessage(userSub, nonce);
  res.json({ nonce, message, expiresAt: expiresAt.toISOString() });
});

app.post("/registration/bind-wallet", requireAuth, async (req, res) => {
  const parsed = bindBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", detail: parsed.error.flatten() });
    return;
  }

  if (!isAddress(parsed.data.wallet)) {
    res.status(400).json({ error: "Invalid wallet address" });
    return;
  }

  const wallet = getAddress(parsed.data.wallet);
  const userSub = req.user!.sub;

  const existingVote = await pool.query(`SELECT 1 FROM votes WHERE ui_subject_id = $1 LIMIT 1`, [userSub]);
  if (existingVote.rows.length) {
    res.status(409).json({ error: "Anda sudah menggunakan hak pilih" });
    return;
  }

  const existing = await pool.query(`SELECT * FROM registrations WHERE ui_subject_id = $1 LIMIT 1`, [userSub]);
  if (!existing.rows.length) {
    res.status(404).json({ error: "Nonce not found, request nonce first" });
    return;
  }

  const row = existing.rows[0];
  if (!row.nonce || !row.nonce_expires_at) {
    res.status(400).json({ error: "Nonce not initialized" });
    return;
  }

  const expiresAt = new Date(String(row.nonce_expires_at));
  if (Date.now() > expiresAt.getTime()) {
    res.status(400).json({ error: "Nonce expired" });
    return;
  }

  if (String(row.wallet).toLowerCase() !== wallet.toLowerCase()) {
    res.status(400).json({ error: "Wallet mismatch with nonce request" });
    return;
  }

  if (String(row.nonce) !== parsed.data.nonce) {
    res.status(400).json({ error: "Invalid nonce" });
    return;
  }

  const message = buildBindMessage(req.user!.sub, parsed.data.nonce);
  const validSig = await verifyMessage({
    address: wallet,
    message,
    signature: parsed.data.signature as `0x${string}`
  });

  if (!validSig) {
    res.status(400).json({ error: "Invalid wallet signature" });
    return;
  }

  const status: RegistrationStatus = "approved";
  const approvedAt = new Date().toISOString();
  let txHashWhitelist: string | null = row.tx_hash_whitelist ? String(row.tx_hash_whitelist) : null;

  if (!txHashWhitelist) {
    try {
      txHashWhitelist = await whitelistOnChain([wallet]);
    } catch (error) {
      res.status(500).json({ error: "Gagal whitelist wallet ke blockchain", detail: (error as Error).message });
      return;
    }
  }

  await pool.query(
    `
      UPDATE registrations
      SET wallet = $2, status = $3, approved_at = $4, tx_hash_whitelist = $5, nonce = NULL, nonce_expires_at = NULL
      WHERE ui_subject_id = $1
    `,
    [userSub, wallet, status, approvedAt, txHashWhitelist]
  );

  const updated = await pool.query(`SELECT * FROM registrations WHERE ui_subject_id = $1 LIMIT 1`, [userSub]);
  res.json({ registration: toRegistration(updated.rows[0]) });
});

app.get("/vote/status", requireAuth, async (req, res) => {
  const userSub = req.user!.sub;
  const vote = await pool.query(
    `
      SELECT ui_subject_id, ketum_candidate_id, waketum_candidate_id, tx_hash_ketum, tx_hash_waketum, created_at
      FROM votes
      WHERE ui_subject_id = $1
      LIMIT 1
    `,
    [userSub]
  );

  if (!vote.rows.length) {
    res.json({ hasVoted: false, vote: null });
    return;
  }

  res.json({ hasVoted: true, vote: vote.rows[0] });
});

app.get("/logs", requireAuth, async (req, res) => {
  const parsedLimit = typeof req.query.limit === "string" ? Number.parseInt(req.query.limit, 10) : 300;
  const logs = await listActivityLogs(parsedLimit);
  res.json({ logs });
});

app.post("/vote/record", requireAuth, async (req, res) => {
  const parsed = voteRecordBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", detail: parsed.error.flatten() });
    return;
  }

  const userSub = req.user!.sub;

  const registration = await pool.query(`SELECT * FROM registrations WHERE ui_subject_id = $1 LIMIT 1`, [userSub]);
  if (!registration.rows.length) {
    res.status(400).json({ error: "Wallet belum terdaftar" });
    return;
  }

  const reg = registration.rows[0];
  if (String(reg.status || "").toLowerCase() !== "approved" || !reg.tx_hash_whitelist) {
    res.status(400).json({ error: "Wallet belum approved/whitelisted" });
    return;
  }

  const insert = await pool.query(
    `
      INSERT INTO votes (ui_subject_id, ketum_candidate_id, waketum_candidate_id, tx_hash_ketum, tx_hash_waketum)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (ui_subject_id) DO NOTHING
      RETURNING ui_subject_id, ketum_candidate_id, waketum_candidate_id, tx_hash_ketum, tx_hash_waketum, created_at
    `,
    [
      userSub,
      parsed.data.ketumCandidateId,
      parsed.data.waketumCandidateId,
      parsed.data.txHashKetum.toLowerCase(),
      parsed.data.txHashWaketum.toLowerCase()
    ]
  );

  if (!insert.rows.length) {
    res.status(409).json({ error: "Anda sudah menggunakan hak pilih" });
    return;
  }

  res.json({ ok: true, vote: insert.rows[0] });
});

app.post("/vote/cast", requireAuth, async (req, res) => {
  const parsed = voteCastBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", detail: parsed.error.flatten() });
    return;
  }

  const userSub = req.user!.sub;
  const existingVote = await pool.query(
    `SELECT ui_subject_id, tx_hash_ketum, tx_hash_waketum, created_at FROM votes WHERE ui_subject_id = $1 LIMIT 1`,
    [userSub]
  );
  if (existingVote.rows.length) {
    res.status(409).json({ error: "Anda sudah menggunakan hak pilih", vote: existingVote.rows[0] });
    return;
  }

  const mapping = parsed.data.choice === "paslon1" ? { ketum: 1n, waketum: 11n } : { ketum: 2n, waketum: 12n };

  try {
    const txHash = await castVoteByUserSubOnChain(userSub, mapping.ketum, mapping.waketum);
    const insert = await pool.query(
      `
        INSERT INTO votes (ui_subject_id, ketum_candidate_id, waketum_candidate_id, tx_hash_ketum, tx_hash_waketum)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (ui_subject_id) DO NOTHING
        RETURNING ui_subject_id, ketum_candidate_id, waketum_candidate_id, tx_hash_ketum, tx_hash_waketum, created_at
      `,
      [userSub, Number(mapping.ketum), Number(mapping.waketum), txHash.toLowerCase(), txHash.toLowerCase()]
    );

    if (!insert.rows.length) {
      const latest = await pool.query(
        `SELECT ui_subject_id, tx_hash_ketum, tx_hash_waketum, created_at FROM votes WHERE ui_subject_id = $1 LIMIT 1`,
        [userSub]
      );
      res.status(409).json({ error: "Anda sudah menggunakan hak pilih", vote: latest.rows[0] ?? null });
      return;
    }

    res.json({ ok: true, txHash, vote: insert.rows[0] });
  } catch (error) {
    const detail = (error as Error).message || "unknown error";
    const lowered = detail.toLowerCase();
    if (lowered.includes("alreadyvoted") || lowered.includes("already voted")) {
      const latest = await pool.query(
        `SELECT ui_subject_id, tx_hash_ketum, tx_hash_waketum, created_at FROM votes WHERE ui_subject_id = $1 LIMIT 1`,
        [userSub]
      );
      res.status(409).json({ error: "Anda sudah menggunakan hak pilih", vote: latest.rows[0] ?? null });
      return;
    }
    res.status(500).json({ error: "Gagal kirim vote ke blockchain", detail });
  }
});

app.post("/registration/approve-auto", requireInternalKey, async (req, res) => {
  const payloadSchema = z.object({ registrationId: z.string().uuid() });
  const parsed = payloadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", detail: parsed.error.flatten() });
    return;
  }

  const result = await pool.query(
    `
      UPDATE registrations
      SET status = 'approved', approved_at = NOW()
      WHERE id = $1 AND status = 'pending'
      RETURNING *
    `,
    [parsed.data.registrationId]
  );

  if (!result.rows.length) {
    res.status(404).json({ error: "Registration not found or already processed" });
    return;
  }

  res.json({ registration: toRegistration(result.rows[0]) });
});

app.post("/admin/whitelist/sync", requireAuth, requireAdmin, async (_req, res) => {
  const pending = await pool.query(
    `SELECT * FROM registrations WHERE status = 'approved' AND tx_hash_whitelist IS NULL ORDER BY created_at ASC LIMIT 100`
  );

  if (!pending.rows.length) {
    res.json({ synced: 0, txHash: null });
    return;
  }

  const wallets = (pending.rows as Array<{ wallet: string }>).map((row) => String(row.wallet));

  try {
    const txHash = await whitelistOnChain(wallets);
    const ids = (pending.rows as Array<{ id: string }>).map((row) => row.id);

    await pool.query(
      `UPDATE registrations SET tx_hash_whitelist = $1 WHERE id = ANY($2::uuid[])`,
      [txHash, ids]
    );

    res.json({ synced: wallets.length, txHash });
  } catch (error) {
    res.status(500).json({ error: "Whitelist sync failed", detail: (error as Error).message });
  }
});

app.get("/admin/registrations", requireAuth, requireAdmin, async (_req, res) => {
  const rows = await pool.query(`SELECT * FROM registrations ORDER BY created_at DESC LIMIT 500`);
  res.json({
    registrations: rows.rows.map((row: Record<string, unknown>) => toRegistration(row))
  });
});

app.get("/admin/votes", requireAuth, requireAdmin, async (_req, res) => {
  const rows = await pool.query(
    `
      SELECT
        v.ui_subject_id,
        v.ketum_candidate_id,
        v.waketum_candidate_id,
        v.tx_hash_ketum,
        v.created_at,
        r.email_ui
      FROM votes v
      LEFT JOIN registrations r ON r.ui_subject_id = v.ui_subject_id
      ORDER BY v.created_at DESC
      LIMIT 2000
    `
  );

  const votes = rows.rows.map((row: Record<string, unknown>) => {
    const ketum = Number(row.ketum_candidate_id);
    const waketum = Number(row.waketum_candidate_id);
    const choice: AdminVoteChoice =
      ketum === 1 && waketum === 11 ? "paslon1" : ketum === 2 && waketum === 12 ? "kotak_kosong" : "unknown";

    return {
      participant: String(row.ui_subject_id),
      email: row.email_ui ? String(row.email_ui) : null,
      choice,
      created_at: String(row.created_at),
      tx_hash: String(row.tx_hash_ketum)
    };
  });

  res.json({ votes });
});

app.get("/admin/logs", requireAuth, requireAdmin, async (req, res) => {
  const parsedLimit = typeof req.query.limit === "string" ? Number.parseInt(req.query.limit, 10) : 300;
  const logs = await listActivityLogs(parsedLimit);
  res.json({ logs });
});

app.delete("/admin/logs/all", requireAuth, requireAdmin, async (_req, res) => {
  const result = await pool.query(`DELETE FROM activity_logs`);
  res.json({ ok: true, deleted: result.rowCount ?? 0 });
});

app.delete("/admin/logs/:id", requireAuth, requireAdmin, async (req, res) => {
  const parsed = deleteLogParamsSchema.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid log id" });
    return;
  }

  const result = await pool.query(
    `
      DELETE FROM activity_logs
      WHERE id = $1
      RETURNING id
    `,
    [parsed.data.id]
  );

  if (!result.rows.length) {
    res.status(404).json({ error: "Log not found" });
    return;
  }

  res.json({ ok: true, id: parsed.data.id });
});

app.get("/admin/users", requireAuth, requireAdmin, async (_req, res) => {
  const admins = await listAdminUsernames();
  res.json({ admins });
});

app.post("/admin/users", requireAuth, requireAdmin, async (req, res) => {
  const parsed = adminUserBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", detail: parsed.error.flatten() });
    return;
  }

  await addAdminUsername(parsed.data.username);
  const admins = await listAdminUsernames();
  res.json({ ok: true, admins });
});

app.delete("/admin/users/:username", requireAuth, requireAdmin, async (req, res) => {
  const username = String(req.params.username || "").trim().toLowerCase();
  if (!/^[a-zA-Z0-9._-]{3,100}$/.test(username)) {
    res.status(400).json({ error: "Invalid username" });
    return;
  }

  const current = await listAdminUsernames();
  if (!current.includes(username)) {
    res.status(404).json({ error: "Admin username not found" });
    return;
  }

  if (current.length <= 1) {
    res.status(400).json({ error: "Cannot remove the last admin" });
    return;
  }

  await removeAdminUsername(username);
  const admins = await listAdminUsernames();
  res.json({ ok: true, admins });
});

async function start(): Promise<void> {
  await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);
  await initDb();

  app.listen(env.PORT, () => {
    console.log(`API listening on port ${env.PORT}`);
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
