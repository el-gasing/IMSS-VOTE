"use client";

import { useEffect, useMemo, useRef, useState } from "react";

interface ResultItem {
  candidateId: number;
  votes: number;
}

interface Candidate {
  id: number;
  name: string;
}

interface ResultRow {
  id: string;
  label: string;
  votes: number;
}

const DEFAULT_KETUM: Candidate[] = [
  { id: 1, name: "Rifqi Ramadhani" },
  { id: 2, name: "Kotak Kosong" }
];

const DEFAULT_WAKETUM: Candidate[] = [
  { id: 11, name: "M Naufal Zhafran" },
  { id: 12, name: "Kotak Kosong" }
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

function PieChart({
  value,
  color,
  label
}: {
  value: number;
  color: string;
  label: string;
}) {
  const safe = Math.max(0, Math.min(100, value));
  return (
    <div className="grid place-items-center">
      <div
        className="relative h-[210px] w-[210px] rounded-full shadow-soft"
        style={{ background: `conic-gradient(${color} 0 ${safe}%, rgba(255,255,255,0.12) ${safe}% 100%)` }}
      >
        <div className="absolute inset-[18%] grid place-items-center rounded-full border border-white/20 bg-[#1a0f12]/90">
          <p className="text-center text-sm text-white/70">{label}</p>
          <p className="text-3xl font-bold text-[#f6f4f2]">{safe.toFixed(1)}%</p>
        </div>
      </div>
    </div>
  );
}

export default function ResultsPage() {
  const [ketum, setKetum] = useState<ResultItem[]>([]);
  const [waketum, setWaketum] = useState<ResultItem[]>([]);
  const [ketumCandidates] = useState<Candidate[]>(DEFAULT_KETUM);
  const [waketumCandidates] = useState<Candidate[]>(DEFAULT_WAKETUM);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sourceLabel, setSourceLabel] = useState("database");
  const [triggerConfetti, setTriggerConfetti] = useState(false);
  const [chartVisible, setChartVisible] = useState(false);
  const [photoVisible, setPhotoVisible] = useState(false);
  const [animatedKetumPct, setAnimatedKetumPct] = useState(0);
  const [animatedWaketumPct, setAnimatedWaketumPct] = useState(0);

  const chartRef = useRef<HTMLElement | null>(null);
  const photoRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const summaryRes = await fetch("/api/results/summary", { credentials: "include" });
        if (!summaryRes.ok) {
          throw new Error("Gagal memuat ringkasan hasil voting.");
        }

        const summary = (await summaryRes.json()) as {
          source?: string;
          ketum?: Array<{ candidateId: number; votes: number }>;
          waketum?: Array<{ candidateId: number; votes: number }>;
        };

        setSourceLabel(summary.source || "database");
        setKetum(summary.ketum || []);
        setWaketum(summary.waketum || []);
      } catch (err) {
        setError((err as Error).message || "Data hasil belum tersedia.");
      } finally {
        setLoading(false);
      }
    }

    load().catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    const chartTarget = chartRef.current;
    const photoTarget = photoRef.current;
    if (!chartTarget || !photoTarget) return;

    const chartObserver = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setChartVisible(true);
      },
      { threshold: 0.3 }
    );
    const photoObserver = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setPhotoVisible(true);
          setTriggerConfetti(true);
        }
      },
      { threshold: 0.28 }
    );

    chartObserver.observe(chartTarget);
    photoObserver.observe(photoTarget);

    return () => {
      chartObserver.disconnect();
      photoObserver.disconnect();
    };
  }, []);

  const ketumRows = useMemo(() => buildRows(ketum, ketumCandidates), [ketum, ketumCandidates]);
  const waketumRows = useMemo(() => buildRows(waketum, waketumCandidates), [waketum, waketumCandidates]);

  const totalKetum = useMemo(() => ketumRows.reduce((sum, row) => sum + row.votes, 0), [ketumRows]);
  const totalWaketum = useMemo(() => waketumRows.reduce((sum, row) => sum + row.votes, 0), [waketumRows]);
  const totalVotes = Math.max(totalKetum, totalWaketum);

  const paslonKetumVotes = ketumRows.find((row) => row.id === "1")?.votes ?? 0;
  const paslonWaketumVotes = waketumRows.find((row) => row.id === "11")?.votes ?? 0;

  const targetKetumPct = pct(paslonKetumVotes, totalKetum);
  const targetWaketumPct = pct(paslonWaketumVotes, totalWaketum);

  useEffect(() => {
    if (!chartVisible) return;
    const durationMs = 1000;
    const startAt = performance.now();

    function frame(now: number): void {
      const progress = Math.min(1, (now - startAt) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedKetumPct(targetKetumPct * eased);
      setAnimatedWaketumPct(targetWaketumPct * eased);
      if (progress < 1) requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  }, [chartVisible, targetKetumPct, targetWaketumPct]);

  const confettiPieces = useMemo(
    () =>
      Array.from({ length: 42 }, (_, i) => ({
        id: i,
        left: `${(i * 2.4) % 100}%`,
        delay: `${(i % 8) * 0.13}s`,
        duration: `${2.8 + (i % 5) * 0.25}s`,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length]
      })),
    []
  );

  const ticketRows = useMemo(
    () => [
      {
        key: "paslon1",
        title: "PASLON 01",
        names: "Rifqi Ramadhani & M Naufal Zhafran",
        image: "/fe/Paslon1.jpg",
        votes: paslonKetumVotes
      },
      {
        key: "kotak_kosong",
        title: "KOTAK KOSONG",
        names: "Tidak memilih kandidat",
        image: "/fe/kotakkosong.jpg",
        votes: ketumRows.find((row) => row.id === "2")?.votes ?? 0
      }
    ],
    [ketumRows, paslonKetumVotes]
  );

  return (
    <section className="main-flow-no-select relative min-h-screen overflow-x-hidden text-[#f6f4f2]">
      <div
        className="relative bg-[#7a3139] bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/fe/imss-home.png')" }}
      >
        <div className="noise-overlay pointer-events-none absolute inset-0 z-[1] opacity-10" />

        <div className="absolute left-3 top-0 z-[3] flex items-start md:left-10 md:top-0">
          <img className="h-[clamp(34px,8vw,80px)] w-auto" src="/fe/logo-imss.png" alt="IMSS Logo" />
          <img className="h-[clamp(34px,8vw,80px)] w-auto" src="/fe/logo-ui.png" alt="UI Logo" />
        </div>

        <div className="font-lydian absolute right-4 top-4 z-[3] text-left text-[clamp(16px,3.6vw,40px)] leading-[0.92] tracking-[-0.5px] text-[#e8e8e8] drop-shadow-[3px_3px_0_rgba(0,0,0,0.45)] md:right-10 md:top-8">
          Sipakatau
          <br />
          Sipakalebbi
          <br />
          Sipakainge
        </div>

        <img className="pointer-events-none absolute left-[-18%] top-[25%] z-0 w-[clamp(140px,40vw,420px)] -translate-y-1/2 md:left-[-6%] md:w-[clamp(180px,28vw,420px)]" src="/fe/cloud-left.svg" alt="" />
        <img className="pointer-events-none absolute right-[-18%] top-[25%] z-0 w-[clamp(140px,40vw,420px)] -translate-y-1/2 md:right-[-6%] md:w-[clamp(180px,28vw,420px)]" src="/fe/cloud-right.svg" alt="" />
        <img className="pointer-events-none absolute bottom-0 left-1/2 z-0 w-[175%] max-w-none -translate-x-1/2 md:left-0 md:w-full md:max-w-full md:translate-x-0" src="/fe/cloud-bottom.svg" alt="" />
        <img
          className="smoke-flow pointer-events-none absolute bottom-0 left-[47%] z-[1] w-[190%] max-w-none -translate-x-1/2 opacity-60 max-[768px]:left-[-48%] max-[768px]:w-[258%] max-[430px]:left-[-22%] max-[430px]:w-[240%] md:left-0 md:w-full md:max-w-full md:translate-x-0"
          src="/fe/smoke.svg"
          alt=""
        />

        <div className="relative z-[2] mx-auto max-w-5xl px-5 pb-20 pt-28 md:px-8 md:pt-36">
          <header className="grid min-h-[56vh] place-items-center text-center">
            <div className="max-w-4xl">
              <p className="text-[clamp(14px,2.3vw,26px)] font-semibold text-[#f2d493]">Selamat, pesta demokrasi IMSS UI telah selesai.</p>
              <h1 className="mt-3 text-[clamp(34px,6vw,72px)] font-bold leading-[0.92] text-[#f6f4f2] drop-shadow-[4px_4px_0_rgba(0,0,0,0.45)]">
                Terima kasih atas partisipasi seluruh civitas IMSS UI
              </h1>
              <p className="mt-5 text-sm uppercase tracking-[0.16em] text-white/70">
                {loading ? "Memuat hasil voting..." : `Total suara tercatat ${totalVotes} • Sumber ${sourceLabel}`}
              </p>
              {error ? <p className="mt-3 text-sm text-red-200">{error}</p> : null}
            </div>
          </header>

          <section
            ref={chartRef}
            className={`rounded-2xl border border-[#f2d493]/30 bg-black/35 p-6 transition-all duration-700 md:p-8 ${
              chartVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
            }`}
          >
            <h2 className="text-2xl font-bold text-[#f2d493]">Grafik Hasil Voting</h2>
            <p className="mt-1 text-sm text-white/75">Visualisasi pie chart untuk hasil suara final.</p>

            <div className="mt-6 grid gap-8 md:grid-cols-2">
              <article className="rounded-xl border border-white/15 bg-black/25 p-5">
                <h3 className="text-lg font-semibold">Ketua Umum</h3>
                <div className="mt-5">
                  <PieChart value={animatedKetumPct} color="#f59e0b" label="Paslon 01" />
                </div>
                <div className="mt-5 space-y-2 text-sm">
                  {ketumRows.map((row) => (
                    <p key={row.id} className="flex items-center justify-between">
                      <span>{row.label}</span>
                      <span className="text-white/80">
                        {row.votes} suara ({pct(row.votes, totalKetum).toFixed(1)}%)
                      </span>
                    </p>
                  ))}
                </div>
              </article>

              <article className="rounded-xl border border-white/15 bg-black/25 p-5">
                <h3 className="text-lg font-semibold">Wakil Ketua Umum</h3>
                <div className="mt-5">
                  <PieChart value={animatedWaketumPct} color="#60a5fa" label="Paslon 01" />
                </div>
                <div className="mt-5 space-y-2 text-sm">
                  {waketumRows.map((row) => (
                    <p key={row.id} className="flex items-center justify-between">
                      <span>{row.label}</span>
                      <span className="text-white/80">
                        {row.votes} suara ({pct(row.votes, totalWaketum).toFixed(1)}%)
                      </span>
                    </p>
                  ))}
                </div>
              </article>
            </div>
          </section>

          <section
            ref={photoRef}
            className={`relative mt-8 overflow-hidden rounded-2xl border border-[#f2d493]/30 bg-[#221116]/75 p-6 transition-all duration-700 md:p-8 ${
              photoVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
            }`}
          >
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

            <div className="relative z-[2]">
              <h2 className="text-2xl font-bold text-[#f2d493]">Foto Paslon</h2>
              <p className="mt-1 text-sm text-white/80">Terima kasih sudah ikut menyukseskan PEMIRA IMSS UI.</p>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {ticketRows.map((ticket) => (
                  <article key={ticket.key} className="overflow-hidden rounded-xl border border-white/15 bg-black/35 shadow-soft">
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
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
