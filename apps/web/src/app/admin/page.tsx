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
  if (value.includes(",") || value.includes("\"") || value.includes("\n")) {
    return `"${value.replace(/"/g, "\"\"")}"`;
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
      <section className="card">
        <p>Memverifikasi akses admin...</p>
      </section>
    );
  }

  if (forbidden) {
    return (
      <section className="card">
        <p className="kicker">Akses Ditolak</p>
        <h1>Halaman ini khusus admin</h1>
        <p className="muted">Akun Anda tidak memiliki role admin.</p>
      </section>
    );
  }

  return (
    <section className="card admin-panel">
      <div className="admin-header">
        <div>
          <p className="kicker">Admin Panel</p>
          <h1>Dashboard Hasil Voting</h1>
          <p className="muted">Login sebagai: {adminEmail || "-"}</p>
        </div>
        <button onClick={() => downloadCsv(allStats)} disabled={loading || allStats.length === 0}>
          Export CSV
        </button>
      </div>

      {error ? <p className="admin-error">{error}</p> : null}

      <article className="admin-chart-card">
        <h2>Kelola Admin SSO</h2>
        <p className="muted">Masukkan username SSO UI (contoh: m.naufal41)</p>
        <div className="admin-form-row">
          <input
            className="admin-input"
            value={newAdminUsername}
            onChange={(e) => setNewAdminUsername(e.target.value)}
            placeholder="username sso ui"
          />
          <button onClick={addAdmin} disabled={savingAdmin || !newAdminUsername.trim()}>
            Tambah Admin
          </button>
        </div>
        {adminMutationError ? <p className="admin-error">{adminMutationError}</p> : null}
        <div className="admin-badges">
          {adminUsers.map((username) => (
            <div className="admin-badge" key={username}>
              <span>{username}</span>
              <button
                className="admin-remove-btn"
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

      <div className="admin-summary-grid">
        <article className="admin-summary-card">
          <h3>Total Vote Ketua Umum</h3>
          <p>{totalKetumVotes.toString()}</p>
        </article>
        <article className="admin-summary-card">
          <h3>Total Vote Wakil Ketua Umum</h3>
          <p>{totalWaketumVotes.toString()}</p>
        </article>
      </div>

      <div className="admin-chart-grid">
        <article className="admin-chart-card">
          <h2>Grafik Ketua Umum</h2>
          {ketumStats.map((row) => (
            <div className="chart-row" key={`ketum-${row.candidateId.toString()}`}>
              <div className="chart-row-head">
                <span>{row.candidateName}</span>
                <strong>
                  {row.votes.toString()} vote ({row.percentage.toFixed(2)}%)
                </strong>
              </div>
              <div className="chart-track">
                <div className="chart-fill" style={{ width: `${Math.max(row.percentage, 0)}%` }} />
              </div>
            </div>
          ))}
        </article>

        <article className="admin-chart-card">
          <h2>Grafik Wakil Ketua Umum</h2>
          {waketumStats.map((row) => (
            <div className="chart-row" key={`waketum-${row.candidateId.toString()}`}>
              <div className="chart-row-head">
                <span>{row.candidateName}</span>
                <strong>
                  {row.votes.toString()} vote ({row.percentage.toFixed(2)}%)
                </strong>
              </div>
              <div className="chart-track">
                <div className="chart-fill" style={{ width: `${Math.max(row.percentage, 0)}%` }} />
              </div>
            </div>
          ))}
        </article>
      </div>
    </section>
  );
}
