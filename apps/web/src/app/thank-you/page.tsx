"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function ThankYouPage() {
  const [choiceLabel, setChoiceLabel] = useState<string>("-");

  useEffect(() => {
    const vote = localStorage.getItem("imss_vote_choice");
    if (vote === "paslon1") {
      setChoiceLabel("Paslon 1");
      return;
    }
    if (vote === "kotak_kosong") {
      setChoiceLabel("Kotak Kosong");
      return;
    }
    setChoiceLabel("Tidak diketahui");
  }, []);

  return (
    <section className="card">
      <p className="kicker">Selesai</p>
      <h1>Terima kasih telah memilih</h1>
      <p>Pilihan Anda telah direkam pada sesi ini.</p>
      <p className="muted">Pilihan terakhir: {choiceLabel}</p>
      <Link href="/">Kembali ke Beranda</Link>
    </section>
  );
}
