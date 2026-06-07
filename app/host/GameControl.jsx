"use client";
import { useEffect, useMemo, useState } from "react";
import { hostAction } from "@/lib/api";
import { useGame, useCountdown } from "@/lib/hooks";

const OPT_KEYS = ["A", "B", "C", "D"];

export default function GameControl({ secret, code, categories, questions }) {
  const { view, error, refresh } = useGame(code, "host", null, 1000);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState(null); // lokalna kopia ustawien
  const [catCount, setCatCount] = useState(4);
  const [selEligible, setSelEligible] = useState({}); // pid -> bool (tryb "wybierz")
  const [mark, setMark] = useState({}); // pid -> {optionId, text} szkic odpowiedzi hosta
  const [setVal, setSetVal] = useState({}); // pid -> wpisywana wartosc punktow

  function note(m) {
    setMsg(m);
    setTimeout(() => setMsg(""), 2600);
  }

  async function act(action, payload = {}) {
    try {
      await hostAction(code, action, payload, secret);
      refresh();
    } catch (e) {
      note(e.message || "Blad akcji");
    }
  }

  const state = view?.state;
  const settings = state?.settings;

  // inicjalizacja formularza ustawien gdy przyjdzie pierwszy widok
  useEffect(() => {
    if (settings && form === null) {
      setForm({ ...settings });
      if (settings.categoriesToShow) setCatCount(settings.categoriesToShow);
    }
  }, [settings, form]);

  const countdown = useCountdown(state?.timer);

  const players = view?.players || [];
  const answers = view?.answers || {};
  const answeredIds = view?.answeredIds || [];
  const buzz = view?.buzz || [];
  const q = view?.question || null;

  const playerMap = useMemo(() => {
    const m = {};
    for (const p of players) m[p.id] = p;
    return m;
  }, [players]);

  const eligible = useMemo(() => {
    if (!state) return [];
    if (state.answerMode === "all") return players.map((p) => p.id);
    return state.eligibleIds || [];
  }, [state, players]);

  if (!code) {
    return (
      <div className="panel">
        <p className="mono">Najpierw utworz gre (przycisk u gory).</p>
      </div>
    );
  }

  if (!view) {
    return (
      <div className="panel">
        <p className="mono">{error ? "Blad: " + error : "Laczenie z gra..."}</p>
      </div>
    );
  }

  const phase = state.phase;
  const catQuestions = (questions || []).filter(
    (x) => x.categoryId === state.selectedCategoryId
  );

  function saveSettings() {
    act("updateSettings", {
      settings: {
        timeLimitSec: Number(form.timeLimitSec) || 0,
        pointsPerQuestion: Number(form.pointsPerQuestion) || 0,
        speedBonus: !!form.speedBonus,
        bonusPoints: Number(form.bonusPoints) || 0,
        categoriesToShow: Number(form.categoriesToShow) || 4,
      },
    });
    note("Ustawienia zapisane");
  }

  function confirmSelect() {
    const ids = Object.keys(selEligible).filter((k) => selEligible[k]);
    if (!ids.length) return note("Zaznacz przynajmniej jednego uczestnika");
    act("setAnswerMode", { mode: "select", eligibleIds: ids });
  }

  function markOnBehalf(pid) {
    const draft = mark[pid] || {};
    if (q?.type === "closed") {
      if (!draft.optionId) return note("Wybierz odpowiedz");
      act("markAnswer", { pid, optionId: draft.optionId });
    } else {
      act("markAnswer", { pid, text: draft.text || "" });
    }
  }

  return (
    <div style={{ display: "grid", gap: 18 }}>
      {msg && <div className="toast">{msg}</div>}

      {/* PASEK STANU */}
      <div className="panel" style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
        <span className="display" style={{ fontSize: 22, color: "var(--cyan)" }}>KOD: {state.code}</span>
        <span className="mono">Status: <b>{state.status}</b></span>
        <span className="mono">Faza: <b>{phase}</b></span>
        <span className="mono">Runda: <b>{state.round || 0}</b></span>
        <span className="mono">Gracze: <b>{players.length}</b></span>
        {state.status === "active" && (
          <button className="btn btn-mag btn-sm" style={{ marginLeft: "auto" }} onClick={() => act("endGame")}>
            ZAKONCZ GRE
          </button>
        )}
      </div>

      {/* USTAWIENIA */}
      {form && (
        <div className="panel">
          <h3 className="display" style={{ color: "var(--amber)", marginTop: 0 }}>USTAWIENIA</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>
            <label className="mono">Limit czasu (s, 0=brak)
              <input type="number" min="0" value={form.timeLimitSec}
                onChange={(e) => setForm({ ...form, timeLimitSec: e.target.value })} />
            </label>
            <label className="mono">Punkty za pytanie
              <input type="number" min="0" value={form.pointsPerQuestion}
                onChange={(e) => setForm({ ...form, pointsPerQuestion: e.target.value })} />
            </label>
            <label className="mono">Punkty bonus (szybkosc)
              <input type="number" min="0" value={form.bonusPoints}
                onChange={(e) => setForm({ ...form, bonusPoints: e.target.value })} />
            </label>
            <label className="mono">Kategorii do pokazania
              <input type="number" min="1" value={form.categoriesToShow}
                onChange={(e) => setForm({ ...form, categoriesToShow: e.target.value })} />
            </label>
            <label className="mono" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" checked={!!form.speedBonus}
                onChange={(e) => setForm({ ...form, speedBonus: e.target.checked })} />
              Premia za szybkosc
            </label>
          </div>
          <div style={{ marginTop: 12 }}>
            <button className="btn btn-cyan" onClick={saveSettings}>ZAPISZ USTAWIENIA</button>
          </div>
        </div>
      )}

      {/* START */}
      {state.status === "lobby" && (
        <div className="panel">
          <h3 className="display" style={{ color: "var(--green)", marginTop: 0 }}>LOBBY</h3>
          <p className="mono">Udostepnij kod <b>{state.code}</b> uczestnikom oraz ekranowi TV.</p>
          <button className="btn btn-green btn-lg" onClick={() => act("start", { count: Number(catCount) || undefined })}>
            ROZPOCZNIJ GRE
          </button>
        </div>
      )}

      {/* FAZA: KATEGORIE */}
      {state.status === "active" && phase === "category" && (
        <div className="panel">
          <h3 className="display" style={{ color: "var(--purple)", marginTop: 0 }}>WYBOR KATEGORII</h3>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
            <label className="mono">Ile kategorii:
              <input type="number" min="1" value={catCount} style={{ width: 70, marginLeft: 6 }}
                onChange={(e) => setCatCount(e.target.value)} />
            </label>
            <button className="btn btn-purple btn-sm" onClick={() => act("showCategories", { count: Number(catCount) || undefined })}>
              POKAZ / LOSUJ KATEGORIE
            </button>
          </div>

          {view.shownCategories?.length > 0 && (
            <div className="tiles">
              {view.shownCategories.map((c) => (
                <button key={c.id}
                  className={"tile" + (state.selectedCategoryId === c.id ? " selected" : "")}
                  style={{ "--c": c.color }}
                  onClick={() => act("selectCategory", { categoryId: c.id })}>
                  {c.name}
                </button>
              ))}
            </div>
          )}

          {state.selectedCategoryId && (
            <div style={{ marginTop: 18 }}>
              <h4 className="display" style={{ color: "var(--cyan)" }}>PYTANIA W KATEGORII</h4>
              {catQuestions.length === 0 && <p className="mono">Brak pytan w tej kategorii.</p>}
              <div style={{ display: "grid", gap: 8 }}>
                {catQuestions.map((qq) => (
                  <div key={qq.id} className="panel" style={{ display: "flex", gap: 10, alignItems: "center", padding: 12 }}>
                    <span className="mono" style={{ flex: 1 }}>
                      [{qq.type === "closed" ? "ZAMK" : "OTW"}] {qq.text}
                    </span>
                    <button className="btn btn-green btn-sm" onClick={() => act("presentQuestion", { questionId: qq.id, answerMode: "all" })}>
                      POKAZ PYTANIE
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* FAZA: PYTANIE */}
      {state.status === "active" && phase === "question" && q && (
        <div className="panel">
          <h3 className="display" style={{ color: "var(--cyan)", marginTop: 0 }}>PYTANIE</h3>
          <p className="term" style={{ fontSize: 22 }}>{q.text}</p>
          {q.media && (
            <div className="mono" style={{ opacity: 0.7 }}>media: {q.media.type} — {q.media.url}</div>
          )}

          {/* poprawna odpowiedz - widoczna tylko dla hosta */}
          <div className="mono" style={{ color: "var(--amber)", margin: "8px 0" }}>
            {q.type === "closed"
              ? "Poprawna: " + (OPT_KEYS[q.options.findIndex((o) => o.id === q.correctOptionId)] || "?") +
                " — " + (q.options.find((o) => o.id === q.correctOptionId)?.text || "")
              : "Poprawna (wzor): " + (q.correctAnswer || "—")}
          </div>

          {/* TRYB ODPOWIADANIA */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "12px 0" }}>
            <button className={"btn btn-sm " + (state.answerMode === "all" ? "active" : "btn-cyan")}
              onClick={() => act("setAnswerMode", { mode: "all" })}>WSZYSCY</button>
            <button className={"btn btn-sm " + (state.answerMode === "select" ? "active" : "btn-cyan")}
              onClick={() => act("setAnswerMode", { mode: "select", eligibleIds: [] })}>WYBIERZ</button>
            <button className={"btn btn-sm " + (state.answerMode === "buzzer" ? "active" : "btn-mag")}
              onClick={() => act("openBuzzer")}>BUZZER</button>
          </div>

          {/* WYBOR UCZESTNIKOW */}
          {state.answerMode === "select" && (
            <div className="panel" style={{ padding: 12 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {players.map((p) => (
                  <label key={p.id} className="mono" style={{ display: "flex", alignItems: "center", gap: 6, border: "1px solid var(--line)", padding: "4px 8px" }}>
                    <input type="checkbox" checked={!!selEligible[p.id]}
                      onChange={(e) => setSelEligible({ ...selEligible, [p.id]: e.target.checked })} />
                    {p.emoji} {p.name}
                  </label>
                ))}
              </div>
              <button className="btn btn-cyan btn-sm" style={{ marginTop: 10 }} onClick={confirmSelect}>
                ZATWIERDZ UPRAWNIONYCH
              </button>
              {eligible.length > 0 && (
                <div className="mono" style={{ marginTop: 8, color: "var(--green)" }}>
                  Uprawnieni: {eligible.map((id) => playerMap[id]?.name || id).join(", ")}
                </div>
              )}
            </div>
          )}

          {/* BUZZER */}
          {state.answerMode === "buzzer" && (
            <div className="panel" style={{ padding: 12 }}>
              <div className="mono">Buzzer: <b>{state.buzzerOpen ? "OTWARTY" : "ZAMKNIETY"}</b></div>
              <div style={{ display: "grid", gap: 6, margin: "10px 0" }}>
                {buzz.length === 0 && <span className="mono" style={{ opacity: 0.6 }}>Nikt jeszcze nie nacisnal.</span>}
                {buzz.map((pid, i) => (
                  <div key={pid} className="rank-row">
                    <span className="rank-pos">{i + 1}</span>
                    <span className="rank-emoji">{playerMap[pid]?.emoji}</span>
                    <span className="rank-name">{playerMap[pid]?.name || pid}</span>
                    {state.buzzerWinnerId === pid
                      ? <span className="mono" style={{ color: "var(--green)" }}>ODPOWIADA</span>
                      : <button className="btn btn-green btn-sm" onClick={() => act("acceptBuzz", { pid })}>WYBIERZ</button>}
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-green btn-sm" onClick={() => act("acceptBuzz", {})} disabled={!buzz.length}>
                  ZATWIERDZ PIERWSZEGO
                </button>
                <button className="btn btn-amber btn-sm" onClick={() => act("clearBuzzer")}>WYCZYSC / OTWORZ PONOWNIE</button>
              </div>
            </div>
          )}

          {/* UJAWNIENIE ODPOWIEDZI + TIMER */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "14px 0" }}>
            <button className="btn btn-amber" onClick={() => act("revealAnswers")} disabled={state.answersRevealed}>
              POKAZ MOZLIWE ODPOWIEDZI
            </button>
            {settings.timeLimitSec > 0 && (
              <>
                <button className="btn btn-cyan btn-sm" onClick={() => act("startTimer", {})}>START CZAS</button>
                <button className="btn btn-mag btn-sm" onClick={() => act("stopTimer")}>STOP CZAS</button>
              </>
            )}
            {countdown && (
              <span className="display" style={{ color: countdown.left < 5 ? "var(--magenta)" : "var(--cyan)" }}>
                {Math.ceil(countdown.left)}s
              </span>
            )}
          </div>

          {/* LISTA UPRAWNIONYCH + ZAZNACZANIE PRZEZ HOSTA */}
          <h4 className="display" style={{ color: "var(--purple)" }}>ODPOWIEDZI UPRAWNIONYCH</h4>
          <div style={{ display: "grid", gap: 8 }}>
            {eligible.length === 0 && <span className="mono" style={{ opacity: 0.6 }}>Brak uprawnionych (wybierz tryb).</span>}
            {eligible.map((pid) => {
              const p = playerMap[pid];
              if (!p) return null;
              const a = answers[pid];
              const did = answeredIds.includes(pid);
              return (
                <div key={pid} className="panel" style={{ padding: 12 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span className="mono" style={{ flex: 1 }}>
                      {p.emoji} <b>{p.name}</b>{" "}
                      {did
                        ? <span style={{ color: "var(--green)" }}>
                            — {q.type === "closed"
                              ? (OPT_KEYS[q.options.findIndex((o) => o.id === a?.optionId)] || "?")
                              : "„" + (a?.text || "") + ""}
                            {a?.byHost ? " (host)" : ""}
                          </span>
                        : <span style={{ color: "var(--magenta)" }}>— brak odpowiedzi</span>}
                    </span>
                  </div>

                  {/* zaznaczanie w imieniu uczestnika */}
                  {q.type === "closed" ? (
                    <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                      {q.options.map((o, i) => (
                        <button key={o.id}
                          className={"btn btn-sm " + ((mark[pid]?.optionId || a?.optionId) === o.id ? "active" : "btn-cyan")}
                          onClick={() => setMark({ ...mark, [pid]: { optionId: o.id } })}>
                          {OPT_KEYS[i]}
                        </button>
                      ))}
                      <button className="btn btn-amber btn-sm" onClick={() => markOnBehalf(pid)}>ZAZNACZ ZA NIEGO</button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <input className="mono" placeholder="odpowiedz po czasie"
                        value={mark[pid]?.text ?? (a?.text || "")}
                        onChange={(e) => setMark({ ...mark, [pid]: { text: e.target.value } })}
                        style={{ flex: 1, minWidth: 160 }} />
                      <button className="btn btn-amber btn-sm" onClick={() => markOnBehalf(pid)}>ZAPISZ</button>
                      <button className="btn btn-green btn-sm" onClick={() => act("judgeAnswer", { pid, correct: true })}>OK</button>
                      <button className="btn btn-mag btn-sm" onClick={() => act("judgeAnswer", { pid, correct: false })}>ZLE</button>
                      {a?.judged === true && <span className="mono" style={{ color: "var(--green)" }}>uznane</span>}
                      {a?.judged === false && <span className="mono" style={{ color: "var(--magenta)" }}>odrzucone</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 14 }}>
            <button className="btn btn-green btn-lg" onClick={() => act("revealCorrect")} disabled={state.correctRevealed}>
              UJAWNIJ POPRAWNA ODPOWIEDZ
            </button>
          </div>
        </div>
      )}

      {/* FAZA: REVEAL */}
      {phase === "reveal" && (
        <div className="panel">
          <h3 className="display" style={{ color: "var(--green)", marginTop: 0 }}>WYNIK</h3>
          {q && (
            <div className="mono" style={{ marginBottom: 12 }}>
              Poprawna: <b style={{ color: "var(--green)" }}>
                {q.type === "closed"
                  ? (q.options.find((o) => o.id === q.correctOptionId)?.text || "?")
                  : (q.correctAnswer || "—")}
              </b>
            </div>
          )}
          {state.status === "active" && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn btn-purple btn-lg" onClick={() => act("nextRound", { count: Number(catCount) || undefined })}>
                NASTEPNA RUNDA
              </button>
              <button className="btn btn-mag" onClick={() => act("endGame")}>ZAKONCZ GRE</button>
            </div>
          )}
          {state.status === "ended" && <p className="display" style={{ color: "var(--amber)" }}>GRA ZAKONCZONA</p>}
        </div>
      )}

      {/* ZARZADZANIE GRACZAMI */}
      <div className="panel">
        <h3 className="display" style={{ color: "var(--amber)", marginTop: 0 }}>UCZESTNICY I PUNKTY</h3>
        {players.length === 0 && <p className="mono">Brak uczestnikow.</p>}
        <div style={{ display: "grid", gap: 8 }}>
          {players.map((p, i) => (
            <div key={p.id} className={"rank-row" + (i === 0 ? " top1" : "")}>
              <span className="rank-pos">{i + 1}</span>
              <span className="rank-emoji">{p.emoji}</span>
              <span className="rank-name">{p.name}</span>
              <span className="rank-score">{p.score}</span>
              <span style={{ display: "flex", gap: 4, alignItems: "center", marginLeft: 10 }}>
                <button className="btn btn-sm btn-mag" onClick={() => act("adjustPoints", { pid: p.id, delta: -1 })}>-1</button>
                <button className="btn btn-sm btn-green" onClick={() => act("adjustPoints", { pid: p.id, delta: 1 })}>+1</button>
                <input className="mono" style={{ width: 64 }} placeholder="ust." value={setVal[p.id] ?? ""}
                  onChange={(e) => setSetVal({ ...setVal, [p.id]: e.target.value })} />
                <button className="btn btn-sm btn-cyan"
                  onClick={() => { act("adjustPoints", { pid: p.id, value: Number(setVal[p.id]) || 0 }); setSetVal({ ...setVal, [p.id]: "" }); }}>
                  USTAW
                </button>
                <button className="btn btn-sm btn-mag" onClick={() => { if (confirm("Usunac uczestnika?")) act("removePlayer", { pid: p.id }); }}>X</button>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
