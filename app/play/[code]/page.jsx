"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useGame, useCountdown } from "@/lib/hooks";
import { api } from "@/lib/api";

const KEYS = ["A", "B", "C", "D"];

function fmtVal(type, v) {
  if (v == null || isNaN(v)) return "—";
  if (type === "time") {
    const m = ((Math.round(v) % 1440) + 1440) % 1440;
    return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
  }
  return String(v);
}

export default function PlayPage() {
  const { code } = useParams();
  const router = useRouter();
  const [pid, setPid] = useState(null);
  const [picked, setPicked] = useState(null);
  const [openText, setOpenText] = useState("");
  const [estInput, setEstInput] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [buzzPos, setBuzzPos] = useState(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    const p = localStorage.getItem(`vhsquiz:pid:${code}`);
    if (!p) router.replace(`/join?code=${code}`);
    else setPid(p);
  }, [code, router]);

  const { view, error } = useGame(code, "player", pid, 1000);
  const cd = useCountdown(view?.state?.timer);

  const me = useMemo(() => view?.players?.find((p) => p.id === pid), [view, pid]);
  const myRank = useMemo(() => {
    if (!view?.players) return null;
    const i = view.players.findIndex((p) => p.id === pid);
    return i >= 0 ? i + 1 : null;
  }, [view, pid]);

  const state = view?.state;
  const q = view?.question;
  const fin = view?.final;

  useEffect(() => {
    setPicked(null); setOpenText(""); setEstInput(""); setSubmitted(false); setBuzzPos(null);
  }, [q?.id]);

  const eligible = state && (state.answerMode === "all" || (state.eligibleIds || []).includes(pid));
  const buzzerActive = state?.answerMode === "buzzer" && state?.buzzerOpen;
  const iWonBuzz = state?.buzzerWinnerId === pid;

  // Blokada przewijania, gdy buzzer aktywny (by nie przewinac strony przy nacisnieciu)
  useEffect(() => {
    const lock = !!buzzerActive && !iWonBuzz;
    const el = document.documentElement, b = document.body;
    if (lock) { el.classList.add("lock"); b.classList.add("lock"); }
    else { el.classList.remove("lock"); b.classList.remove("lock"); }
    return () => { el.classList.remove("lock"); b.classList.remove("lock"); };
  }, [buzzerActive, iWonBuzz]);

  function flash(msg) { setToast(msg); setTimeout(() => setToast(""), 1800); }

  async function pickOption(optId) {
    if (submitted || !state?.answersRevealed || !eligible) return;
    setPicked(optId);
    try { await api.post(`/api/game/${code}/answer`, { pid, optionId: optId }); setSubmitted(true); flash("Odpowiedz wyslana ✓"); }
    catch (e) { flash(e.message); setPicked(null); }
  }
  async function submitOpen() {
    if (submitted || !openText.trim()) return;
    try { await api.post(`/api/game/${code}/answer`, { pid, text: openText.trim() }); setSubmitted(true); flash("Odpowiedz wyslana ✓"); }
    catch (e) { flash(e.message); }
  }
  async function submitEstimate() {
    if (submitted) return;
    let value;
    if (fin?.estimateType === "time") {
      if (!estInput) return flash("Podaj godzine");
      const [h, m] = estInput.split(":").map(Number);
      value = (h || 0) * 60 + (m || 0);
    } else {
      if (estInput === "") return flash("Podaj wartosc");
      value = fin?.estimateType === "integer" ? parseInt(estInput, 10) : parseFloat(estInput);
      if (isNaN(value)) return flash("Niepoprawna liczba");
    }
    try { await api.post(`/api/game/${code}/answer`, { pid, value }); setSubmitted(true); flash("Szacunek wyslany ✓"); }
    catch (e) { flash(e.message); }
  }
  async function buzz() {
    try { const r = await api.post(`/api/game/${code}/buzz`, { pid }); setBuzzPos(r.position); }
    catch (e) { flash(e.message); }
  }

  if (error && !view) return <div className="screen center"><div className="panel">⚠ {error}</div></div>;
  if (!view) return <div className="screen center"><div className="display ca">LADOWANIE...</div></div>;

  const myAnswer = view.answers?.[pid];
  const correctId = q?.correctOptionId;
  const inDuel = state?.phase === "territory" && !!q;
  const showQ = (state?.phase === "question" || state?.phase === "reveal" || inDuel) && q;
  const amFinalist = fin && (fin.duelIds || []).includes(pid);

  return (
    <div className="screen">
      <div className="wrap col" style={{ maxWidth: 640 }}>
        {/* PASEK STATUSU */}
        <div className="spread panel" style={{ padding: "10px 16px" }}>
          <div className="row" style={{ gap: 10 }}>
            <span style={{ fontSize: 26 }}>{me?.emoji}</span>
            <div>
              <div style={{ fontSize: 20, lineHeight: 1 }}>{me?.name || "..."}</div>
              <div className="mono small muted">#{code} · runda {state?.round || 0}</div>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="display" style={{ color: "var(--cyan)", fontSize: 24 }}>{me?.score ?? 0}</div>
            <div className="mono small muted">{myRank ? `miejsce ${myRank}` : ""}</div>
          </div>
        </div>

        {cd && (state?.phase === "question" || inDuel || state?.phase === "final") && (
          <div>
            <div className="timer-bar"><div className="timer-fill" style={{ width: `${cd.pct * 100}%` }} /></div>
            <div className="mono small muted" style={{ textAlign: "center", marginTop: 4 }}>{Math.ceil(cd.left)}s</div>
          </div>
        )}

        {state?.phase === "lobby" && (
          <div className="panel center" style={{ minHeight: "50vh" }}>
            <div className="display ca" style={{ fontSize: 30 }}>POCZEKALNIA</div>
            <p className="muted mono">Czekaj az host rozpocznie gre...</p>
            <div className="pill" style={{ marginTop: 10 }}>{view.players.length} graczy w lobby</div>
          </div>
        )}

        {state?.phase === "category" && (
          <div className="panel center" style={{ minHeight: "40vh" }}>
            <div className="display ca" style={{ fontSize: 26 }}>WYBOR KATEGORII</div>
            <p className="muted mono">Host wybiera kategorie na ekranie TV...</p>
            <div className="row" style={{ justifyContent: "center", marginTop: 16 }}>
              {view.shownCategories.map((c) => (
                <span key={c.id} className="tag" style={{ color: c.color, borderColor: c.color }}>{c.name}</span>
              ))}
            </div>
          </div>
        )}

        {/* TERYTORIUM — brak aktywnego pojedynku */}
        {state?.phase === "territory" && !q && (
          <div className="panel center" style={{ minHeight: "40vh" }}>
            <div className="display ca" style={{ fontSize: 26, color: "var(--green)" }}>WALKA O TERYTORIUM</div>
            <p className="muted mono">Mapa statku UFO jest na ekranie TV. Czekaj na swoj pojedynek...</p>
            <div className="pill" style={{ marginTop: 10 }}>Twoje pola: {view.territory ? view.territory.cells.filter((c) => c.owner === pid).length : 0}</div>
          </div>
        )}

        {/* PYTANIE / POJEDYNEK */}
        {showQ && (
          <div className="panel col">
            <div className="label">{inDuel ? "POJEDYNEK" : "PYTANIE"}</div>
            <div className="ca" style={{ fontSize: 24, lineHeight: 1.15 }}>
              {state.answerMode === "buzzer" && !state.buzzerOpen && !state.buzzerWinnerId
                ? "Przygotuj sie — buzzer za chwile..."
                : q.text}
            </div>

            {!(state.answerMode === "buzzer" && !state.buzzerOpen && !state.buzzerWinnerId) && q.media && (
              <div className="media-box" style={{ textAlign: "center" }}>
                {q.media.type === "image" && <img src={q.media.url} alt="" />}
                {q.media.type === "video" && <video src={q.media.url} controls />}
                {q.media.type === "audio" && <audio src={q.media.url} controls style={{ width: "100%" }} />}
              </div>
            )}

            {buzzerActive && !iWonBuzz && (
              <div className="center" style={{ minHeight: 260 }}>
                <button className="buzzer" onClick={buzz}>BUZZ!</button>
                {buzzPos && <div className="mono" style={{ marginTop: 14 }}>Twoja kolejnosc: {buzzPos}</div>}
              </div>
            )}

            {state.answerMode === "buzzer" && iWonBuzz && !state.answersRevealed && (
              <div className="center" style={{ minHeight: 120 }}>
                <div className="display ca" style={{ color: "var(--green)", fontSize: 26 }}>MASZ GLOS!</div>
                <p className="muted mono">Czekaj na warianty odpowiedzi...</p>
              </div>
            )}

            {!eligible && !buzzerActive && (
              <div className="center" style={{ minHeight: 120 }}>
                <div className="mono muted">Teraz odpowiada ktos inny...</div>
              </div>
            )}

            {q.type === "closed" && state.answersRevealed && (eligible || state.phase === "reveal") && (
              <div className="answers-grid">
                {q.options.map((o, i) => {
                  const isCorrect = state.correctRevealed && correctId === o.id;
                  const isMine = (picked || myAnswer?.optionId) === o.id;
                  const cls = ["answer", `opt-${i}`, isMine ? "picked" : "", isCorrect ? "correct" : "",
                    state.correctRevealed && !isCorrect ? "wrong" : ""].join(" ");
                  return (
                    <div key={o.id} className={cls} onClick={() => pickOption(o.id)}>
                      <span className="key">{KEYS[i]}</span><span className="txt">{o.text}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {q.type === "open" && eligible && state.answersRevealed && !state.correctRevealed && (
              <div className="col">
                {submitted ? (
                  <div className="mono" style={{ color: "var(--green)" }}>✓ Wyslano: {openText}</div>
                ) : (
                  <>
                    <input value={openText} onChange={(e) => setOpenText(e.target.value)} placeholder="Wpisz odpowiedz..." />
                    <button className="btn btn-cyan btn-block" onClick={submitOpen}>Wyslij odpowiedz</button>
                  </>
                )}
              </div>
            )}

            {state.correctRevealed && (
              <div className="panel" style={{ background: "rgba(0,0,0,0.4)" }}>
                {q.type === "open" ? (
                  <div className="mono">Poprawna: <b style={{ color: "var(--green)" }}>{q.correctAnswer}</b></div>
                ) : (
                  <div className="mono">
                    {myAnswer?.optionId === correctId
                      ? <span style={{ color: "var(--green)" }}>✓ Dobrze!</span>
                      : myAnswer ? <span style={{ color: "var(--magenta)" }}>✗ Niestety...</span>
                        : <span className="muted">Brak Twojej odpowiedzi</span>}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* RUNDA FINALOWA — SZACOWANIE */}
        {state?.phase === "final" && (
          <div className="panel col">
            <div className="label">FINAL · SZACOWANIE</div>
            {q ? <div className="ca" style={{ fontSize: 22, lineHeight: 1.15 }}>{q.text}</div>
              : <p className="muted mono">Czekaj na pytanie finalowe...</p>}
            {q?.unit && <div className="mono small muted">jednostka: {q.unit}</div>}

            {!amFinalist && q && <div className="mono muted center" style={{ minHeight: 80 }}>Jestes obserwatorem finalu.</div>}

            {amFinalist && q && !fin?.revealed && (
              submitted ? (
                <div className="mono" style={{ color: "var(--green)" }}>✓ Twoj szacunek zostal wyslany. Czekaj na ujawnienie.</div>
              ) : (
                <div className="col">
                  {fin?.estimateType === "time" ? (
                    <input type="time" value={estInput} onChange={(e) => setEstInput(e.target.value)} />
                  ) : (
                    <input type="number" step={fin?.estimateType === "float" ? "any" : "1"} inputMode="decimal"
                      value={estInput} onChange={(e) => setEstInput(e.target.value)} placeholder="Twoj szacunek" />
                  )}
                  <button className="btn btn-cyan btn-block" onClick={submitEstimate}>Wyslij szacunek</button>
                </div>
              )
            )}

            {fin?.revealed && (
              <div className="panel" style={{ background: "rgba(0,0,0,0.4)" }}>
                <div className="mono">Poprawna: <b style={{ color: "var(--amber)" }}>{fmtVal(fin.estimateType, fin.manipValue)}</b>
                  {fin.manipulated && <span style={{ color: "var(--magenta)" }}> (Kosmiczna Manipulacja!)</span>}</div>
                {amFinalist && <div className="mono" style={{ marginTop: 6 }}>
                  Twoj szacunek: {fmtVal(fin.estimateType, fin.estimates?.[pid])}{" "}
                  {fin.winnerId === pid ? <span style={{ color: "var(--green)" }}>— wygrana!</span> : <span className="muted">— rywal byl blizej</span>}
                </div>}
              </div>
            )}
          </div>
        )}

        {state?.status === "ended" && (
          <div className="panel center">
            <div className="display ca-strong" style={{ fontSize: 34 }}>KONIEC GRY</div>
            <div className="display" style={{ color: "var(--cyan)", marginTop: 8 }}>{me?.score ?? 0} pkt</div>
            <div className="mono muted">miejsce {myRank}</div>
          </div>
        )}
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
