"use client";

import { useEffect } from "react";

const API_BASE = "/api";
const TAB_KEY = "imss_tab_session";

export function TabSessionGuard() {
  useEffect(() => {
    async function run(): Promise<void> {
      const hasTabSession = sessionStorage.getItem(TAB_KEY) === "1";
      if (hasTabSession) return;

      try {
        const meRes = await fetch(`${API_BASE}/auth/me`, { credentials: "include" });
        if (meRes.ok) {
          // Found leftover cookie session from previous tab/browser state.
          // Force full logout (local cookie + CAS session), then come back fresh.
          window.location.href = `${API_BASE}/auth/logout`;
          return;
        }
      } catch {
        // Ignore network errors and continue with local tab session marker.
      }

      sessionStorage.setItem(TAB_KEY, "1");
    }

    void run();
  }, []);

  return null;
}
