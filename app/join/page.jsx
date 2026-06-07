"use client";
import { Suspense, useState } from "react";
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

  async function submit(e) {
    e.preventDefault();
    setErr("");
    const c = code.trim().toUpperCase();
    if (c.length < 4) return setErr("Wpisz poprawny kod gry");
    if (!tv && !name.trim()) return setErr("Podaj swoja nazwe");
    setBusy(true);
    try {
      const { player } = await api.post(`/api/game/${c}/join`, { name, emoji, isTV: tv });
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

        {!tv && (
          <>
            <div>
              <div className="label">Twoja nazwa</div>
              <input value={name} maxLength={24} onChange={(e) => setName(e.target.value)} placeholder="Gracz_1" />
            </div>
            <div>
              <div className="label">Twoje emoji — {emoji}</div>
              <div className="emoji-grid" style={{ marginTop: 6 }}>
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
          {busy ? "..." : tv ? "📺 Uruchom ekran" : "▶ Wchodze do gry"}
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
