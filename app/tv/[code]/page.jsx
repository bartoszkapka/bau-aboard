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
function precisionHint(type) {
  if (type === "time") return "Odpowiedz godzina (HH:MM)";
  if (type === "float") return "Odpowiedz liczba dziesietna";
  return "Odpowiedz liczba calkowita";
}

/* Koło fortuny — kreci sie gdy manipulacja zostanie wylosowana (przed odpowiedziami) */
function Wheel({ chance, manipulated, drawn }) {
  const [rot, setRot] = useState(0);
  const done = useRef(false);
  useEffect(() => {
    if (drawn && !done.current) {
      done.current = true;
      const manipDeg = Math.max(8, Math.min(352, (chance || 0) * 360));
      const target = manipulated ? Math.random() * (manipDeg - 6) + 3
        : manipDeg + Math.random() * (360 - manipDeg - 6) + 3;
      setRot(360 * 5 + (360 - target));
    }
    if (!drawn) { done.current = false; setRot(0); }
  }, [drawn, manipulated, chance]);

  const manipDeg = Math.max(8, Math.min(352, (chance || 0) * 360));
  const bg = `conic-gradient(var(--magenta) 0deg ${manipDeg}deg, var(--cyan) ${manipDeg}deg 360deg)`;
  // pozycje emoji w srodku kazdej strefy
  const polar = (deg) => {
    const rad = (deg - 90) * Math.PI / 180, r = 78;
    return { left: 120 + r * Math.cos(rad), top: 120 + r * Math.sin(rad) };
  };
  const pManip = polar(manipDeg / 2);
  const pSafe = polar(manipDeg + (360 - manipDeg) / 2);
  return (
    <div className="wheel-wrap">
      <div className="label">KOSMICZNA MANIPULACJA — szansa {Math.round((chance || 0) * 100)}%</div>
      <div className="wheel-stage">
        <div className="wheel-ptr" />
        <div className="wheel" style={{ background: bg, transform: `rotate(${rot}deg)` }}>
          <span className="wheel-emoji" style={{ left: pManip.left, top: pManip.top }}>👽</span>
          <span className="wheel-emoji" style={{ left: pSafe.left, top: pSafe.top }}>✅</span>
        </div>
      </div>
      {drawn && (
        <div className="display" style={{ fontSize: 24, color: manipulated ? "var(--magenta)" : "var(--cyan)" }}>
          {manipulated ? "MANIPULACJA! 👽" : "BEZ MANIPULACJI ✅"}
        </div>
      )}
    </div>
  );
}

/* Poziome slupki szacowania (animacja od zera) */
function Bars({ fin, players }) {
  const ids = fin.duelIds || [];
  const revealed = !!fin.revealed;
  const target = revealed ? fin.manipValue : null;
  const vals = ids.map((id) => (revealed ? (fin.estimates?.[id] ?? null) : null));
  const maxV = Math.max(1, target || 0, ...vals.map((v) => v || 0)) * 1.15;
  const pmap = {}; for (const p of players) pmap[p.id] = p;

  return (
    <div className="panel col">
      <div className="label">SZACOWANIE</div>
      <div className="est-wrap">
        {ids.map((id, i) => {
          const v = vals[i];
          const w = revealed && v != null ? Math.min(100, (v / maxV) * 100) : 0;
          const isWin = revealed && fin.winnerId === id;
          return (
            <div className="est-col" key={id}>
              <div className="est-name" style={{ color: isWin ? "var(--green)" : "var(--text)" }}>
                {pmap[id]?.emoji} {pmap[id]?.name}
              </div>
              <div className="est-track">
                <div className={"est-bar" + (i % 2 ? " mag" : "")} style={{ width: `${w}%` }} />
                {revealed && target != null && (
                  <div className="est-target show" style={{ left: `${Math.min(100, (target / maxV) * 100)}%` }} />
                )}
              </div>
              <div className="est-val">{revealed ? fmtVal(fin.estimateType, v) : "?"}</div>
              {isWin && <span className="mono" style={{ color: "var(--green)" }}>★</span>}
            </div>
          );
        })}
      </div>
      {revealed && (
        <div className="display" style={{ fontSize: 26, color: "var(--amber)", textAlign: "center" }}>
          Wartosc{fin.manipulated ? " (zmanipulowana)" : ""}: {fmtVal(fin.estimateType, fin.manipValue)}
          {fin.manipulated && (
            <div className="mono" style={{ fontSize: 16, color: "var(--dim)" }}>
              prawdziwa: {fmtVal(fin.estimateType, fin.correctValue)}
            </div>
          )}
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
          const p = players.find((pp) => pp.id === c.owner);
          const emoji = c.owner === "aliens" ? "👽" : (p?.emoji || "·");
          return (
            <div key={c.idx} className={"cell" + (isTarget ? " target" : "")}
              style={{ borderColor: col, boxShadow: `inset 0 0 18px ${col}55` }}>
              <span className="cell-own">{emoji}</span>
              <span className="cell-name">{c.owner === "aliens" ? "Kosmici" : (p?.name || "")}</span>
              <span className="cell-cat" style={{ color: catMap[c.categoryId]?.color || "var(--dim)" }}>
                {catMap[c.categoryId]?.name || ""}
              </span>
            </div>
          );
        })}
      </div>
      <div className="legend">
        <span className="lg"><span className="swatch" style={{ background: "var(--green)" }} /> 👽 Kosmici: {aliensCount}</span>
        {players.filter((p) => owners[p.id]).map((p) => (
          <span className="lg" key={p.id}>
            <span className="swatch" style={{ background: colorOf[p.id] }} /> {p.emoji} {p.name}: {owners[p.id]}
          </span>
        ))}
      </div>
    </div>
  );
}

function DuelQuestion({ view, cd }) {
  const state = view.state, q = view.question, players = view.players;
  const cats = view.categories || [];
  const catMap = {}; for (const c of cats) catMap[c.id] = c;
  const correctId = q?.correctOptionId;
  const winner = players.find((p) => p.id === state.buzzerWinnerId);
  const eligibleNames = (state.eligibleIds || []).map((id) => players.find((p) => p.id === id)).filter(Boolean);
  const t = view.territory, duel = t?.duel;
  const buzzerHidden = state.answerMode === "buzzer" && !state.buzzerOpen && !state.buzzerWinnerId;
  return (
    <div className="panel col" style={{ minHeight: "70vh" }}>
      <div className="label" style={{ color: "var(--amber)", textAlign: "center" }}>
        POJEDYNEK O POLE {duel ? "#" + duel.fieldIdx : ""} · {duel ? (catMap[t.cells[duel.fieldIdx]?.categoryId]?.name || "") : ""}
      </div>
      {cd && (
        <div>
          <div className="timer-bar" style={{ height: 18 }}><div className="timer-fill" style={{ width: `${cd.pct * 100}%` }} /></div>
          <div className="display" style={{ textAlign: "center", fontSize: 28, marginTop: 6, color: cd.left < 6 ? "var(--magenta)" : "var(--amber)" }}>{Math.ceil(cd.left)}</div>
        </div>
      )}
      <div className="ca-strong" style={{ fontSize: "clamp(24px,3vw,42px)", textAlign: "center" }}>
        {buzzerHidden ? "PRZYGOTUJ SIE — BUZZER ZA CHWILE..." : q.text}
      </div>
      <div className="row" style={{ justifyContent: "center" }}>
        {state.answerMode === "buzzer" && state.buzzerOpen && <span className="pill" style={{ borderColor: "var(--magenta)", color: "var(--magenta)" }}>🔴 BUZZER</span>}
        {winner && <span className="pill" style={{ borderColor: "var(--green)", color: "var(--green)" }}>{winner.emoji} {winner.name} ma glos</span>}
        {state.answerMode === "select" && eligibleNames.map((p) => <span key={p.id} className="pill">{p.emoji} {p.name}</span>)}
      </div>
      {!buzzerHidden && q.type === "closed" && state.answersRevealed && (
        <div className="answers-grid">
          {q.options.map((o, i) => {
            const isC = state.correctRevealed && correctId === o.id;
            return <div key={o.id} className={["answer", `opt-${i}`, isC ? "correct" : ""].join(" ")}><span className="key">{KEYS[i]}</span><span className="txt">{o.text}</span></div>;
          })}
        </div>
      )}
      {!buzzerHidden && q.type === "open" && state.correctRevealed && (
        <div className="center"><div className="display ca" style={{ color: "var(--green)", fontSize: 30 }}>{q.correctAnswer}</div></div>
      )}
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
  const cats = view.categories || [];
  const catMap = {}; for (const c of cats) catMap[c.id] = c;
  const correctId = q?.correctOptionId;
  const winner = players.find((p) => p.id === state.buzzerWinnerId);
  const eligibleNames = (state.eligibleIds || []).map((id) => players.find((p) => p.id === id)).filter(Boolean);
  const ended = state.status === "ended";
  const buzzerHidden = state.answerMode === "buzzer" && !state.buzzerOpen && !state.buzzerWinnerId;

  const showQuestionScene = !ended && (state.phase === "question" || state.phase === "reveal") && q;
  const selCat = catMap[state.selectedCategoryId];

  return (
    <div className="screen">
      <div className="spread" style={{ marginBottom: 18 }}>
        <div className="display ca" style={{ fontSize: 28 }}>BAU·ABOARD</div>
        <div className="row" style={{ gap: 14 }}>
          {state.phase !== "lobby" && !ended && (
            <span className="tag">
              RUNDA {state.round} · {state.roundType === "territory" ? "TERYTORIUM" : state.roundType === "final" ? "FINAL" : "KLASYCZNA"}
              {state.questionNumber > 0 ? ` · PYT. ${state.questionNumber}` : ""}
            </span>
          )}
          <span className="tag" style={{ color: "var(--amber)", borderColor: "var(--amber)" }}>KOD&nbsp;&nbsp;{code}</span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20, alignItems: "start" }}>
        <div>
          {state.phase === "lobby" && !ended && (
            <div className="panel center" style={{ minHeight: "70vh" }}>
              <div className="label">Dolacz na telefonie — wejdz na strone i wpisz kod</div>
              <div className="big-code ca-strong">{code}</div>
              <div className="pill" style={{ marginTop: 10 }}>{players.length} graczy</div>
              <div className="row" style={{ justifyContent: "center", marginTop: 26, maxWidth: 700 }}>
                {players.map((p) => <span key={p.id} className="tag" style={{ fontSize: 18 }}>{p.emoji} {p.name}</span>)}
              </div>
            </div>
          )}

          {state.phase === "category" && !ended && (
            <div className="panel" style={{ minHeight: "70vh" }}>
              <div className="label" style={{ textAlign: "center", marginBottom: 18 }}>WYBIERZ KATEGORIE</div>
              <div className="tiles" style={{ gridTemplateColumns: "1fr 1fr" }}>
                {view.shownCategories.map((c) => (
                  <div key={c.id} className={`tile ${state.selectedCategoryId === c.id ? "selected" : ""}`} style={{ "--c": c.color }}>{c.name}</div>
                ))}
              </div>
            </div>
          )}

          {/* TERYTORIUM: pytanie ZASTEPUJE plansze */}
          {state.phase === "territory" && !ended && (
            q ? <DuelQuestion view={view} cd={cd} /> : <Board view={view} />
          )}

          {/* FINAL */}
          {state.phase === "final" && !ended && (
            <div className="col">
              <div className="panel col">
                <div className="label" style={{ color: "var(--green)" }}>RUNDA FINALOWA · SZACOWANIE</div>
                {q ? <>
                  <div className="ca-strong" style={{ fontSize: "clamp(24px,3vw,42px)", textAlign: "center" }}>{q.text}</div>
                  <div className="row" style={{ justifyContent: "center" }}>
                    <span className="pill" style={{ borderColor: "var(--cyan)", color: "var(--cyan)" }}>{precisionHint(fin?.estimateType)}</span>
                    {fin?.unit && <span className="pill">jednostka: {fin.unit}</span>}
                  </div>
                </> : <div className="center mono muted" style={{ minHeight: 80 }}>Przygotowanie pytania finalowego...</div>}
              </div>
              {fin && (fin.questionId || fin.revealed) && <Bars fin={fin} players={players} />}
              {fin && <Wheel chance={fin.manipChance} manipulated={fin.manipulated} drawn={fin.manipDrawn} />}
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
              {selCat && <div className="row" style={{ justifyContent: "center" }}><span className="tag" style={{ color: selCat.color, borderColor: selCat.color }}>{selCat.name}</span></div>}
              <div className="ca-strong" style={{ fontSize: "clamp(28px,3.4vw,48px)", lineHeight: 1.1, textAlign: "center" }}>
                {buzzerHidden ? "PRZYGOTUJ SIE — BUZZER ZA CHWILE..." : q.text}
              </div>
              {!buzzerHidden && q.media && (
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
              {!buzzerHidden && q.type === "closed" && state.answersRevealed && (
                <div className="answers-grid">
                  {q.options.map((o, i) => {
                    const isCorrect = state.correctRevealed && correctId === o.id;
                    const cls = ["answer", `opt-${i}`, isCorrect ? "correct" : "", state.correctRevealed && !isCorrect ? "wrong" : ""].join(" ");
                    return <div key={o.id} className={cls}><span className="key">{KEYS[i]}</span><span className="txt">{o.text}</span></div>;
                  })}
                </div>
              )}
              {!buzzerHidden && q.type === "open" && state.correctRevealed && (
                <div className="panel center"><div className="label">POPRAWNA ODPOWIEDZ</div><div className="display ca" style={{ color: "var(--green)", fontSize: 34 }}>{q.correctAnswer}</div></div>
              )}
              {!buzzerHidden && q.type === "closed" && !state.answersRevealed && (
                <div className="center" style={{ minHeight: 120 }}><div className="mono muted">Warianty pojawia sie za chwile...</div></div>
              )}
            </div>
          )}

          {ended && (
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
