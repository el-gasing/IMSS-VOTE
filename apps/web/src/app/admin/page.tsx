"use client";

import { useEffect, useMemo, useState } from "react";

interface MeResponse {
  authenticated: boolean;
  user?: {
    email: string;
    sub: string;
    isAdmin?: boolean;
  };
}

interface AdminUsersResponse {
  admins: string[];
  error?: string;
}

interface AdminVoteRow {
  participant: string;
  email: string | null;
  choice: "paslon1" | "kotak_kosong" | "unknown";
  created_at: string;
  tx_hash: string;
}

interface AdminVotesResponse {
  votes: AdminVoteRow[];
}

interface ActivityLogRow {
  id: string;
  actor_sub: string | null;
  actor_email: string | null;
  action: string;
  method: string;
  path: string;
  status_code: number;
  created_at: string;
}

interface AdminLogsResponse {
  logs: ActivityLogRow[];
  error?: string;
}

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function choiceLabel(choice: AdminVoteRow["choice"]): string {
  if (choice === "paslon1") return "Paslon 1";
  if (choice === "kotak_kosong") return "Kotak Kosong";
  return "Unknown";
}

function downloadCsv(votes: AdminVoteRow[]): void {
  const header = ["participant", "email", "choice", "created_at", "tx_hash"];
  const lines = votes.map((row) =>
    [row.participant, row.email ?? "", choiceLabel(row.choice), row.created_at, row.tx_hash].map(escapeCsv).join(",")
  );

  const csv = [header.join(","), ...lines].join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  const link = document.createElement("a");
  link.href = url;
  link.download = `imss-voters-${timestamp}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function PercentBar({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = total <= 0 ? 0 : (value / total) * 100;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-sm">
        <span className="text-[#f6f4f2]">{label}</span>
        <strong className="text-[#f2d493]">
          {value} vote ({pct.toFixed(2)}%)
        </strong>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-white/15">
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-200 via-amber-300 to-amber-500"
          style={{ width: `${Math.max(pct, 0)}%` }}
        />
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [accessNotice, setAccessNotice] = useState<"none" | "unauthenticated" | "forbidden">("none");
  const [adminEmail, setAdminEmail] = useState<string>("");
  const [selfUsername, setSelfUsername] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [adminUsers, setAdminUsers] = useState<string[]>([]);
  const [votes, setVotes] = useState<AdminVoteRow[]>([]);
  const [logs, setLogs] = useState<ActivityLogRow[]>([]);
  const [newAdminUsername, setNewAdminUsername] = useState("");
  const [savingAdmin, setSavingAdmin] = useState(false);
  const [adminMutationError, setAdminMutationError] = useState("");
  const [adminActionLoading, setAdminActionLoading] = useState(false);
  const [adminActionError, setAdminActionError] = useState("");

  async function fetchLogs(): Promise<void> {
    const logsRes = await fetch("/api/admin/logs?limit=200", { credentials: "include" });
    if (!logsRes.ok) return;
    const logsData = (await logsRes.json()) as AdminLogsResponse;
    setLogs(logsData.logs || []);
  }

  async function refreshLogsAfterMutation(): Promise<void> {
    // Small delay so activity log middleware has time to persist the DELETE action.
    await new Promise((resolve) => setTimeout(resolve, 200));
    await fetchLogs();
  }

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const meRes = await fetch("/api/auth/me", { credentials: "include" });
        const me = (meRes.ok ? await meRes.json() : { authenticated: false }) as MeResponse;

        if (!me.authenticated) {
          setAccessNotice("unauthenticated");
          return;
        }

        if (!me.user?.isAdmin) {
          setAccessNotice("forbidden");
          return;
        }

        setAccessNotice("none");
        setAdminEmail(me.user.email);
        setSelfUsername(me.user.sub);

        const [adminRes, votesRes, logsRes] = await Promise.all([
          fetch("/api/admin/users", { credentials: "include" }),
          fetch("/api/admin/votes", { credentials: "include" }),
          fetch("/api/admin/logs?limit=200", { credentials: "include" })
        ]);

        if (adminRes.ok) {
          const adminData = (await adminRes.json()) as AdminUsersResponse;
          setAdminUsers(adminData.admins || []);
        }

        if (votesRes.ok) {
          const voteData = (await votesRes.json()) as AdminVotesResponse;
          setVotes(voteData.votes || []);
        }

        if (logsRes.ok) {
          const logsData = (await logsRes.json()) as AdminLogsResponse;
          setLogs(logsData.logs || []);
        }
      } catch (err) {
        setError((err as Error).message || "Gagal memuat data admin");
      } finally {
        setAuthChecked(true);
        setLoading(false);
      }
    }

    load().catch(() => {
      setAuthChecked(true);
      setLoading(false);
    });
  }, []);

  const totalVotes = votes.length;
  const paslon1Votes = useMemo(() => votes.filter((row) => row.choice === "paslon1").length, [votes]);
  const kotakKosongVotes = useMemo(() => votes.filter((row) => row.choice === "kotak_kosong").length, [votes]);

  async function addAdmin(): Promise<void> {
    const username = newAdminUsername.trim().toLowerCase();
    if (!username) return;
    setSavingAdmin(true);
    setAdminMutationError("");
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username })
      });
      const data = (await res.json()) as AdminUsersResponse;
      if (!res.ok) {
        throw new Error(data.error || "Gagal menambah admin");
      }
      setAdminUsers(data.admins || []);
      setNewAdminUsername("");
    } catch (err) {
      setAdminMutationError((err as Error).message || "Gagal menambah admin");
    } finally {
      setSavingAdmin(false);
    }
  }

  async function removeAdmin(username: string): Promise<void> {
    setSavingAdmin(true);
    setAdminMutationError("");
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(username)}`, {
        method: "DELETE",
        credentials: "include"
      });
      const data = (await res.json()) as AdminUsersResponse;
      if (!res.ok) {
        throw new Error(data.error || "Gagal menghapus admin");
      }
      setAdminUsers(data.admins || []);
    } catch (err) {
      setAdminMutationError((err as Error).message || "Gagal menghapus admin");
    } finally {
      setSavingAdmin(false);
    }
  }

  async function deleteLogById(id: string): Promise<void> {
    setAdminActionLoading(true);
    setAdminActionError("");
    try {
      const res = await fetch(`/api/admin/logs/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include"
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Gagal menghapus log");
      }
      await refreshLogsAfterMutation();
    } catch (err) {
      setAdminActionError((err as Error).message || "Gagal menghapus log");
    } finally {
      setAdminActionLoading(false);
    }
  }

  async function clearAllLogs(): Promise<void> {
    const confirmed = window.confirm("Hapus semua activity log?");
    if (!confirmed) return;

    setAdminActionLoading(true);
    setAdminActionError("");
    try {
      const res = await fetch("/api/admin/logs/all", {
        method: "DELETE",
        credentials: "include"
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Gagal menghapus semua log");
      }
      await refreshLogsAfterMutation();
    } catch (err) {
      setAdminActionError((err as Error).message || "Gagal menghapus semua log");
    } finally {
      setAdminActionLoading(false);
    }
  }

  if (!authChecked && loading) {
    return (
      <section className="grid min-h-screen place-items-center bg-[#130d0e] px-6 text-[#f6f4f2]">
        <div className="rounded-2xl border border-[#f2d493]/20 bg-black/40 px-8 py-7">Memverifikasi akses admin...</div>
      </section>
    );
  }

  if (accessNotice === "unauthenticated") {
    return (
      <section className="grid min-h-screen place-items-center bg-[#130d0e] px-6 text-[#f6f4f2]">
        <div className="max-w-xl rounded-2xl border border-[#f2d493]/20 bg-black/40 p-8 shadow-soft">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#f2d493]">Pemberitahuan</p>
          <h1 className="text-3xl font-bold">Login diperlukan untuk akses admin</h1>
          <p className="mt-3 text-white/75">Silakan login dengan akun admin terlebih dahulu untuk membuka panel admin.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <a
              className="rounded-full border border-[#f2d493]/60 px-4 py-2 text-sm font-semibold text-[#f2d493] transition hover:bg-[#f2d493] hover:text-[#3a171d]"
              href="/api/auth/cas/login?redirect=/admin"
            >
              Login SSO UI
            </a>
            <a
              className="rounded-full border border-white/30 px-4 py-2 text-sm text-white/90 transition hover:bg-white/10"
              href="/"
            >
              Kembali ke Beranda
            </a>
          </div>
        </div>
      </section>
    );
  }

  if (accessNotice === "forbidden") {
    return (
      <section className="grid min-h-screen place-items-center bg-[#130d0e] px-6 text-[#f6f4f2]">
        <div className="max-w-xl rounded-2xl border border-[#f2d493]/20 bg-black/40 p-8 shadow-soft">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#f2d493]">Pemberitahuan</p>
          <h1 className="text-3xl font-bold">Halaman ini khusus admin</h1>
          <p className="mt-3 text-white/75">Akun Anda tidak memiliki role admin.</p>
          <a
            className="mt-5 inline-block rounded-full border border-white/30 px-4 py-2 text-sm text-white/90 transition hover:bg-white/10"
            href="/"
          >
            Kembali ke Beranda
          </a>
        </div>
      </section>
    );
  }

  return (
    <section
      className="relative min-h-screen overflow-hidden bg-[#7a3139] bg-cover bg-center bg-no-repeat px-4 py-10 text-[#f6f4f2] md:px-8"
      style={{ backgroundImage: "url('/fe/imss-home.png')" }}
    >
      <div className="noise-overlay pointer-events-none absolute inset-0 z-[1] opacity-10" />
      <div className="relative z-[2] mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="rounded-2xl border border-[#f2d493]/30 bg-black/40 p-6 shadow-soft backdrop-blur">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#f2d493]">Admin Panel</p>
              <h1 className="text-3xl font-bold">Dashboard Voting</h1>
              <p className="mt-2 text-sm text-white/75">Login sebagai: {adminEmail || "-"}</p>
            </div>
            <button
              className="rounded-full border border-[#f2d493]/60 px-5 py-2.5 text-sm font-semibold text-[#f2d493] transition hover:bg-[#f2d493] hover:text-[#3a171d] disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => downloadCsv(votes)}
              disabled={loading || votes.length === 0}
            >
              Export CSV Participant
            </button>
          </div>
          {error ? <p className="mt-4 rounded-lg border border-red-300/30 bg-red-900/30 px-4 py-3 text-sm text-red-100">{error}</p> : null}
        </header>

        <article className="rounded-2xl border border-[#f2d493]/20 bg-black/30 p-6 shadow-soft backdrop-blur">
          <h2 className="text-xl font-semibold text-[#f2d493]">Kelola Admin SSO</h2>
          <p className="mt-1 text-sm text-white/75">Masukkan username SSO UI (contoh: m.naufal41)</p>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              className="h-11 w-full rounded-xl border border-white/20 bg-black/40 px-4 text-sm outline-none ring-0 placeholder:text-white/45 focus:border-[#f2d493]/70"
              value={newAdminUsername}
              onChange={(e) => setNewAdminUsername(e.target.value)}
              placeholder="username sso ui"
            />
            <button
              className="h-11 rounded-xl border border-[#f2d493]/60 px-5 text-sm font-semibold text-[#f2d493] transition hover:bg-[#f2d493] hover:text-[#3a171d] disabled:cursor-not-allowed disabled:opacity-50"
              onClick={addAdmin}
              disabled={savingAdmin || !newAdminUsername.trim()}
            >
              Tambah Admin
            </button>
          </div>

          {adminMutationError ? <p className="mt-3 text-sm text-red-200">{adminMutationError}</p> : null}

          <div className="mt-5 flex flex-wrap gap-2">
            {adminUsers.map((username) => (
              <div
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/35 px-3 py-1.5 text-xs"
                key={username}
              >
                <span>{username}</span>
                <button
                  className="rounded-full border border-red-300/50 px-2 py-0.5 text-[11px] text-red-200 transition hover:bg-red-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => removeAdmin(username)}
                  disabled={savingAdmin || username === selfUsername}
                  title={username === selfUsername ? "Tidak bisa hapus akun yang sedang dipakai" : "Hapus admin"}
                >
                  Hapus
                </button>
              </div>
            ))}
          </div>
        </article>

        <div className="grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-[#f2d493]/20 bg-black/30 p-6 shadow-soft backdrop-blur">
            <h3 className="text-sm uppercase tracking-[0.14em] text-white/65">Total Participant Vote</h3>
            <p className="mt-2 text-4xl font-bold text-[#f2d493]">{totalVotes}</p>
          </article>
          <article className="rounded-2xl border border-[#f2d493]/20 bg-black/30 p-6 shadow-soft backdrop-blur">
            <h3 className="text-sm uppercase tracking-[0.14em] text-white/65">Paslon 1</h3>
            <p className="mt-2 text-4xl font-bold text-[#f2d493]">{paslon1Votes}</p>
          </article>
          <article className="rounded-2xl border border-[#f2d493]/20 bg-black/30 p-6 shadow-soft backdrop-blur">
            <h3 className="text-sm uppercase tracking-[0.14em] text-white/65">Kotak Kosong</h3>
            <p className="mt-2 text-4xl font-bold text-[#f2d493]">{kotakKosongVotes}</p>
          </article>
        </div>

        <article className="rounded-2xl border border-[#f2d493]/20 bg-black/30 p-6 shadow-soft backdrop-blur">
          <h2 className="mb-5 text-xl font-semibold text-[#f2d493]">Perbandingan Vote</h2>
          <div className="space-y-4">
            <PercentBar label="Paslon 1" value={paslon1Votes} total={Math.max(totalVotes, 1)} />
            <PercentBar label="Kotak Kosong" value={kotakKosongVotes} total={Math.max(totalVotes, 1)} />
          </div>
        </article>

        <article className="rounded-2xl border border-[#f2d493]/20 bg-black/30 p-6 shadow-soft backdrop-blur">
          <h2 className="mb-4 text-xl font-semibold text-[#f2d493]">Daftar Participant</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/15 text-[#f2d493]">
                  <th className="px-3 py-2 font-semibold">Participant</th>
                  <th className="px-3 py-2 font-semibold">Email</th>
                  <th className="px-3 py-2 font-semibold">Pilihan</th>
                  <th className="px-3 py-2 font-semibold">Waktu Vote</th>
                </tr>
              </thead>
              <tbody>
                {votes.map((row) => (
                  <tr key={`${row.participant}-${row.created_at}-${row.tx_hash}`} className="border-b border-white/10 text-white/85">
                    <td className="px-3 py-2">{row.participant}</td>
                    <td className="px-3 py-2">{row.email || "-"}</td>
                    <td className="px-3 py-2">{choiceLabel(row.choice)}</td>
                    <td className="px-3 py-2">{new Date(row.created_at).toLocaleString("id-ID")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="rounded-2xl border border-[#f2d493]/20 bg-black/30 p-6 shadow-soft backdrop-blur">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-semibold text-[#f2d493]">Activity Logs</h2>
            <button
              className="rounded-lg border border-red-300/60 px-3 py-1.5 text-xs text-red-200 transition hover:bg-red-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              onClick={clearAllLogs}
              disabled={adminActionLoading || logs.length === 0}
            >
              Hapus Semua Log
            </button>
          </div>
          {adminActionError ? <p className="mb-3 text-sm text-red-200">{adminActionError}</p> : null}
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-white/15 text-[#f2d493]">
                  <th className="px-3 py-2 font-semibold">Waktu</th>
                  <th className="px-3 py-2 font-semibold">Aktor</th>
                  <th className="px-3 py-2 font-semibold">Aksi</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 font-semibold">Hapus</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((row) => (
                  <tr key={row.id} className="border-b border-white/10 text-white/85">
                    <td className="px-3 py-2">{new Date(row.created_at).toLocaleString("id-ID")}</td>
                    <td className="px-3 py-2">{row.actor_email || row.actor_sub || "-"}</td>
                    <td className="px-3 py-2">{row.action}</td>
                    <td className="px-3 py-2">{row.status_code}</td>
                    <td className="px-3 py-2">
                      <button
                        className="rounded-lg border border-red-300/60 px-2 py-1 text-xs text-red-200 transition hover:bg-red-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => deleteLogById(row.id)}
                        disabled={adminActionLoading}
                      >
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))}
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-4 text-white/65">
                      Tidak ada log.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </section>
  );
}
