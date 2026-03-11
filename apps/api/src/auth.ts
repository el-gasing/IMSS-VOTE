import type { Request, Response, NextFunction } from "express";
import { jwtVerify } from "jose";
import { env } from "./env.js";
import type { CasUser } from "./types.js";

declare global {
  namespace Express {
    interface Request {
      user?: CasUser;
    }
  }
}

const secret = new TextEncoder().encode(env.SESSION_JWT_SECRET);

function getCookieValue(cookieHeader: string | undefined, key: string): string | null {
  if (!cookieHeader) return null;
  const pairs = cookieHeader.split(";").map((part) => part.trim());
  for (const pair of pairs) {
    const [k, ...v] = pair.split("=");
    if (k === key) {
      return decodeURIComponent(v.join("="));
    }
  }
  return null;
}

function parseSessionCookie(req: Request): string {
  const token = getCookieValue(req.header("cookie"), "imss_session");
  if (!token) {
    throw new Error("Missing session cookie");
  }
  return token;
}

export async function decodeSession(req: Request): Promise<CasUser> {
  const token = parseSessionCookie(req);
  const { payload } = await jwtVerify(token, secret, { issuer: "imss-voting-api", audience: "imss-voting-web" });

  const user = payload.user;
  if (!user || typeof user !== "object") {
    throw new Error("Invalid session payload");
  }

  return user as CasUser;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    req.user = await decodeSession(req);
    next();
  } catch (_error) {
    res.status(401).json({ error: "Unauthorized" });
  }
}

export function requireStudent(req: Request, res: Response, next: NextFunction): void {
  if (!req.user?.isStudent) {
    res.status(403).json({ error: "Student role required" });
    return;
  }
  next();
}

export function requireVoter(req: Request, res: Response, next: NextFunction): void {
  if (!req.user?.isStudent && !req.user?.isAdmin) {
    res.status(403).json({ error: "Voter role required" });
    return;
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user?.isAdmin) {
    res.status(403).json({ error: "Admin role required" });
    return;
  }
  next();
}

export function requireInternalKey(req: Request, res: Response, next: NextFunction): void {
  const key = req.header("x-internal-key");
  if (!key || key !== env.INTERNAL_API_KEY) {
    res.status(401).json({ error: "Invalid internal key" });
    return;
  }
  next();
}
