"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./vote.module.css";

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
  const [me, setMe] = useState<MeResponse>({ authenticated: false });

  const toastVisible = useMemo(() => Boolean(toast), [toast]);

  useEffect(() => {
    async function bootstrap(): Promise<void> {
      try {
        const meRes = await fetch(`${API_BASE}/auth/me`, { credentials: "include" });
        const meData = (meRes.ok ? await meRes.json() : { authenticated: false }) as MeResponse;
        setMe(meData);

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
    return <section className={styles.loading}><p>Memuat sesi login...</p></section>;
  }

  return (
    <section className={styles.root}>
      <div className={`${styles.toast} ${toastVisible ? styles.toastShow : ""}`}>{toast || "-"}</div>

      <div className={`${styles.page} ${styles.vote} ${view === "vote" ? "" : styles.hidden}`}>
        <div className={styles.texture} />
        <button className={styles.voteBack} onClick={() => router.push("/")} aria-label="Kembali">←</button>

        <div className={styles.hero}>
          <h1 className={styles.voteTitle}>PILIH KETUA UMUM</h1>
          {error ? <p className={styles.error}>{error}</p> : null}

          <div className={styles.voteContainer}>
            <article className={styles.candidate}>
              <img src="/fe/Paslon1.jpg" alt="Paslon 1" />
              <div className={styles.candidateInfo}>
                <p className={styles.candidateNumber}>PASLON 01</p>
                <p className={styles.candidateName}>Rifqi Ramadhani<br />M Naufal Zhafran</p>
                <button className={styles.pickBtn} onClick={() => castVote("paslon1")} disabled={submitting || alreadyVoted}>
                  {submitting ? "MEMPROSES..." : "PILIH"}
                </button>
              </div>
            </article>

            <article className={styles.candidate}>
              <img src="/fe/kotakkosong.jpg" alt="Kotak Kosong" />
              <div className={styles.candidateInfo}>
                <p className={styles.candidateNumber}>KOTAK KOSONG</p>
                <p className={styles.candidateName}>Tidak memilih kandidat</p>
                <button className={styles.pickBtn} onClick={() => castVote("kotak_kosong")} disabled={submitting || alreadyVoted}>
                  {submitting ? "MEMPROSES..." : "PILIH"}
                </button>
              </div>
            </article>
          </div>
        </div>
      </div>

      <div className={`${styles.page} ${styles.success} ${view === "success" ? "" : styles.hidden}`}>
        <div className={styles.texture} />
        <div className={styles.hero}>
          <div className={styles.successBox}>
            <h1>VOTE RECORDED</h1>
            <p>Terima kasih telah menggunakan Hak Pilih Anda.</p>
            <p className={styles.tx}>Transaction ID: {txHash ? txShort(txHash) : "(tersimpan)"}</p>
            <br />
            <button className={styles.btn} onClick={() => router.push("/")}>BACK TO HOME</button>
          </div>
        </div>
      </div>
    </section>
  );
}
