"use client";

export default function HomePage() {
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

        <img className="pointer-events-none absolute left-[-18%] top-[40%] z-0 w-[clamp(140px,40vw,420px)] -translate-y-1/2 md:left-[-6%] md:top-[42%] md:w-[clamp(180px,28vw,420px)]" src="/fe/cloud-left.svg" alt="" />
        <img className="pointer-events-none absolute right-[-18%] top-[40%] z-0 w-[clamp(140px,40vw,420px)] -translate-y-1/2 md:right-[-6%] md:top-[42%] md:w-[clamp(180px,28vw,420px)]" src="/fe/cloud-right.svg" alt="" />
        <img className="pointer-events-none absolute bottom-0 left-1/2 z-0 w-[175%] max-w-none -translate-x-1/2 md:left-0 md:w-full md:max-w-full md:translate-x-0" src="/fe/cloud-bottom.svg" alt="" />
        <img
          className="smoke-flow pointer-events-none absolute bottom-0 left-[47%] z-[1] w-[190%] max-w-none -translate-x-1/2 opacity-60 max-[768px]:left-[-48%] max-[768px]:w-[258%] max-[430px]:left-[-22%] max-[430px]:w-[240%] md:left-0 md:w-full md:max-w-full md:translate-x-0"
          src="/fe/smoke.svg"
          alt=""
        />

        <div className="z-[2] w-full max-w-[800px] translate-y-[18px] px-5 text-center md:-translate-y-6">
          <h1 className="font-lydian text-[clamp(56px,11vw,140px)] leading-[0.9] tracking-[2px] text-[#f6f4f2] drop-shadow-[4px_4px_0_rgba(0,0,0,0.45)]">
            IMSS UI
          </h1>
        </div>
      </div>
    </section>
  );
}
