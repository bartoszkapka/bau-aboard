"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useGame, useCountdown } from "@/lib/hooks";
import { api } from "@/lib/api";

const KEYS = ["A", "B", "C", "D"];

export default function PlayPage() {
  const { code } = useParams();
  const router = useRouter();
  const [pid, setPid] = useState(null);
  const [picked, setPicked] = useState(null); // optionId
  const [openText, setOpenText] = useState("");
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

  // reset lokalnego stanu przy nowym pytaniu
  useEffect(() => {
    setPicked(null);
    setOpenText("");
    setSubmitted(false);
    setBuzzPos(null);
  }, [q?.id]);

  const eligible =
    state && (state.answerMode === "all" || (state.eligibleIds || []).includes(pid));
  const buzzerActive = state?.answerMode === "buzzer" && state?.buzzerOpen;
  const iWonBuzz = state?.buzzerWinnerId === pid;

  function flash(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 1800);
  }

  async function pickOption(optId) {
    if (submitted || !state?.answersRevealed || !eligible) return;
    setPicked(optId);
    try {
      await api.post(`/api/game/${code}/answer`, { pid, optionId: optId });
      setSubmitted(true);
      flash("Odpowiedz wyslana ✓");
    } catch (e) {
      flash(e.message);
      setPicked(null);
    }
  }

  async function submitOpen() {
    if (submitted || !openText.trim()) return;
    try {
      await api.post(`/api/game/${code}/answer`, { pid, text: openText.trim() });
      setSubmitted(true);
      flash("Odpowiedz wyslana ✓");
    } catch (e) {
      flash(e.message);
    }
  }

  async function buzz() {
    try {
      const r = await api.post(`/api/game/${code}/buzz`, { pid });
      setBuzzPos(r.position);
    } catch (e) {
      flash(e.message);
    }
  }

  if (error && !view)
    return <div className="screen center"><div className="panel">⚠ {error}</div></div>;
  if (!view) return <div className="screen center"><div className="display ca">LADOWANIE...</div></div>;

  const myAnswer = view.answers?.[pid];
  const correctId = q?.correctOptionId;

  return (
    <div className="screen">
      <div className="wrap col" style={{ maxWidth: 640 }}>
        {/* PASEK STATUSU */}
        <div className="spread panel" style={{ padding: "10px 16px" }}>
          <div className="row" style={{ gap: 10 }}>
            <span style={{ fontSize: 26 }}>{me?.emoji}</span>
            <div>
              <div style={{ fontSize: 20, lineHeight: 1 }}>{me?.name || "..."}</div>
              <div className="mono small muted">#{code}</div>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="display" style={{ color: "var(--cyan)", fontSize: 24 }}>{me?.score ?? 0}</div>
            <div className="mono small muted">{myRank ? `miejsce ${myRank}` : ""}</div>
          </div>
        </div>

        {/* TIMER */}
        {cd && state?.phase === "question" && (
          <div>
            <div className="timer-bar"><div className="timer-fill" style={{ width: `${cd.pct * 100}%` }} /></div>
            <div className="mono small muted" style={{ textAlign: "center", marginTop: 4 }}>
              {Math.ceil(cd.left)}s
            </div>
          </div>
        )}

        {/* TRESC */}
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

        {(state?.phase === "question" || state?.phase === "reveal") && q && (
          <div className="panel col">
            <div className="label">PYTANIE</div>
            <div className="ca" style={{ fontSize: 24, lineHeight: 1.15 }}>{q.text}</div>

            {q.media && (
              <div className="media-box" style={{ textAlign: "center" }}>
                {q.media.type === "image" && <img src={q.media.url} alt="" />}
                {q.media.type === "video" && <video src={q.media.url} controls />}
                {q.media.type === "audio" && <audio src={q.media.url} controls style={{ width: "100%" }} />}
              </div>
            )}

            {/* BUZZER */}
            {buzzerActive && !iWonBuzz && (
              <div className="center" style={{ minHeight: 220 }}>
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

            {/* NIE UPRAWNIONY */}
            {!eligible && !buzzerActive && state.phase === "question" && (
              <div className="center" style={{ minHeight: 120 }}>
                <div className="mono muted">Teraz odpowiada ktos inny...</div>
              </div>
            )}

            {/* ODPOWIEDZI ZAMKNIETE */}
            {q.type === "closed" && state.answersRevealed && (eligible || state.phase === "reveal") && (
              <div className="answers-grid">
                {q.options.map((o, i) => {
                  const isCorrect = state.correctRevealed && correctId === o.id;
                  const isMine = (picked || myAnswer?.optionId) === o.id;
                  const cls = [
                    "answer",
                    `opt-${i}`,
                    isMine ? "picked" : "",
                    isCorrect ? "correct" : "",
                    state.correctRevealed && !isCorrect ? "wrong" : "",
                  ].join(" ");
                  return (
                    <div key={o.id} className={cls} onClick={() => pickOption(o.id)}>
                      <span className="key">{KEYS[i]}</span>
                      <span className="txt">{o.text}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* PYTANIE OTWARTE */}
            {q.type === "open" && eligible && state.answersRevealed && state.phase === "question" && (
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

            {/* WYNIK PO UJAWNIENIU */}
            {state.correctRevealed && (
              <div className="panel" style={{ background: "rgba(0,0,0,0.4)" }}>
                {q.type === "open" ? (
                  <div className="mono">Poprawna odpowiedz: <b style={{ color: "var(--green)" }}>{q.correctAnswer}</b></div>
                ) : (
                  <div className="mono">
                    {myAnswer?.optionId === correctId
                      ? <span style={{ color: "var(--green)" }}>✓ Dobrze!</span>
                      : myAnswer
                        ? <span style={{ color: "var(--magenta)" }}>✗ Niestety...</span>
                        : <span className="muted">Brak Twojej odpowiedzi</span>}
                  </div>
                )}
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
