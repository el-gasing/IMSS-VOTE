"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { electionAbi, electionAddress } from "@/lib/contract";
import { publicClient } from "@/lib/evm";

interface ResultItem {
  candidateId: bigint;
  votes: bigint;
}

interface Candidate {
  id: bigint;
  name: string;
}

interface ResultRow {
  id: string;
  label: string;
  votes: number;
}

const DEFAULT_KETUM: Candidate[] = [
  { id: 1n, name: "Rifqi Ramadhani" },
  { id: 2n, name: "Kotak Kosong" }
];

const DEFAULT_WAKETUM: Candidate[] = [
  { id: 11n, name: "M Naufal Zhafran" },
  { id: 12n, name: "Kotak Kosong" }
];

const CONFETTI_COLORS = ["#f2d493", "#f87171", "#60a5fa", "#34d399", "#fbbf24", "#ffffff"];

function pct(value: number, total: number): number {
  if (total <= 0) return 0;
  return (value / total) * 100;
}

function buildRows(result: ResultItem[], candidates: Candidate[]): ResultRow[] {
  const voteMap = new Map(result.map((item) => [item.candidateId.toString(), Number(item.votes)]));
  return candidates.map((candidate) => ({
    id: candidate.id.toString(),
    label: candidate.name,
    votes: voteMap.get(candidate.id.toString()) ?? 0
  }));
}

export default function ResultsPage() {
  const [ketum, setKetum] = useState<ResultItem[]>([]);
  const [waketum, setWaketum] = useState<ResultItem[]>([]);
  const [ketumCandidates, setKetumCandidates] = useState<Candidate[]>(DEFAULT_KETUM);
  const [waketumCandidates, setWaketumCandidates] = useState<Candidate[]>(DEFAULT_WAKETUM);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [triggerConfetti, setTriggerConfetti] = useState(false);
  const surpriseRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const chainKetum = (await publicClient.readContract({
          address: electionAddress,
          abi: electionAbi,
          functionName: "getKetumCandidates"
        })) as Candidate[];

        const chainWaketum = (await publicClient.readContract({
          address: electionAddress,
          abi: electionAbi,
          functionName: "getWaketumCandidates"
        })) as Candidate[];

        const [ketumResult, waketumResult] = (await publicClient.readContract({
          address: electionAddress,
          abi: electionAbi,
          functionName: "getResults"
        })) as [ResultItem[], ResultItem[]];

        setKetum(ketumResult);
        setWaketum(waketumResult);
        if (chainKetum.length) setKetumCandidates(chainKetum);
        if (chainWaketum.length) setWaketumCandidates(chainWaketum);
      } catch {
        setError("Data on-chain belum dapat dibaca. Menampilkan template hasil sementara.");
      } finally {
        setLoading(false);
      }
    }

    load().catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    const target = surpriseRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first?.isIntersecting) setTriggerConfetti(true);
      },
      { threshold: 0.35 }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  const ketumRows = useMemo(() => buildRows(ketum, ketumCandidates), [ketum, ketumCandidates]);
  const waketumRows = useMemo(() => buildRows(waketum, waketumCandidates), [waketum, waketumCandidates]);

  const totalKetum = useMemo(() => ketumRows.reduce((sum, row) => sum + row.votes, 0), [ketumRows]);
  const totalWaketum = useMemo(() => waketumRows.reduce((sum, row) => sum + row.votes, 0), [waketumRows]);
  const totalVotes = Math.max(totalKetum, totalWaketum);

  const ticketRows = useMemo(() => {
    const paslonVote = ketumRows.find((row) => row.id === "1")?.votes ?? 0;
    const kosongVote = ketumRows.find((row) => row.id === "2")?.votes ?? 0;
    return [
      { key: "paslon1", title: "PASLON 01", names: "Rifqi Ramadhani & M Naufal Zhafran", image: "/fe/Paslon1.jpg", votes: paslonVote },
      { key: "kotak_kosong", title: "KOTAK KOSONG", names: "Tidak memilih kandidat", image: "/fe/kotakkosong.jpg", votes: kosongVote }
    ];
  }, [ketumRows]);

  const confettiPieces = useMemo(
    () =>
      Array.from({ length: 44 }, (_, i) => ({
        id: i,
        left: `${(i * 2.17) % 100}%`,
        delay: `${(i % 9) * 0.14}s`,
        duration: `${3 + (i % 6) * 0.24}s`,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length]
      })),
    []
  );

  return (
    <section className="relative min-h-screen overflow-hidden bg-[#170d10] px-4 py-10 text-[#f6f4f2] md:px-8">
      <div className="noise-overlay pointer-events-none absolute inset-0 z-[1] opacity-10" />
      <div className="relative z-[2] mx-auto w-full max-w-5xl space-y-6">
        <article className="rounded-2xl border border-[#f2d493]/25 bg-black/35 p-6 shadow-soft">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#f2d493]">Rekap Final</p>
          <h1 className="text-3xl font-bold text-[#f2d493]">Hasil Voting IMSS UI</h1>
          <p className="mt-2 text-sm text-white/75">
            {loading ? "Mengambil data on-chain..." : `Total suara terbaca: ${totalVotes} suara`}
          </p>
          {error ? <p className="mt-3 rounded-lg border border-amber-300/35 bg-amber-900/25 px-3 py-2 text-sm text-amber-100">{error}</p> : null}
        </article>

        <article className="rounded-2xl border border-white/15 bg-black/30 p-6 shadow-soft">
          <h2 className="text-xl font-semibold text-[#f2d493]">Grafik Ketua Umum</h2>
          <div className="mt-4 space-y-4">
            {ketumRows.map((row) => (
              <div key={row.id}>
                <div className="mb-1 flex items-center justify-between gap-4 text-sm">
                  <p className="font-semibold">{row.label}</p>
                  <p className="text-white/80">
                    {row.votes} suara ({pct(row.votes, totalKetum).toFixed(1)}%)
                  </p>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#f2d493] to-[#f59e0b] transition-all duration-700"
                    style={{ width: `${Math.max(3, pct(row.votes, totalKetum))}%` }}
                  />
                </div>
              </div>
            ))}
            {!ketumRows.length ? <p className="text-sm text-white/75">Belum ada data kandidat ketua umum.</p> : null}
          </div>
        </article>

        <article className="rounded-2xl border border-white/15 bg-black/30 p-6 shadow-soft">
          <h2 className="text-xl font-semibold text-[#f2d493]">Grafik Wakil Ketua Umum</h2>
          <div className="mt-4 space-y-4">
            {waketumRows.map((row) => (
              <div key={row.id}>
                <div className="mb-1 flex items-center justify-between gap-4 text-sm">
                  <p className="font-semibold">{row.label}</p>
                  <p className="text-white/80">
                    {row.votes} suara ({pct(row.votes, totalWaketum).toFixed(1)}%)
                  </p>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#93c5fd] to-[#60a5fa] transition-all duration-700"
                    style={{ width: `${Math.max(3, pct(row.votes, totalWaketum))}%` }}
                  />
                </div>
              </div>
            ))}
            {!waketumRows.length ? <p className="text-sm text-white/75">Belum ada data kandidat wakil ketua umum.</p> : null}
          </div>
        </article>

        <article ref={surpriseRef} className="relative overflow-hidden rounded-2xl border border-[#f2d493]/30 bg-[#221116]/75 p-6 shadow-soft">
          <h2 className="text-xl font-semibold text-[#f2d493]">Foto Paslon & Ucapan Selamat</h2>
          <p className="mt-1 text-sm text-white/80">Scroll sampai bagian ini untuk efek konfeti kejutan.</p>

          {triggerConfetti ? (
            <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden">
              {confettiPieces.map((piece) => (
                <span
                  key={piece.id}
                  className="absolute top-[-12%] h-3 w-2 confetti-fall rounded-[2px] opacity-90"
                  style={{
                    left: piece.left,
                    backgroundColor: piece.color,
                    animationDelay: piece.delay,
                    animationDuration: piece.duration
                  }}
                />
              ))}
            </div>
          ) : null}

          <div className="relative z-[2] mt-5 grid gap-4 md:grid-cols-2">
            {ticketRows.map((ticket) => (
              <article key={ticket.key} className="overflow-hidden rounded-xl border border-white/15 bg-black/35">
                <img src={ticket.image} alt={ticket.title} className="aspect-video w-full object-cover" />
                <div className="p-4">
                  <p className="text-xs tracking-[0.14em] text-[#f2d493]">{ticket.title}</p>
                  <h3 className="mt-1 text-lg font-semibold">{ticket.names}</h3>
                  <p className="mt-2 text-sm text-white/85">
                    {ticket.votes} suara ({pct(ticket.votes, totalKetum).toFixed(1)}%)
                  </p>
                </div>
              </article>
            ))}
          </div>

          <p className="relative z-[2] mt-5 text-center text-sm font-semibold text-[#f2d493]">
            Selamat kepada seluruh civitas IMSS UI atas suksesnya pesta demokrasi.
          </p>
        </article>
      </div>
    </section>
  );
}
