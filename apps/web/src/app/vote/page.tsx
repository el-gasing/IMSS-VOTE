"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type VoteChoice = "paslon1" | "kotak_kosong";
type ViewMode = "vote" | "success";

interface MeResponse {
  authenticated: boolean;
  user?: { email: string; sub: string };
}

const API_BASE = "/api";

function txShort(tx: string): string {
  if (tx.length <= 18) return tx;
  return `${tx.slice(0, 10)}...${tx.slice(-8)}`;
}

export default function VotePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [alreadyVoted, setAlreadyVoted] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [view, setView] = useState<ViewMode>("vote");
  const [txHash, setTxHash] = useState("");

  const toastVisible = useMemo(() => Boolean(toast), [toast]);

  useEffect(() => {
    async function bootstrap(): Promise<void> {
      try {
        const meRes = await fetch(`${API_BASE}/auth/me`, { credentials: "include" });
        const meData = (meRes.ok ? await meRes.json() : { authenticated: false }) as MeResponse;

        if (!meData.authenticated) {
          window.location.href = `${API_BASE}/auth/cas/login?redirect=/vote`;
          return;
        }

        const voteStatusRes = await fetch(`${API_BASE}/vote/status`, { credentials: "include" });
        if (voteStatusRes.ok) {
          const voteStatus = (await voteStatusRes.json()) as {
            hasVoted?: boolean;
            vote?: { tx_hash_ketum?: string; tx_hash_waketum?: string } | null;
          };

          const voted = Boolean(voteStatus.hasVoted);
          setAlreadyVoted(voted);
          if (voted) {
            setView("success");
            const tx = voteStatus.vote?.tx_hash_ketum || voteStatus.vote?.tx_hash_waketum || "";
            if (tx) setTxHash(tx);
          }
        }
      } finally {
        setLoading(false);
      }
    }

    bootstrap().catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  async function castVote(choice: VoteChoice): Promise<void> {
    if (submitting) return;

    if (alreadyVoted) {
      setToast("Anda sudah menggunakan hak pilih");
      setView("success");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const voteRes = await fetch(`${API_BASE}/vote/cast`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ choice })
      });

      const voteData = (await voteRes.json()) as { error?: string; txHash?: string };
      if (!voteRes.ok) {
        throw new Error(voteData.error || "Gagal kirim vote ke blockchain");
      }

      const tx = voteData.txHash || "";
      setTxHash(tx);
      setAlreadyVoted(true);
      localStorage.setItem("imss_vote_choice", choice);
      localStorage.setItem("imss_vote_time", new Date().toISOString());
      if (tx) localStorage.setItem("imss_vote_tx_hash", tx);
      setView("success");
    } catch (err) {
      const message = (err as Error).message || "Gagal kirim vote ke blockchain";
      setError(message);
      if (message.toLowerCase().includes("sudah menggunakan hak pilih")) {
        setAlreadyVoted(true);
        setView("success");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <section className="grid min-h-screen place-items-center bg-[#130d0e] text-[#f6f4f2]">
        <p>Memuat sesi login...</p>
      </section>
    );
  }

  return (
    <section className="relative min-h-screen w-full overflow-hidden text-[#f6f4f2]">
      <div
        className={`fixed left-1/2 top-6 z-20 -translate-x-1/2 rounded-xl border border-white/20 bg-black/80 px-4 py-3 text-sm transition-all ${
          toastVisible ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none -translate-y-3 opacity-0"
        }`}
      >
        {toast || "-"}
      </div>

      <div className={`${view === "vote" ? "opacity-100" : "pointer-events-none opacity-0"} absolute inset-0 transition-opacity duration-300`}>
        <div
          className="relative flex min-h-screen items-start justify-center bg-cover bg-center bg-no-repeat pt-6 sm:items-center sm:pt-0"
          style={{ backgroundImage: "url('/fe/background-voting.png')" }}
        >
          <div className="noise-overlay pointer-events-none absolute inset-0 z-[1] opacity-10" />
          <button
            className="absolute left-4 top-4 z-[3] grid h-10 w-10 place-items-center rounded-full bg-black/35 text-xl text-white transition hover:bg-black/60 sm:left-5 sm:top-5 sm:h-11 sm:w-11 sm:text-2xl"
            onClick={() => router.push("/")}
            aria-label="Kembali"
          >
            ←
          </button>

          <div className="z-[2] w-full max-w-6xl px-4 pt-14 text-center sm:px-5 sm:pt-10 md:pt-0">
            <h1 className="text-[clamp(26px,8.5vw,42px)] font-bold leading-[1.05]">PILIH KETUA UMUM</h1>
            {error ? <p className="mt-3 text-red-200">{error}</p> : null}

            <div className="mt-6 flex flex-wrap justify-center gap-5 sm:mt-7 sm:gap-8">
              <article className="w-full max-w-[360px] overflow-hidden rounded-xl border border-white/15 bg-white/5 transition hover:-translate-y-2 hover:border-white/30 hover:shadow-soft">
                <img className="block aspect-video w-full object-cover" src="/fe/Paslon1.jpg" alt="Paslon 1" />
                <div className="px-4 pb-5 pt-4 text-center sm:pb-6 sm:pt-5">
                  <p className="text-[13px] tracking-[1.5px] text-white/75">PASLON 01</p>
                  <p className="my-2 text-lg leading-[1.3] sm:my-3 sm:text-xl">Rifqi Ramadhani<br />M Naufal Zhafran</p>
                  <button
                    className="min-w-[150px] rounded-full border-2 border-white bg-transparent px-6 py-2.5 text-base transition hover:bg-white hover:text-[#c2410c] disabled:cursor-not-allowed disabled:opacity-55"
                    onClick={() => castVote("paslon1")}
                    disabled={submitting || alreadyVoted}
                  >
                    {submitting ? "MEMPROSES..." : "PILIH"}
                  </button>
                </div>
              </article>

              <article className="w-full max-w-[360px] overflow-hidden rounded-xl border border-white/15 bg-white/5 transition hover:-translate-y-2 hover:border-white/30 hover:shadow-soft">
                <img className="block aspect-video w-full object-cover" src="/fe/kotakkosong.jpg" alt="Kotak Kosong" />
                <div className="px-4 pb-5 pt-4 text-center sm:pb-6 sm:pt-5">
                  <p className="text-[13px] tracking-[1.5px] text-white/75">KOTAK KOSONG</p>
                  <p className="my-2 text-lg leading-[1.3] sm:my-3 sm:text-xl">Tidak memilih kandidat</p>
                  <button
                    className="min-w-[150px] rounded-full border-2 border-white bg-transparent px-6 py-2.5 text-base transition hover:bg-white hover:text-[#c2410c] disabled:cursor-not-allowed disabled:opacity-55"
                    onClick={() => castVote("kotak_kosong")}
                    disabled={submitting || alreadyVoted}
                  >
                    {submitting ? "MEMPROSES..." : "PILIH"}
                  </button>
                </div>
              </article>
            </div>
          </div>
        </div>
      </div>

      <div className={`${view === "success" ? "opacity-100" : "pointer-events-none opacity-0"} absolute inset-0 transition-opacity duration-300`}>
        <div
          className="relative flex min-h-screen items-center justify-center bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/fe/background-voting.png')" }}
        >
          <div className="noise-overlay pointer-events-none absolute inset-0 z-[1] opacity-10" />
          <div className="z-[2] mx-4 w-full max-w-[520px] rounded-xl border border-white/15 bg-black/40 px-5 py-7 text-center shadow-soft sm:px-8 sm:py-10">
            <h1 className="text-3xl font-bold sm:text-4xl">VOTE RECORDED</h1>
            <p className="mt-3 text-sm sm:text-base">Terima kasih telah menggunakan Hak Pilih Anda.</p>
            <p className="mt-3 break-all font-mono text-xs tracking-wide text-white/85">
              Transaction ID: {txHash ? txShort(txHash) : "(tersimpan)"}
            </p>
            <button
              className="mt-6 rounded-full border-2 border-white bg-transparent px-7 py-2.5 text-sm transition hover:bg-white hover:text-[#c2410c] sm:px-8 sm:py-3 sm:text-base"
              onClick={() => router.push("/")}
            >
              BACK TO HOME
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
