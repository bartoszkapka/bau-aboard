"use client";
import { useEffect, useRef, useState, useCallback } from "react";

export function useGame(code, role, pid, intervalMs = 1000) {
  const [view, setView] = useState(null);
  const [error, setError] = useState(null);
  const stop = useRef(false);

  const fetchOnce = useCallback(async () => {
    if (!code) return;
    try {
      const q = new URLSearchParams({ role });
      if (pid) q.set("pid", pid);
      const res = await fetch(`/api/game/${code}?${q.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Blad polaczenia");
        return;
      }
      const data = await res.json();
      setError(null);
      setView(data);
    } catch {
      setError("Brak polaczenia");
    }
  }, [code, role, pid]);

  useEffect(() => {
    stop.current = false;
    fetchOnce();
    const t = setInterval(() => {
      if (!stop.current) fetchOnce();
    }, intervalMs);
    return () => {
      stop.current = true;
      clearInterval(t);
    };
  }, [fetchOnce, intervalMs]);

  return { view, error, refresh: fetchOnce };
}

// zwraca pozostale sekundy na podstawie state.timer
export function useCountdown(timer) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, []);
  if (!timer || !timer.running || !timer.startedAt || !timer.durationSec) return null;
  const elapsed = (now - timer.startedAt) / 1000;
  const left = Math.max(0, timer.durationSec - elapsed);
  return { left, total: timer.durationSec, pct: Math.max(0, Math.min(1, left / timer.durationSec)) };
}
