"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface MeResponse {
  authenticated: boolean;
  user?: { email: string; isAdmin?: boolean };
}

const API_BASE = "/api";

export function Topbar() {
  const [me, setMe] = useState<MeResponse>({ authenticated: false });
  const loginHref = `${API_BASE}/auth/cas/login?redirect=/vote`;

  useEffect(() => {
    fetch(`${API_BASE}/auth/me`, { credentials: "include" })
      .then(async (res) => (res.ok ? ((await res.json()) as MeResponse) : { authenticated: false }))
      .then(setMe)
      .catch(() => setMe({ authenticated: false }));
  }, []);

  function logout(): void {
    window.location.href = `${API_BASE}/auth/logout`;
  }

  return (
    <header className="mx-auto mt-4 flex w-full max-w-6xl items-center justify-between rounded-2xl border border-white/15 bg-black/35 px-5 py-3 shadow-soft">
      <Link href="/" className="text-lg font-semibold text-[#f2d493]">
        IMSS Voting
      </Link>
      <div className="flex items-center gap-3 text-sm">
        {me.authenticated ? (
          <>
            <span className="hidden text-white/80 sm:inline">{me.user?.email || "Mahasiswa UI"}</span>
            {me.user?.isAdmin ? (
              <Link href="/admin" className="rounded-full border border-[#f2d493]/50 px-3 py-1 text-[#f2d493]">
                Admin Panel
              </Link>
            ) : null}
            <button
              className="rounded-full border border-white/30 px-3 py-1 text-white/90 transition hover:bg-white/10"
              onClick={logout}
            >
              Logout
            </button>
          </>
        ) : (
          <a className="rounded-full border border-[#f2d493]/50 px-3 py-1 text-[#f2d493]" href={loginHref}>
            Login SSO UI
          </a>
        )}
      </div>
    </header>
  );
}
