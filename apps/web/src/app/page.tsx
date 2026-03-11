"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./home.module.css";

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
    <section className={styles.root}>
      <div className={`${styles.toast} ${toastVisible ? styles.toastShow : ""}`}>{toast || "-"}</div>
      <div className={styles.page}>
        <div className={styles.texture} />

        <div className={styles.homeLogos}>
          <img className={styles.homeLogo} src="/fe/logo-imss.png" alt="IMSS Logo" />
          <img className={styles.homeLogo} src="/fe/logo-ui.png" alt="UI Logo" />
        </div>

        <div className={styles.slogan}>
          Sipakatau
          <br />
          Sipakalebbi
          <br />
          Sipakainge
        </div>

        <img className={styles.cloudLeft} src="/fe/cloud-left.svg" alt="" />
        <img className={styles.cloudRight} src="/fe/cloud-right.svg" alt="" />
        <img className={styles.cloudBottom} src="/fe/cloud-bottom.svg" alt="" />
        <img className={styles.smokeBottom} src="/fe/smoke.svg" alt="" />

        <div className={styles.hero}>
          <h1 className={styles.homeTitle}>PEMIRA IMSS UI</h1>
          <button
            className={`${styles.voteBtn} ${shake ? styles.shake : ""}`}
            onClick={handleVoteNow}
            disabled={checking || navigating}
          >
            {checking ? "CHECKING..." : hasVoted ? "SUDAH VOTE" : "VOTE NOW"}
          </button>
        </div>
      </div>
    </section>
  );
}
