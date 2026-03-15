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
    <section className="main-flow-no-select mx-auto grid min-h-screen w-full max-w-3xl place-items-center px-4 py-10">
      <div className="rounded-2xl border border-white/15 bg-black/35 p-8 shadow-soft">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#f2d493]">Selesai</p>
        <h1 className="mt-2 text-3xl font-bold">Terima kasih telah memilih</h1>
        <p className="mt-3 text-white/85">Pilihan Anda telah direkam pada sesi ini.</p>
        <p className="mt-1 text-sm text-white/65">Pilihan terakhir: {choiceLabel}</p>
        <Link className="mt-5 inline-block rounded-full border border-[#f2d493]/60 px-5 py-2 text-sm text-[#f2d493]" href="/">
          Kembali ke Beranda
        </Link>
      </div>
    </section>
  );
}
