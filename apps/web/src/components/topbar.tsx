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
    // Use server-side redirect so local cookie and CAS SSO session are both terminated.
    window.location.href = `${API_BASE}/auth/logout`;
  }

  return (
    <header className="card topbar">
      <Link href="/" className="brand">
        IMSS Voting
      </Link>
      <div className="row">
        {me.authenticated ? (
          <>
            <span className="muted">{me.user?.email || "Mahasiswa UI"}</span>
            {me.user?.isAdmin ? <Link href="/admin">Admin Panel</Link> : null}
            <button onClick={logout}>Logout</button>
          </>
        ) : (
          <a href={loginHref}>Login SSO UI</a>
        )}
      </div>
    </header>
  );
}
