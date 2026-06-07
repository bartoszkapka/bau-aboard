"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useGame, useCountdown } from "@/lib/hooks";

const KEYS = ["A", "B", "C", "D"];
const PCOLORS = ["#23e0c8", "#ff2d78", "#ffd23f", "#7c5cff", "#3fa7ff", "#ff7a2d", "#00e676", "#e0e0e0"];

function fmtVal(type, v) {
  if (v == null || isNaN(v)) return "—";
  if (type === "time") {
    const m = ((Math.round(v) % 1440) + 1440) % 1440;
    return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
  }
  return String(v);
}

/* Koło fortuny — losuje raz po ujawnieniu */
function Wheel({ chance, manipulated, revealed }) {
  const [rot, setRot] = useState(0);
  const done = useRef(false);
  useEffect(() => {
    if (revealed && !done.current) {
      done.current = true;
      const manipDeg = Math.max(8, Math.min(352, (chance || 0) * 360));
      // strefa manipulacji: 0..manipDeg ; bezpieczna: reszta
      const target = manipulated
        ? Math.random() * (manipDeg - 6) + 3
        : manipDeg + Math.random() * (360 - manipDeg - 6) + 3;
      // wskaznik u gory (0 deg) -> obracamy kolo tak, by docelowy kat trafil pod wskaznik
      setRot(360 * 5 + (360 - target));
    }
    if (!revealed) { done.current = false; setRot(0); }
  }, [revealed, manipulated, chance]);

  const manipDeg = Math.max(8, Math.min(352, (chance || 0) * 360));
  const bg = `conic-gradient(var(--magenta) 0deg ${manipDeg}deg, var(--cyan) ${manipDeg}deg 360deg)`;
  return (
    <div className="wheel-wrap">
      <div className="label">KOSMICZNA MANIPULACJA — szansa {Math.round((chance || 0) * 100)}%</div>
      <div className="wheel-stage">
        <div className="wheel-ptr" />
        <div className="wheel" style={{ background: bg, transform: `rotate(${rot}deg)` }} />
      </div>
      {revealed && (
        <div className="display" style={{ fontSize: 24, color: manipulated ? "var(--magenta)" : "var(--cyan)" }}>
          {manipulated ? "MANIPULACJA!" : "BEZ MANIPULACJI"}
        </div>
      )}
    </div>
  );
}

/* Animacja slupkow szacowania */
function Bars({ fin, players }) {
  const ids = fin.duelIds || [];
  const revealed = !!fin.revealed;
  const target = revealed ? fin.manipValue : null;
  const vals = ids.map((id) => (revealed ? (fin.estimates?.[id] ?? null) : null));
  const maxV = Math.max(1, target || 0, ...vals.map((v) => v || 0)) * 1.15;
  const pmap = {}; for (const p of players) pmap[p.id] = p;

  return (
    <div className="panel col" style={{ alignItems: "center" }}>
      <div className="label">SZACOWANIE</div>
      <div className="est-wrap">
        {revealed && target != null && (
          <div className="est-target show" style={{ bottom: `${Math.min(100, (target / maxV) * 100)}%` }} />
        )}
        {ids.map((id, i) => {
          const v = vals[i];
          const h = revealed && v != null ? Math.min(100, (v / maxV) * 100) : 0;
          const isWin = revealed && fin.winnerId === id;
          return (
            <div className="est-col" key={id}>
              <div className="est-name" style={{ color: isWin ? "var(--green)" : "var(--text)" }}>
                {pmap[id]?.emoji} {pmap[id]?.name}
              </div>
              <div className="est-track">
                <div className={"est-bar" + (i % 2 ? " mag" : "")} style={{ height: `${h}%` }} />
              </div>
              <div className="est-val">{revealed ? fmtVal(fin.estimateType, v) : "?"}</div>
              {isWin && <div className="mono" style={{ color: "var(--green)" }}>WYGRANA</div>}
            </div>
          );
        })}
      </div>
      {revealed && (
        <div className="display" style={{ fontSize: 26, color: "var(--amber)" }}>
          Poprawna{fin.manipulated ? " (zmanipulowana)" : ""}: {fmtVal(fin.estimateType, fin.manipValue)}
        </div>
      )}
    </div>
  );
}

function Board({ view }) {
  const t = view.territory;
  const players = view.players;
  const cats = view.categories || [];
  const catMap = {}; for (const c of cats) catMap[c.id] = c;
  const colorOf = useMemo(() => {
    const m = { aliens: "var(--green)" };
    players.forEach((p, i) => { m[p.id] = PCOLORS[i % PCOLORS.length]; });
    return m;
  }, [players]);
  if (!t) return null;
  const duel = t.duel;
  const owners = {};
  for (const c of t.cells) if (c.owner !== "aliens") owners[c.owner] = (owners[c.owner] || 0) + 1;
  const aliensCount = t.cells.filter((c) => c.owner === "aliens").length;

  return (
    <div className="panel col" style={{ minHeight: "70vh" }}>
      <div className="label" style={{ textAlign: "center" }}>STATEK UFO — WALKA O TERYTORIUM</div>
      <div className="board" style={{ gridTemplateColumns: `repeat(${t.size}, 1fr)` }}>
        {t.cells.map((c) => {
          const col = colorOf[c.owner] || "var(--line)";
          const isTarget = duel && duel.fieldIdx === c.idx;
          const emoji = c.owner === "aliens" ? "👽" : (players.find((p) => p.id === c.owner)?.emoji || "·");
          return (
            <div key={c.idx} className={"cell" + (isTarget ? " target" : "")}
              style={{ borderColor: col, boxShadow: `inset 0 0 18px ${col}55` }}>
              <span className="cell-own">{emoji}</span>
              <span className="cell-cat" style={{ color: catMap[c.categoryId]?.color || "var(--dim)" }}>
                {catMap[c.categoryId]?.name || ""}
              </span>
            </div>
          );
        })}
      </div>
      <div className="legend">
        <span className="lg"><span className="swatch" style={{ background: "var(--green)" }} /> 👽 Kosmici: {aliensCount}</span>
        {players.filter((p) => owners[p.id]).map((p, i) => (
          <span className="lg" key={p.id}>
            <span className="swatch" style={{ background: colorOf[p.id] }} /> {p.emoji} {p.name}: {owners[p.id]}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function TVPage() {
  const { code } = useParams();
  const { view, error } = useGame(code, "tv", null, 1000);
  const cd = useCountdown(view?.state?.timer);

  if (error && !view) return <div className="screen center"><div className="panel">⚠ {error}</div></div>;
  if (!view) return <div className="screen center"><div className="display ca-strong" style={{ fontSize: 50 }}>BAU ABOARD</div></div>;

  const state = view.state;
  const q = view.question;
  const players = view.players;
  const fin = view.final;
  const correctId = q?.correctOptionId;
  const winner = players.find((p) => p.id === state.buzzerWinnerId);
  const eligibleNames = (state.eligibleIds || []).map((id) => players.find((p) => p.id === id)).filter(Boolean);

  const showQuestionScene = (state.phase === "question" || state.phase === "reveal" || (state.phase === "territory" && q)) && q;

  return (
    <div className="screen">
      <div className="spread" style={{ marginBottom: 18 }}>
        <div className="display ca" style={{ fontSize: 28 }}>BAU·ABOARD</div>
        <div className="row" style={{ gap: 14 }}>
          {state.phase !== "lobby" && <span className="tag">RUNDA {state.round} · {state.roundType === "territory" ? "TERYTORIUM" : state.roundType === "final" ? "FINAL" : "KLASYCZNA"}</span>}
          <span className="tag" style={{ color: "var(--amber)", borderColor: "var(--amber)" }}>KOD&nbsp;&nbsp;{code}</span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20, alignItems: "start" }}>
        <div>
          {state.phase === "lobby" && (
            <div className="panel center" style={{ minHeight: "70vh" }}>
              <div className="label">Dolacz na telefonie — wejdz na strone i wpisz kod</div>
              <div className="big-code ca-strong">{code}</div>
              <div className="pill" style={{ marginTop: 10 }}>{players.length} graczy</div>
              <div className="row" style={{ justifyContent: "center", marginTop: 26, maxWidth: 700 }}>
                {players.map((p) => <span key={p.id} className="tag" style={{ fontSize: 18 }}>{p.emoji} {p.name}</span>)}
              </div>
            </div>
          )}

          {state.phase === "category" && (
            <div className="panel" style={{ minHeight: "70vh" }}>
              <div className="label" style={{ textAlign: "center", marginBottom: 18 }}>WYBIERZ KATEGORIE</div>
              <div className="tiles">
                {view.shownCategories.map((c) => (
                  <div key={c.id} className={`tile ${state.selectedCategoryId === c.id ? "selected" : ""}`} style={{ "--c": c.color }}>{c.name}</div>
                ))}
              </div>
            </div>
          )}

          {/* TERYTORIUM: plansza + ewentualny pojedynek */}
          {state.phase === "territory" && (
            <div className="col">
              <Board view={view} />
              {q && (
                <div className="panel col">
                  <div className="label" style={{ color: "var(--amber)" }}>POJEDYNEK O POLE</div>
                  <div className="row" style={{ justifyContent: "center" }}>
                    {eligibleNames.map((p) => <span key={p.id} className="pill">{p.emoji} {p.name}</span>)}
                    {state.answerMode === "buzzer" && state.buzzerOpen && <span className="pill" style={{ borderColor: "var(--magenta)", color: "var(--magenta)" }}>🔴 BUZZER</span>}
                    {winner && <span className="pill" style={{ borderColor: "var(--green)", color: "var(--green)" }}>{winner.emoji} {winner.name} ma glos</span>}
                  </div>
                  <div className="ca-strong" style={{ fontSize: "clamp(22px,2.6vw,38px)", textAlign: "center" }}>{q.text}</div>
                  {q.type === "closed" && state.answersRevealed && (
                    <div className="answers-grid">
                      {q.options.map((o, i) => {
                        const isC = state.correctRevealed && correctId === o.id;
                        return <div key={o.id} className={["answer", `opt-${i}`, isC ? "correct" : ""].join(" ")}><span className="key">{KEYS[i]}</span><span className="txt">{o.text}</span></div>;
                      })}
                    </div>
                  )}
                  {q.type === "open" && state.correctRevealed && (
                    <div className="center"><div className="display ca" style={{ color: "var(--green)", fontSize: 30 }}>{q.correctAnswer}</div></div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* FINAL: szacowanie + kolo */}
          {state.phase === "final" && (
            <div className="col">
              <div className="panel col">
                <div className="label" style={{ color: "var(--green)" }}>RUNDA FINALOWA · SZACOWANIE</div>
                {q ? <div className="ca-strong" style={{ fontSize: "clamp(24px,3vw,42px)", textAlign: "center" }}>{q.text}</div>
                  : <div className="center mono muted" style={{ minHeight: 80 }}>Przygotowanie pytania finalowego...</div>}
                {q?.unit && <div className="mono muted" style={{ textAlign: "center" }}>jednostka: {q.unit}</div>}
              </div>
              {fin && (fin.questionId || fin.revealed) && <Bars fin={fin} players={players} />}
              {fin && <Wheel chance={fin.manipChance} manipulated={fin.manipulated} revealed={fin.revealed} />}
            </div>
          )}

          {showQuestionScene && (
            <div className="panel col" style={{ minHeight: "70vh" }}>
              {cd && (
                <div>
                  <div className="timer-bar" style={{ height: 18 }}><div className="timer-fill" style={{ width: `${cd.pct * 100}%` }} /></div>
                  <div className="display" style={{ textAlign: "center", fontSize: 28, marginTop: 6, color: cd.left < 6 ? "var(--magenta)" : "var(--amber)" }}>{Math.ceil(cd.left)}</div>
                </div>
              )}
              <div className="ca-strong" style={{ fontSize: "clamp(28px,3.4vw,48px)", lineHeight: 1.1, textAlign: "center" }}>
                {state.answerMode === "buzzer" && !state.buzzerOpen && !state.buzzerWinnerId
                  ? "PRZYGOTUJ SIE — BUZZER ZA CHWILE..."
                  : q.text}
              </div>
              {!(state.answerMode === "buzzer" && !state.buzzerOpen && !state.buzzerWinnerId) && q.media && (
                <div className="media-box" style={{ textAlign: "center" }}>
                  {q.media.type === "image" && <img src={q.media.url} alt="" />}
                  {q.media.type === "video" && <video src={q.media.url} controls autoPlay />}
                  {q.media.type === "audio" && <audio src={q.media.url} controls autoPlay style={{ width: "60%" }} />}
                </div>
              )}
              <div className="row" style={{ justifyContent: "center" }}>
                {state.answerMode === "all" && <span className="pill">Odpowiadaja wszyscy</span>}
                {state.answerMode === "buzzer" && state.buzzerOpen && <span className="pill" style={{ borderColor: "var(--magenta)", color: "var(--magenta)" }}>🔴 BUZZER OTWARTY</span>}
                {state.answerMode === "buzzer" && winner && <span className="pill" style={{ borderColor: "var(--green)", color: "var(--green)" }}>{winner.emoji} {winner.name} ma glos!</span>}
                {state.answerMode === "select" && eligibleNames.map((p) => <span key={p.id} className="pill">{p.emoji} {p.name}</span>)}
              </div>
              {q.type === "closed" && state.answersRevealed && (
                <div className="answers-grid">
                  {q.options.map((o, i) => {
                    const isCorrect = state.correctRevealed && correctId === o.id;
                    const cls = ["answer", `opt-${i}`, isCorrect ? "correct" : "", state.correctRevealed && !isCorrect ? "wrong" : ""].join(" ");
                    return <div key={o.id} className={cls}><span className="key">{KEYS[i]}</span><span className="txt">{o.text}</span></div>;
                  })}
                </div>
              )}
              {q.type === "open" && state.correctRevealed && (
                <div className="panel center"><div className="label">POPRAWNA ODPOWIEDZ</div><div className="display ca" style={{ color: "var(--green)", fontSize: 34 }}>{q.correctAnswer}</div></div>
              )}
              {q.type === "closed" && !state.answersRevealed && (
                <div className="center" style={{ minHeight: 120 }}><div className="mono muted">Warianty pojawia sie za chwile...</div></div>
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
