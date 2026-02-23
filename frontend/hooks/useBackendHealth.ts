"use client";

import { useState, useEffect, useRef } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const POLL_INTERVAL_MS = 5000;

export interface BackendHealth {
  connected: boolean;
  oraclePrice: number;
  oracleStale: boolean;
  lastPushMs: number;
}

export function useBackendHealth(): BackendHealth {
  const [health, setHealth] = useState<BackendHealth>({
    connected: false,
    oraclePrice: 0,
    oracleStale: true,
    lastPushMs: 0,
  });
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        const res = await fetch(`${API_BASE}/api/health`, { signal: controller.signal });
        clearTimeout(timeout);
        if (cancelled) return;
        const data = await res.json();
        setHealth({
          connected: true,
          oraclePrice: data.oracle?.price ?? 0,
          oracleStale: data.oracle?.stale ?? true,
          lastPushMs: data.oracle?.lastPushMs ?? 0,
        });
      } catch {
        if (cancelled) return;
        setHealth((prev) => ({ ...prev, connected: false }));
      }
    }

    poll();
    timerRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return health;
}
