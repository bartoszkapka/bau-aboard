"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";

const EMOJIS = ["🎮","👾","🕹️","🤖","👽","💀","🦄","🐉","🔥","⚡","🌟","💎","🎲","🎯","🚀","🛸","🦊","🐙","🦖","🍕","🍄","🎸","🎧","📼","💾","🧠","👑","🃏"];

function Inner() {
  const router = useRouter();
  const sp = useSearchParams();
  const [code, setCode] = useState((sp.get("code") || "").toUpperCase());
  const [tv, setTv] = useState(sp.get("tv") === "1");
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🎮");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [resume, setResume] = useState(null); // istniejacy gracz na tym urzadzeniu

  // Sprawdz, czy na tym urzadzeniu jest juz zapisany gracz dla tego kodu
  useEffect(() => {
    setResume(null);
    const c = code.trim().toUpperCase();
    if (tv || c.length < 4) return;
    const pid = typeof window !== "undefined" ? localStorage.getItem(`vhsquiz:pid:${c}`) : null;
    if (!pid) return;
    let alive = true;
    (async () => {
      try {
        const v = await api.get(`/api/game/${c}?role=player&pid=${pid}`);
        const me = v?.players?.find((p) => p.id === pid);
        if (alive && me) {
          setResume({ pid, ...me });
          setName((n) => n || me.name);
          setEmoji(me.emoji || "🎮");
        }
      } catch { /* gra moze nie istniec - ignorujemy */ }
    })();
    return () => { alive = false; };
  }, [code, tv]);

  function continueGame() {
    const c = code.trim().toUpperCase();
    router.push(`/play/${c}`);
  }

  async function submit(e) {
    e.preventDefault();
    setErr("");
    const c = code.trim().toUpperCase();
    if (c.length < 4) return setErr("Wpisz poprawny kod gry");
    if (!tv && !name.trim()) return setErr("Podaj swoja nazwe");
    setBusy(true);
    try {
      const storedPid = typeof window !== "undefined" ? localStorage.getItem(`vhsquiz:pid:${c}`) : null;
      const { player } = await api.post(`/api/game/${c}/join`, {
        name,
        emoji: emoji || "🎮",
        isTV: tv,
        pid: tv ? undefined : storedPid || undefined,
      });
      if (typeof window !== "undefined") localStorage.setItem(`vhsquiz:pid:${c}`, player.id);
      router.push(tv ? `/tv/${c}` : `/play/${c}`);
    } catch (e2) {
      setErr(e2.message);
      setBusy(false);
    }
  }

  return (
    <div className="screen center">
      <div className="panel col" style={{ width: "min(480px, 92vw)" }}>
        <h2 className="display ca" style={{ fontSize: 30, textAlign: "center" }}>
          {tv ? "TRYB TV" : "DOLACZ"}
        </h2>

        <div>
          <div className="label">Kod gry</div>
          <input
            className="code-input"
            value={code}
            maxLength={6}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="000000"
          />
        </div>

        <div className="row" style={{ justifyContent: "center" }}>
          <button className={`btn ${!tv ? "btn-cyan active" : ""}`} onClick={() => setTv(false)} type="button">
            🎮 Uczestnik
          </button>
          <button className={`btn ${tv ? "btn-amber active" : ""}`} onClick={() => setTv(true)} type="button">
            📺 Ekran TV
          </button>
        </div>

        {/* Powrot do gry na tym samym urzadzeniu */}
        {!tv && resume && (
          <div className="panel" style={{ padding: 12, borderColor: "var(--green)" }}>
            <div className="mono" style={{ marginBottom: 8 }}>
              Wykryto Twoja gre na tym urzadzeniu: <b>{resume.emoji} {resume.name}</b> ({resume.score} pkt)
            </div>
            <button className="btn btn-green btn-block" type="button" onClick={continueGame}>
              ▶ WROC DO GRY
            </button>
          </div>
        )}

        {!tv && (
          <>
            <div>
              <div className="label">Twoja nazwa</div>
              <input value={name} maxLength={24} onChange={(e) => setName(e.target.value)} placeholder="Gracz_1" />
            </div>
            <div>
              <div className="label">Twoje emoji</div>
              <div className="field-row" style={{ marginTop: 6 }}>
                <input
                  value={emoji}
                  maxLength={8}
                  onChange={(e) => setEmoji(e.target.value)}
                  placeholder="np. 🐢"
                  style={{ width: 90, textAlign: "center", fontSize: 28 }}
                />
                <span className="mono small muted">wpisz lub wklej dowolne emoji, albo wybierz ponizej</span>
              </div>
              <div className="emoji-grid" style={{ marginTop: 8 }}>
                {EMOJIS.map((em) => (
                  <button key={em} type="button" className={emoji === em ? "sel" : ""} onClick={() => setEmoji(em)}>
                    {em}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {err && <div className="mono small" style={{ color: "var(--magenta)" }}>⚠ {err}</div>}

        <button className={`btn btn-lg btn-block ${tv ? "btn-amber" : "btn-cyan"}`} onClick={submit} disabled={busy}>
          {busy ? "..." : tv ? "📺 Uruchom ekran" : resume ? "▶ Dolacz jako nowy / zaktualizuj" : "▶ Wchodze do gry"}
        </button>
        <a className="btn btn-sm" href="/" style={{ alignSelf: "center" }}>← powrot</a>
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={<div className="screen center"><div className="display ca">...</div></div>}>
      <Inner />
    </Suspense>
  );
}
