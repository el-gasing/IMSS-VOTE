"use client";

import { useEffect, useMemo, useState } from "react";

interface ActivityLog {
  id: string;
  actor_sub: string | null;
  actor_email: string | null;
  action: string;
  method: string;
  path: string;
  status_code: number;
  ip: string | null;
  user_agent: string | null;
  detail: { duration_ms?: number } | null;
  created_at: string;
}

interface LogsResponse {
  logs: ActivityLog[];
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("id-ID");
}

export default function LogsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [query, setQuery] = useState("");

  async function loadLogs(): Promise<void> {
    setError("");
    const res = await fetch("/api/logs?limit=500", { credentials: "include" });

    if (res.status === 401) {
      window.location.href = "/auth/login";
      return;
    }

    if (!res.ok) {
      throw new Error("Gagal memuat data log aktivitas");
    }

    const data = (await res.json()) as LogsResponse;
    setLogs(data.logs || []);
  }

  useEffect(() => {
    loadLogs()
      .catch((err) => setError((err as Error).message || "Gagal memuat data log aktivitas"))
      .finally(() => setLoading(false));
  }, []);

  const filteredLogs = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return logs;

    return logs.filter((row) => {
      const haystack = [
        row.action,
        row.method,
        row.path,
        row.actor_sub || "",
        row.actor_email || "",
        String(row.status_code),
        row.ip || ""
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(keyword);
    });
  }, [logs, query]);

  return (
    <section
      className="relative min-h-screen overflow-hidden bg-[#7a3139] bg-cover bg-center bg-no-repeat px-4 py-10 text-[#f6f4f2] md:px-8"
      style={{ backgroundImage: "url('/fe/imss-home.png')" }}
    >
      <div className="noise-overlay pointer-events-none absolute inset-0 z-[1] opacity-10" />
      <div className="relative z-[2] mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="rounded-2xl border border-[#f2d493]/30 bg-black/40 p-6 shadow-soft backdrop-blur">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#f2d493]">Transparansi</p>
              <h1 className="text-3xl font-bold">Log Aktivitas User</h1>
              <p className="mt-2 text-sm text-white/75">Semua aktivitas API yang dilakukan user tercatat di halaman ini.</p>
            </div>
            <button
              className="rounded-full border border-[#f2d493]/60 px-5 py-2.5 text-sm font-semibold text-[#f2d493] transition hover:bg-[#f2d493] hover:text-[#3a171d]"
              onClick={() => {
                setLoading(true);
                loadLogs()
                  .catch((err) => setError((err as Error).message || "Gagal memuat data log aktivitas"))
                  .finally(() => setLoading(false));
              }}
            >
              Refresh
            </button>
          </div>

          <div className="mt-4">
            <input
              className="h-11 w-full rounded-xl border border-white/20 bg-black/40 px-4 text-sm outline-none ring-0 placeholder:text-white/45 focus:border-[#f2d493]/70"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter: action, path, participant, email, status"
            />
          </div>

          {error ? <p className="mt-4 rounded-lg border border-red-300/30 bg-red-900/30 px-4 py-3 text-sm text-red-100">{error}</p> : null}
        </header>

        <article className="rounded-2xl border border-[#f2d493]/20 bg-black/30 p-4 shadow-soft backdrop-blur">
          {loading ? (
            <p className="px-2 py-4 text-sm text-white/80">Memuat log aktivitas...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/15 text-[#f2d493]">
                    <th className="px-3 py-2 font-semibold">Waktu</th>
                    <th className="px-3 py-2 font-semibold">Action</th>
                    <th className="px-3 py-2 font-semibold">User</th>
                    <th className="px-3 py-2 font-semibold">Email</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                    <th className="px-3 py-2 font-semibold">IP</th>
                    <th className="px-3 py-2 font-semibold">Durasi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((row) => (
                    <tr key={row.id} className="border-b border-white/10 text-white/85">
                      <td className="whitespace-nowrap px-3 py-2">{formatWhen(row.created_at)}</td>
                      <td className="whitespace-nowrap px-3 py-2">{row.action}</td>
                      <td className="px-3 py-2">{row.actor_sub || "anonymous"}</td>
                      <td className="px-3 py-2">{row.actor_email || "-"}</td>
                      <td className="px-3 py-2">{row.status_code}</td>
                      <td className="px-3 py-2">{row.ip || "-"}</td>
                      <td className="px-3 py-2">{row.detail?.duration_ms ? `${row.detail.duration_ms} ms` : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!filteredLogs.length ? <p className="px-3 py-6 text-sm text-white/70">Tidak ada data log.</p> : null}
            </div>
          )}
        </article>
      </div>
    </section>
  );
}
