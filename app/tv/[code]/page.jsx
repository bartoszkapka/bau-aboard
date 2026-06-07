"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useGame, useCountdown } from "@/lib/hooks";

const KEYS = ["A", "B", "C", "D"];

export default function TVPage() {
  const { code } = useParams();
  const [pid, setPid] = useState(null);
  useEffect(() => {
    setPid(localStorage.getItem(`vhsquiz:pid:${code}`) || null);
  }, [code]);

  const { view, error } = useGame(code, "tv", pid, 1000);
  const cd = useCountdown(view?.state?.timer);

  if (error && !view) return <div className="screen center"><div className="panel">⚠ {error}</div></div>;
  if (!view) return <div className="screen center"><div className="display ca-strong" style={{ fontSize: 50 }}>VHS QUIZ</div></div>;

  const state = view.state;
  const q = view.question;
  const players = view.players;
  const correctId = q?.correctOptionId;
  const winner = players.find((p) => p.id === state.buzzerWinnerId);

  const eligibleNames = (state.eligibleIds || [])
    .map((id) => players.find((p) => p.id === id))
    .filter(Boolean);

  return (
    <div className="screen">
      {/* GORNY PASEK */}
      <div className="spread" style={{ marginBottom: 18 }}>
        <div className="display ca" style={{ fontSize: 28 }}>VHS·QUIZ</div>
        <div className="row" style={{ gap: 14 }}>
          {state.phase !== "lobby" && <span className="tag">RUNDA {state.round}</span>}
          <span className="tag" style={{ color: "var(--amber)", borderColor: "var(--amber)" }}>KOD&nbsp;&nbsp;{code}</span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20, alignItems: "start" }}>
        {/* GLOWNA SCENA */}
        <div>
          {state.phase === "lobby" && (
            <div className="panel center" style={{ minHeight: "70vh" }}>
              <div className="label">Dolacz na telefonie — wejdz na strone i wpisz kod</div>
              <div className="big-code ca-strong">{code}</div>
              <div className="pill" style={{ marginTop: 10 }}>{players.length} graczy</div>
              <div className="row" style={{ justifyContent: "center", marginTop: 26, maxWidth: 700 }}>
                {players.map((p) => (
                  <span key={p.id} className="tag" style={{ fontSize: 18 }}>{p.emoji} {p.name}</span>
                ))}
              </div>
            </div>
          )}

          {state.phase === "category" && (
            <div className="panel" style={{ minHeight: "70vh" }}>
              <div className="label" style={{ textAlign: "center", marginBottom: 18 }}>WYBIERZ KATEGORIE</div>
              <div className="tiles">
                {view.shownCategories.map((c) => (
                  <div
                    key={c.id}
                    className={`tile ${state.selectedCategoryId === c.id ? "selected" : ""}`}
                    style={{ "--c": c.color }}
                  >
                    {c.name}
                  </div>
                ))}
              </div>
            </div>
          )}

          {(state.phase === "question" || state.phase === "reveal") && q && (
            <div className="panel col" style={{ minHeight: "70vh" }}>
              {cd && (
                <div>
                  <div className="timer-bar" style={{ height: 18 }}>
                    <div className="timer-fill" style={{ width: `${cd.pct * 100}%` }} />
                  </div>
                  <div className="display" style={{ textAlign: "center", fontSize: 28, marginTop: 6, color: cd.left < 6 ? "var(--magenta)" : "var(--amber)" }}>
                    {Math.ceil(cd.left)}
                  </div>
                </div>
              )}

              <div className="ca-strong" style={{ fontSize: "clamp(28px,3.4vw,48px)", lineHeight: 1.1, textAlign: "center" }}>
                {q.text}
              </div>

              {q.media && (
                <div className="media-box" style={{ textAlign: "center" }}>
                  {q.media.type === "image" && <img src={q.media.url} alt="" />}
                  {q.media.type === "video" && <video src={q.media.url} controls autoPlay />}
                  {q.media.type === "audio" && <audio src={q.media.url} controls autoPlay style={{ width: "60%" }} />}
                </div>
              )}

              {/* kto odpowiada */}
              <div className="row" style={{ justifyContent: "center" }}>
                {state.answerMode === "all" && <span className="pill">Odpowiadaja wszyscy</span>}
                {state.answerMode === "buzzer" && state.buzzerOpen && (
                  <span className="pill" style={{ borderColor: "var(--magenta)", color: "var(--magenta)" }}>🔴 BUZZER OTWARTY</span>
                )}
                {state.answerMode === "buzzer" && winner && (
                  <span className="pill" style={{ borderColor: "var(--green)", color: "var(--green)" }}>{winner.emoji} {winner.name} ma glos!</span>
                )}
                {state.answerMode === "select" && eligibleNames.map((p) => (
                  <span key={p.id} className="pill">{p.emoji} {p.name}</span>
                ))}
              </div>

              {q.type === "closed" && state.answersRevealed && (
                <div className="answers-grid">
                  {q.options.map((o, i) => {
                    const isCorrect = state.correctRevealed && correctId === o.id;
                    const cls = ["answer", `opt-${i}`, isCorrect ? "correct" : "", state.correctRevealed && !isCorrect ? "wrong" : ""].join(" ");
                    return (
                      <div key={o.id} className={cls}>
                        <span className="key">{KEYS[i]}</span>
                        <span className="txt">{o.text}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {q.type === "open" && state.correctRevealed && (
                <div className="panel center">
                  <div className="label">POPRAWNA ODPOWIEDZ</div>
                  <div className="display ca" style={{ color: "var(--green)", fontSize: 34 }}>{q.correctAnswer}</div>
                </div>
              )}

              {q.type === "closed" && !state.answersRevealed && (
                <div className="center" style={{ minHeight: 120 }}>
                  <div className="mono muted">Warianty pojawia sie za chwile...</div>
                </div>
              )}
            </div>
          )}

          {state.status === "ended" && (
            <div className="panel center" style={{ minHeight: "70vh" }}>
              <div className="display ca-strong" style={{ fontSize: 56 }}>KONIEC!</div>
              {players[0] && (
                <div style={{ marginTop: 20 }}>
                  <div className="display" style={{ fontSize: 36 }}>{players[0].emoji} {players[0].name}</div>
                  <div className="display" style={{ color: "var(--amber)", fontSize: 30 }}>{players[0].score} pkt</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* RANKING */}
        <div className="panel col" style={{ position: "sticky", top: 16 }}>
          <div className="label">RANKING</div>
          {players.length === 0 && <div className="mono muted small">Brak graczy</div>}
          {players.slice(0, 12).map((p, i) => (
            <div key={p.id} className={`rank-row ${i === 0 ? "top1" : ""}`} style={{ fontSize: 20, padding: "8px 12px" }}>
              <span className="rank-pos" style={{ fontSize: 22, width: 34 }}>{i + 1}</span>
              <span className="rank-emoji" style={{ fontSize: 24 }}>{p.emoji}</span>
              <span className="rank-name" style={{ fontSize: 18, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
              <span className="rank-score" style={{ fontSize: 20 }}>{p.score}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
