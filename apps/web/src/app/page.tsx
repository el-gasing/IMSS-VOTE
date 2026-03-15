"use client";

import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();

  return (
    <section className="main-flow-no-select relative min-h-screen w-full overflow-hidden text-[#f6f4f2]">
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
          className="smoke-flow pointer-events-none absolute bottom-0 left-[47%] z-[1] w-[190%] max-w-none -translate-x-1/2 opacity-60 max-[768px]:left-[-48%] max-[768px]:w-[258%] max-[430px]:left-[-22%] max-[430px]:w-[240%] md:left-0 md:w-full md:max-w-full md:translate-x-0"
          src="/fe/smoke.svg"
          alt=""
        />

        <div className="z-[2] mx-4 w-full max-w-4xl px-6 py-12 text-center md:px-10 md:py-14">
          <h1 className="text-[clamp(34px,5.6vw,72px)] font-bold leading-[0.95] tracking-[0.5px] text-[#f6f4f2] drop-shadow-[4px_4px_0_rgba(0,0,0,0.45)]">
            Pengumuman Pemira IMSS UI
          </h1>
          <p className="mt-4 text-[clamp(15px,1.8vw,24px)] font-semibold text-[#f2d493]">
            Hasil akhir telah dipublikasikan. Lihat rekap suara lengkap sekarang.
          </p>
          <button
            className="mt-8 rounded-2xl border-2 border-[#f2d493] bg-[#f2d493] px-12 py-4 text-lg font-bold tracking-[0.4px] text-[#3a171d] transition hover:scale-[1.02] hover:bg-transparent hover:text-[#f2d493]"
            onClick={() => router.push("/results")}
          >
            LIHAT HASIL RESMI
          </button>
        </div>
      </div>
    </section>
  );
}
