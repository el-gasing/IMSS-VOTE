"use client";

import { useEffect, useMemo, useState } from "react";
import { electionAbi, electionAddress } from "@/lib/contract";
import { publicClient } from "@/lib/evm";

interface Candidate {
  id: bigint;
  name: string;
}

interface ResultItem {
  candidateId: bigint;
  votes: bigint;
}

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
}

interface CandidateStat {
  section: "ketum" | "waketum";
  candidateId: bigint;
  candidateName: string;
  votes: bigint;
  percentage: number;
  totalVotesInSection: bigint;
}

function bigIntToNumberSafe(value: bigint): number {
  const max = BigInt(Number.MAX_SAFE_INTEGER);
  if (value > max) return Number.MAX_SAFE_INTEGER;
  return Number(value);
}

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function buildStats(section: "ketum" | "waketum", candidates: Candidate[], results: ResultItem[]): CandidateStat[] {
  const voteMap = new Map(results.map((r) => [r.candidateId.toString(), r.votes]));
  const total = results.reduce((sum, r) => sum + r.votes, 0n);

  return candidates
    .map((candidate) => {
      const votes = voteMap.get(candidate.id.toString()) ?? 0n;
      const percentage = total === 0n ? 0 : (bigIntToNumberSafe(votes) / bigIntToNumberSafe(total)) * 100;
      return {
        section,
        candidateId: candidate.id,
        candidateName: candidate.name,
        votes,
        percentage,
        totalVotesInSection: total
      };
    })
    .sort((a, b) => {
      if (a.votes === b.votes) return 0;
      return a.votes > b.votes ? -1 : 1;
    });
}

function downloadCsv(rows: CandidateStat[]): void {
  const header = ["section", "candidate_id", "candidate_name", "votes", "percentage", "total_votes_section"];
  const lines = rows.map((row) =>
    [
      row.section,
      row.candidateId.toString(),
      row.candidateName,
      row.votes.toString(),
      row.percentage.toFixed(2),
      row.totalVotesInSection.toString()
    ]
      .map(escapeCsv)
      .join(",")
  );

  const csv = [header.join(","), ...lines].join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  const link = document.createElement("a");
  link.href = url;
  link.download = `imss-voting-results-${timestamp}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function VoteChart({ title, rows }: { title: string; rows: CandidateStat[] }) {
  return (
    <article className="rounded-2xl border border-[#f2d493]/20 bg-black/30 p-6 shadow-soft backdrop-blur">
      <h2 className="mb-5 text-xl font-semibold text-[#f2d493]">{title}</h2>
      <div className="space-y-4">
        {rows.map((row) => (
          <div key={`${row.section}-${row.candidateId.toString()}`}>
            <div className="mb-1 flex items-center justify-between gap-3 text-sm">
              <span className="text-[#f6f4f2]">{row.candidateName}</span>
              <strong className="text-[#f2d493]">
                {row.votes.toString()} vote ({row.percentage.toFixed(2)}%)
              </strong>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-200 via-amber-300 to-amber-500"
                style={{ width: `${Math.max(row.percentage, 0)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [adminEmail, setAdminEmail] = useState<string>("");
  const [selfUsername, setSelfUsername] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [adminUsers, setAdminUsers] = useState<string[]>([]);
  const [newAdminUsername, setNewAdminUsername] = useState("");
  const [savingAdmin, setSavingAdmin] = useState(false);
  const [adminMutationError, setAdminMutationError] = useState("");
  const [ketumStats, setKetumStats] = useState<CandidateStat[]>([]);
  const [waketumStats, setWaketumStats] = useState<CandidateStat[]>([]);

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const meRes = await fetch("/api/auth/me", { credentials: "include" });
        const me = (meRes.ok ? await meRes.json() : { authenticated: false }) as MeResponse;

        if (!me.authenticated) {
          window.location.href = "/auth/login";
          return;
        }

        if (!me.user?.isAdmin) {
          setForbidden(true);
          setAuthChecked(true);
          return;
        }

        setAdminEmail(me.user.email);
        setSelfUsername(me.user.sub);
        setAuthChecked(true);

        const adminRes = await fetch("/api/admin/users", { credentials: "include" });
        if (adminRes.ok) {
          const adminData = (await adminRes.json()) as AdminUsersResponse;
          setAdminUsers(adminData.admins || []);
        }

        const ketumCandidates = (await publicClient.readContract({
          address: electionAddress,
          abi: electionAbi,
          functionName: "getKetumCandidates"
        })) as Candidate[];

        const waketumCandidates = (await publicClient.readContract({
          address: electionAddress,
          abi: electionAbi,
          functionName: "getWaketumCandidates"
        })) as Candidate[];

        const [ketumResult, waketumResult] = (await publicClient.readContract({
          address: electionAddress,
          abi: electionAbi,
          functionName: "getResults"
        })) as [ResultItem[], ResultItem[]];

        setKetumStats(buildStats("ketum", ketumCandidates, ketumResult));
        setWaketumStats(buildStats("waketum", waketumCandidates, waketumResult));
      } catch (err) {
        const message = (err as Error).message || "Gagal memuat hasil voting";
        if (message.includes("returned no data") || message.includes("address is not a contract")) {
          setError(
            `Kontrak voting belum terdeteksi di address ${electionAddress}. Isi NEXT_PUBLIC_ELECTION_CONTRACT_ADDRESS dengan alamat kontrak Election yang sudah deploy, lalu rebuild web.`
          );
        } else {
          setError(message);
        }
      } finally {
        setLoading(false);
      }
    }

    load().catch(() => setLoading(false));
  }, []);

  const allStats = useMemo(() => [...ketumStats, ...waketumStats], [ketumStats, waketumStats]);
  const totalKetumVotes = ketumStats.reduce((sum, row) => sum + row.votes, 0n);
  const totalWaketumVotes = waketumStats.reduce((sum, row) => sum + row.votes, 0n);

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
      const data = (await res.json()) as AdminUsersResponse & { error?: string };
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
      const data = (await res.json()) as AdminUsersResponse & { error?: string };
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

  if (!authChecked && loading) {
    return (
      <section className="grid min-h-screen place-items-center bg-[#130d0e] px-6 text-[#f6f4f2]">
        <div className="rounded-2xl border border-[#f2d493]/20 bg-black/40 px-8 py-7">Memverifikasi akses admin...</div>
      </section>
    );
  }

  if (forbidden) {
    return (
      <section className="grid min-h-screen place-items-center bg-[#130d0e] px-6 text-[#f6f4f2]">
        <div className="max-w-xl rounded-2xl border border-[#f2d493]/20 bg-black/40 p-8 shadow-soft">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#f2d493]">Akses Ditolak</p>
          <h1 className="text-3xl font-bold">Halaman ini khusus admin</h1>
          <p className="mt-3 text-white/75">Akun Anda tidak memiliki role admin.</p>
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
              <h1 className="text-3xl font-bold">Dashboard Hasil Voting</h1>
              <p className="mt-2 text-sm text-white/75">Login sebagai: {adminEmail || "-"}</p>
            </div>
            <button
              className="rounded-full border border-[#f2d493]/60 px-5 py-2.5 text-sm font-semibold text-[#f2d493] transition hover:bg-[#f2d493] hover:text-[#3a171d] disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => downloadCsv(allStats)}
              disabled={loading || allStats.length === 0}
            >
              Export CSV
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

        <div className="grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-[#f2d493]/20 bg-black/30 p-6 shadow-soft backdrop-blur">
            <h3 className="text-sm uppercase tracking-[0.14em] text-white/65">Total Vote Ketua Umum</h3>
            <p className="mt-2 text-4xl font-bold text-[#f2d493]">{totalKetumVotes.toString()}</p>
          </article>
          <article className="rounded-2xl border border-[#f2d493]/20 bg-black/30 p-6 shadow-soft backdrop-blur">
            <h3 className="text-sm uppercase tracking-[0.14em] text-white/65">Total Vote Wakil Ketua Umum</h3>
            <p className="mt-2 text-4xl font-bold text-[#f2d493]">{totalWaketumVotes.toString()}</p>
          </article>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <VoteChart title="Grafik Ketua Umum" rows={ketumStats} />
          <VoteChart title="Grafik Wakil Ketua Umum" rows={waketumStats} />
        </div>
      </div>
    </section>
  );
}
