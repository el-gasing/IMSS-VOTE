"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

interface MeResponse {
  authenticated: boolean;
  user?: { email: string; sub: string };
}

const API_BASE = "/api";

export default function HomePage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [toast, setToast] = useState("");
  const [navigating, setNavigating] = useState(false);
  const [shake, setShake] = useState(false);

  const toastVisible = useMemo(() => Boolean(toast), [toast]);

  useEffect(() => {
    async function bootstrap(): Promise<void> {
      try {
        const meRes = await fetch(`${API_BASE}/auth/me`, { credentials: "include" });
        const meData = (meRes.ok ? await meRes.json() : { authenticated: false }) as MeResponse;
        setIsAuthenticated(Boolean(meData.authenticated));

        if (!meData.authenticated) {
          return;
        }

        const voteStatusRes = await fetch(`${API_BASE}/vote/status`, { credentials: "include" });
        if (voteStatusRes.ok) {
          const voteStatus = (await voteStatusRes.json()) as { hasVoted?: boolean };
          setHasVoted(Boolean(voteStatus.hasVoted));
        }
      } finally {
        setChecking(false);
      }
    }

    bootstrap().catch(() => setChecking(false));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!shake) return;
    const timer = setTimeout(() => setShake(false), 450);
    return () => clearTimeout(timer);
  }, [shake]);

  function showAlreadyVotedToast(): void {
    setToast("Anda sudah menggunakan hak pilih");
    setShake(false);
    requestAnimationFrame(() => setShake(true));
  }

  function handleVoteNow(): void {
    if (navigating || checking) return;

    if (!isAuthenticated) {
      window.location.href = `${API_BASE}/auth/cas/login?redirect=/vote`;
      return;
    }

    if (hasVoted) {
      showAlreadyVotedToast();
      return;
    }

    setNavigating(true);
    router.push("/vote");
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

      <div
        className="relative flex min-h-screen items-center justify-center bg-[#7a3139] bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/fe/imss-home.png')" }}
      >
        <div className="noise-overlay pointer-events-none absolute inset-0 z-[1] opacity-10" />

        <div className="absolute left-3 top-0 z-[2] flex items-start md:left-10 md:top-0">
          <img className="h-[clamp(34px,8vw,80px)] w-auto" src="/fe/logo-imss.png" alt="IMSS Logo" />
          <img className="h-[clamp(34px,8vw,80px)] w-auto" src="/fe/logo-ui.png" alt="UI Logo" />
        </div>

        <div className="font-lydian absolute right-4 top-4 z-[2] text-left text-[clamp(16px,3.6vw,40px)] leading-[0.92] tracking-[-0.5px] text-[#e8e8e8] drop-shadow-[3px_3px_0_rgba(0,0,0,0.45)] md:right-10 md:top-8">
          Sipakatau
          <br />
          Sipakalebbi
          <br />
          Sipakainge
        </div>

        <img className="pointer-events-none absolute left-[-18%] top-[40%] z-0 w-[clamp(140px,40vw,420px)] -translate-y-1/2 md:left-[-6%] md:top-[42%] md:w-[clamp(180px,28vw,420px)]" src="/fe/cloud-left.svg" alt="" />
        <img className="pointer-events-none absolute right-[-18%] top-[40%] z-0 w-[clamp(140px,40vw,420px)] -translate-y-1/2 md:right-[-6%] md:top-[42%] md:w-[clamp(180px,28vw,420px)]" src="/fe/cloud-right.svg" alt="" />
        <img className="pointer-events-none absolute bottom-0 left-1/2 z-0 w-[175%] max-w-none -translate-x-1/2 md:left-0 md:w-full md:max-w-full md:translate-x-0" src="/fe/cloud-bottom.svg" alt="" />
        <img
          className="smoke-flow pointer-events-none absolute bottom-0 left-[47%] z-[1] w-[190%] max-w-none -translate-x-1/2 opacity-60 max-[700px]:left-[-18%] max-[700px]:w-[238%] max-[430px]:left-[-22%] max-[430px]:w-[240%] md:left-0 md:w-full md:max-w-full md:translate-x-0"
          src="/fe/smoke.svg"
          alt=""
        />

        <div className="z-[2] w-full max-w-[800px] translate-y-[18px] px-5 text-center md:-translate-y-6">
          <h1 className="mb-5 text-[clamp(34px,5vw,64px)] font-bold tracking-[1px]">PEMIRA IMSS UI</h1>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              className={`rounded-full border-2 border-white bg-transparent px-8 py-3 text-base font-medium text-white transition hover:bg-white hover:text-[#c2410c] disabled:cursor-wait disabled:opacity-70 ${
                shake ? "btn-shake" : ""
              }`}
              onClick={handleVoteNow}
              disabled={checking || navigating}
            >
              {checking ? "CHECKING..." : hasVoted ? "SUDAH VOTE" : "VOTE NOW"}
            </button>
            <button
              className="rounded-full border-2 border-[#f2d493] bg-black/20 px-8 py-3 text-base font-semibold text-[#f2d493] transition hover:bg-[#f2d493] hover:text-[#3a171d]"
              onClick={() => router.push("/logs")}
            >
              VIEW LOGS
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
