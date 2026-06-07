"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [code, setCode] = useState("");

  function join(e) {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (c.length >= 4) router.push(`/join?code=${c}`);
  }

  return (
    <div className="screen center">
      <div className="wrap col" style={{ alignItems: "center", maxWidth: 720 }}>
        <div className="tag" style={{ marginBottom: 8 }}>◉ REC · CH-03 · SP</div>
        <h1 className="display ca-strong" style={{ fontSize: "clamp(44px,12vw,110px)" }}>
          VHS<br />QUIZ
        </h1>
        <p className="muted mono" style={{ letterSpacing: "0.2em", marginTop: 4 }}>
          PLAY · REWIND · SCORE
        </p>

        <form onSubmit={join} className="panel col" style={{ marginTop: 28, width: "min(440px, 90vw)" }}>
          <div className="label">Dolacz do gry — wpisz kod</div>
          <input
            className="code-input"
            value={code}
            maxLength={6}
            placeholder="000000"
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          <button className="btn btn-cyan btn-lg btn-block" type="submit">
            ▶ Dolacz
          </button>
        </form>

        <div className="row" style={{ marginTop: 22, justifyContent: "center" }}>
          <a className="btn btn-mag" href="/host">⌨ Panel hosta</a>
          <a className="btn btn-amber" href="/join?tv=1">📺 Tryb TV</a>
        </div>

        <p className="muted small mono" style={{ marginTop: 30, maxWidth: 420 }}>
          Host tworzy gre i steruje rozgrywka. Uczestnicy dolaczaja kodem na telefonie.
          Tryb TV wyswietla pytania i ranking na duzym ekranie.
        </p>
      </div>
    </div>
  );
}
