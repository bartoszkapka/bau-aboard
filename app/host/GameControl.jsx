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
  const [presentMode, setPresentMode] = useState("all"); // typ odpowiedzi wybierany PRZED pokazaniem pytania
  const [atkId, setAtkId] = useState(""); // atakujacy w pojedynku
  const [duelMode, setDuelMode] = useState("all"); // tryb pojedynku gracz vs gracz
  const [editIdx, setEditIdx] = useState(null); // edycja pola planszy
  const [estType, setEstType] = useState(""); // override typu szacowania

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
      const bonuses = Array.isArray(settings.bonuses)
        ? settings.bonuses
        : [settings.bonusPoints || 0, 0, 0];
      const b = [bonuses[0] || 0, bonuses[1] || 0, bonuses[2] || 0];
      setForm({ ...settings, bonuses: b });
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
        bonuses: [
          Number(form.bonuses?.[0]) || 0,
          Number(form.bonuses?.[1]) || 0,
          Number(form.bonuses?.[2]) || 0,
        ],
        categoriesToShow: Number(form.categoriesToShow) || 4,
        wrongPenalty: Number(form.wrongPenalty) || 0,
        boardSize: Math.max(2, Math.min(8, Number(form.boardSize) || 4)),
        estimatePoints: Number(form.estimatePoints) || 0,
        estimateExactBonus: Number(form.estimateExactBonus) || 0,
      },
    });
    note("Ustawienia zapisane");
  }

  function setBonus(i, val) {
    const b = [...(form.bonuses || [0, 0, 0])];
    b[i] = val;
    setForm({ ...form, bonuses: b });
  }

  function confirmSelect() {
    const ids = Object.keys(selEligible).filter((k) => selEligible[k]);
    if (!ids.length) return note("Zaznacz przynajmniej jednego uczestnika");
    act("setAnswerMode", { mode: "select", eligibleIds: ids });
  }

  function pickRandom(pool) {
    const used = new Set(state?.usedQuestionIds || []);
    let candidates = (pool || []).filter((x) => !used.has(x.id));
    if (candidates.length === 0) candidates = pool || []; // wszystkie juz uzyte -> losuj z calosci
    if (candidates.length === 0) return note("Brak pytan do wylosowania");
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    act("presentQuestion", { questionId: pick.id, answerMode: presentMode });
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
            <label className="mono">Kategorii do pokazania
              <input type="number" min="1" value={form.categoriesToShow}
                onChange={(e) => setForm({ ...form, categoriesToShow: e.target.value })} />
            </label>
            <label className="mono">Kara za bledna odp.
              <input type="number" min="0" value={form.wrongPenalty ?? 0}
                onChange={(e) => setForm({ ...form, wrongPenalty: e.target.value })} />
            </label>
            <label className="mono">Plansza terytorium (NxN)
              <input type="number" min="2" max="8" value={form.boardSize ?? 4}
                onChange={(e) => setForm({ ...form, boardSize: e.target.value })} />
            </label>
            <label className="mono">Final: punkty za blizsza
              <input type="number" min="0" value={form.estimatePoints ?? 0}
                onChange={(e) => setForm({ ...form, estimatePoints: e.target.value })} />
            </label>
            <label className="mono">Final: bonus za trafienie
              <input type="number" min="0" value={form.estimateExactBonus ?? 0}
                onChange={(e) => setForm({ ...form, estimateExactBonus: e.target.value })} />
            </label>
          </div>

          <div className="field-row" style={{ marginTop: 12 }}>
            <input id="sb" type="checkbox" checked={!!form.speedBonus}
              onChange={(e) => setForm({ ...form, speedBonus: e.target.checked })} />
            <label htmlFor="sb" className="mono" style={{ cursor: "pointer" }}>
              Premia za szybkosc (liczy sie tylko kolejnosc, nie czas)
            </label>
          </div>

          {form.speedBonus && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginTop: 10 }}>
              <label className="mono">Bonus za 1. miejsce
                <input type="number" min="0" value={form.bonuses?.[0] ?? 0}
                  onChange={(e) => setBonus(0, e.target.value)} />
              </label>
              <label className="mono">Bonus za 2. miejsce
                <input type="number" min="0" value={form.bonuses?.[1] ?? 0}
                  onChange={(e) => setBonus(1, e.target.value)} />
              </label>
              <label className="mono">Bonus za 3. miejsce
                <input type="number" min="0" value={form.bonuses?.[2] ?? 0}
                  onChange={(e) => setBonus(2, e.target.value)} />
              </label>
            </div>
          )}
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
            <button className="btn btn-cyan btn-sm" onClick={() => pickRandom(questions || [])}>
              🎲 LOSUJ DOWOLNE PYTANIE
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

              <div className="field-row" style={{ margin: "6px 0 12px" }}>
                <span className="mono">Typ odpowiedzi:</span>
                <button type="button" className={"chip" + (presentMode === "all" ? " on" : "")} onClick={() => setPresentMode("all")}>WSZYSCY</button>
                <button type="button" className={"chip" + (presentMode === "select" ? " on" : "")} onClick={() => setPresentMode("select")}>WYBIERZ</button>
                <button type="button" className={"chip" + (presentMode === "buzzer" ? " on" : "")} onClick={() => setPresentMode("buzzer")}>BUZZER</button>
                <button type="button" className="btn btn-cyan btn-sm" onClick={() => pickRandom(catQuestions)}>🎲 LOSUJ Z TEJ KATEGORII</button>
              </div>

              {catQuestions.length === 0 && <p className="mono">Brak pytan w tej kategorii.</p>}
              <div style={{ display: "grid", gap: 8 }}>
                {catQuestions.map((qq) => (
                  <div key={qq.id} className="panel" style={{ display: "flex", gap: 10, alignItems: "center", padding: 12 }}>
                    <span className="mono" style={{ flex: 1 }}>
                      [{qq.type === "closed" ? "ZAMK" : "OTW"}] {qq.text}
                    </span>
                    <button className="btn btn-green btn-sm" onClick={() => act("presentQuestion", { questionId: qq.id, answerMode: presentMode })}>
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
              <div className="mono small muted" style={{ marginBottom: 8 }}>Kliknij graczy, ktorzy moga odpowiadac:</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {players.map((p) => (
                  <button key={p.id} type="button"
                    className={"chip" + (selEligible[p.id] ? " on" : "")}
                    onClick={() => setSelEligible({ ...selEligible, [p.id]: !selEligible[p.id] })}>
                    {p.emoji} {p.name}
                  </button>
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
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {!state.buzzerOpen && !state.buzzerWinnerId && (
                  <button className="btn btn-mag btn-sm" onClick={() => act("openBuzzer")}>OTWORZ BUZZER</button>
                )}
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
                NASTEPNA RUNDA (KLASYCZNA)
              </button>
              <button className="btn btn-green btn-lg" onClick={() => { if (confirm("Zakonczyc runde 1 i rozpoczac WALKE O TERYTORIUM? Punkty zamienia sie w pola.")) act("startTerritory", { size: Number(form?.boardSize) || 4 }); }}>
                ▶ WALKA O TERYTORIUM
              </button>
              <button className="btn btn-mag" onClick={() => act("endGame")}>ZAKONCZ GRE</button>
            </div>
          )}
          {state.status === "ended" && <p className="display" style={{ color: "var(--amber)" }}>GRA ZAKONCZONA</p>}
        </div>
      )}

      {/* ===================== RUNDA 2: TERYTORIUM ===================== */}
      {phase === "territory" && view.territory && (() => {
        const t = view.territory;
        const cats = view.categories || [];
        const catMap = {}; for (const c of cats) catMap[c.id] = c;
        const PC = ["#23e0c8", "#ff2d78", "#ffd23f", "#7c5cff", "#3fa7ff", "#ff7a2d", "#00e676", "#e0e0e0"];
        const colorOf = { aliens: "var(--green)" };
        players.forEach((p, i) => { colorOf[p.id] = PC[i % PC.length]; });
        const neigh = (idx) => {
          const r = Math.floor(idx / t.size), c = idx % t.size, out = [];
          if (r > 0) out.push(idx - t.size); if (r < t.size - 1) out.push(idx + t.size);
          if (c > 0) out.push(idx - 1); if (c < t.size - 1) out.push(idx + 1);
          return out;
        };
        const ownerCount = {};
        for (const c of t.cells) if (c.owner !== "aliens") ownerCount[c.owner] = (ownerCount[c.owner] || 0) + 1;
        const playersWithLand = players.filter((p) => ownerCount[p.id] > 0);
        const duel = t.duel;
        const canStartDuel = (idx) => atkId && t.cells[idx].owner !== atkId &&
          neigh(idx).some((n) => t.cells[n].owner === atkId);

        return (
          <div className="panel">
            <h3 className="display" style={{ color: "var(--green)", marginTop: 0 }}>WALKA O TERYTORIUM</h3>

            {playersWithLand.length <= 2 && !duel && (
              <div className="panel" style={{ borderColor: "var(--amber)", padding: 10, marginBottom: 10 }}>
                <span className="mono" style={{ color: "var(--amber)" }}>Zostalo {playersWithLand.length} graczy z terytorium — mozesz przejsc do finalu.</span>
              </div>
            )}

            {/* wybor atakujacego */}
            <div className="field-row" style={{ marginBottom: 8 }}>
              <span className="mono">Atakujacy:</span>
              {players.map((p) => (
                <button key={p.id} type="button" className={"chip" + (atkId === p.id ? " on" : "")}
                  onClick={() => { setAtkId(p.id); setEditIdx(null); }}>{p.emoji} {p.name} ({ownerCount[p.id] || 0})</button>
              ))}
            </div>
            <div className="field-row" style={{ marginBottom: 10 }}>
              <span className="mono">Tryb pojedynku (gracz vs gracz):</span>
              <button type="button" className={"chip" + (duelMode === "all" ? " on" : "")} onClick={() => setDuelMode("all")}>OBOJE</button>
              <button type="button" className={"chip" + (duelMode === "buzzer" ? " on" : "")} onClick={() => setDuelMode("buzzer")}>BUZZER</button>
            </div>
            <div className="mono small muted" style={{ marginBottom: 8 }}>
              Klik pole = atakuj (musi sasiadowac z terytorium atakujacego). Dwuklik = edytuj wlasciciela/kategorie.
            </div>

            {/* plansza */}
            <div className="board" style={{ gridTemplateColumns: `repeat(${t.size}, 1fr)`, maxWidth: 520 }}>
              {t.cells.map((c) => {
                const col = colorOf[c.owner] || "var(--line)";
                const attackable = canStartDuel(c.idx);
                const emoji = c.owner === "aliens" ? "👽" : (players.find((p) => p.id === c.owner)?.emoji || "·");
                return (
                  <div key={c.idx}
                    className={"cell" + (attackable ? " attackable" : "") + (editIdx === c.idx ? " sel" : "") + (duel && duel.fieldIdx === c.idx ? " target" : "")}
                    style={{ borderColor: col }}
                    onClick={() => { if (!duel && attackable) act("startDuel", { fieldIdx: c.idx, attackerId: atkId, mode: duelMode }); }}
                    onDoubleClick={() => setEditIdx(c.idx)}>
                    <span className="cell-own">{emoji}</span>
                    <span className="cell-cat" style={{ color: catMap[c.categoryId]?.color }}>{catMap[c.categoryId]?.name}</span>
                  </div>
                );
              })}
            </div>

            {/* edycja pola */}
            {editIdx != null && t.cells[editIdx] && (
              <div className="panel" style={{ padding: 12, marginTop: 12 }}>
                <div className="mono" style={{ marginBottom: 6 }}>Edycja pola #{editIdx}</div>
                <div className="field-row">
                  <span className="mono">Wlasciciel:</span>
                  <button className={"chip" + (t.cells[editIdx].owner === "aliens" ? " on" : "")} onClick={() => act("setFieldOwner", { idx: editIdx, owner: "aliens" })}>👽 Kosmici</button>
                  {players.map((p) => (
                    <button key={p.id} className={"chip" + (t.cells[editIdx].owner === p.id ? " on" : "")} onClick={() => act("setFieldOwner", { idx: editIdx, owner: p.id })}>{p.emoji} {p.name}</button>
                  ))}
                </div>
                <div className="field-row" style={{ marginTop: 8 }}>
                  <span className="mono">Kategoria:</span>
                  {cats.filter((c) => !c.final).map((c) => (
                    <button key={c.id} className={"chip" + (t.cells[editIdx].categoryId === c.id ? " on" : "")} onClick={() => act("setFieldCategory", { idx: editIdx, categoryId: c.id })}>{c.name}</button>
                  ))}
                </div>
                <button className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => setEditIdx(null)}>Zamknij edycje</button>
              </div>
            )}

            {/* pojedynek w toku */}
            {duel && (
              <div className="panel" style={{ padding: 12, marginTop: 12, borderColor: "var(--amber)" }}>
                <div className="display" style={{ color: "var(--amber)", fontSize: 18 }}>
                  POJEDYNEK o pole #{duel.fieldIdx} · {catMap[t.cells[duel.fieldIdx]?.categoryId]?.name}
                </div>
                <div className="mono" style={{ margin: "6px 0" }}>
                  {playerMap[duel.attackerId]?.emoji} {playerMap[duel.attackerId]?.name} (atak) vs{" "}
                  {duel.defenderId === "aliens" ? "👽 Kosmici" : (playerMap[duel.defenderId]?.emoji + " " + playerMap[duel.defenderId]?.name)} · tryb: {duel.mode}
                </div>

                {duel.resolved ? (
                  <div className="col">
                    <div className="display" style={{ color: "var(--green)" }}>
                      Zwyciezca: {duel.winner === "aliens" ? "👽 Kosmici" : (playerMap[duel.winner]?.emoji + " " + playerMap[duel.winner]?.name)}
                    </div>
                    <button className="btn btn-green" onClick={() => { act("clearDuel"); setAtkId(""); }}>OK — dalej</button>
                  </div>
                ) : (
                  <>
                    {/* reuzywamy standardowych przyciskow: odkryj odpowiedzi / buzzer / ocena */}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "8px 0" }}>
                      {duel.mode === "buzzer" && (
                        <>
                          {!state.buzzerOpen && !state.buzzerWinnerId && <button className="btn btn-mag btn-sm" onClick={() => act("openBuzzer")}>OTWORZ BUZZER</button>}
                          <button className="btn btn-green btn-sm" onClick={() => act("acceptBuzz", {})} disabled={!buzz.length}>ZATWIERDZ PIERWSZEGO</button>
                          {state.buzzerWinnerId && <button className="btn btn-amber btn-sm" onClick={() => act("duelPass")}>PRZEKAZ RYWALOWI</button>}
                          <button className="btn btn-sm" onClick={() => act("clearBuzzer")}>RESET BUZZERA</button>
                        </>
                      )}
                      <button className="btn btn-amber btn-sm" onClick={() => act("revealAnswers")} disabled={state.answersRevealed}>ODKRYJ ODPOWIEDZI</button>
                    </div>

                    {/* lista uprawnionych do oceny */}
                    <div style={{ display: "grid", gap: 6 }}>
                      {(state.eligibleIds || []).map((pid) => {
                        const a = answers[pid];
                        const isClosed = q?.type === "closed";
                        return (
                          <div key={pid} className="panel" style={{ padding: 8 }}>
                            <span className="mono">{playerMap[pid]?.emoji} {playerMap[pid]?.name}: {a ? (isClosed ? (OPT_KEYS[q.options.findIndex((o) => o.id === a.optionId)] || "?") : ("„" + (a.text || "") + "")) : "—"}</span>
                            {isClosed ? (
                              <span className="mono small muted"> {a && q && a.optionId === q.correctOptionId ? "✓ dobrze" : a ? "✗ zle" : ""}</span>
                            ) : (
                              <span style={{ marginLeft: 8 }}>
                                <button className="btn btn-green btn-sm" onClick={() => act("judgeAnswer", { pid, correct: true })}>OK</button>{" "}
                                <button className="btn btn-mag btn-sm" onClick={() => act("judgeAnswer", { pid, correct: false })}>ZLE</button>
                                {a?.judged === true && <span className="mono" style={{ color: "var(--green)" }}> uznane</span>}
                                {a?.judged === false && <span className="mono" style={{ color: "var(--magenta)" }}> odrzucone</span>}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <button className="btn btn-green btn-lg" style={{ marginTop: 10 }} onClick={() => act("resolveDuel")}>ROZSTRZYGNIJ POJEDYNEK</button>
                  </>
                )}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
              <button className="btn btn-green btn-lg" onClick={() => { if (confirm("Zakonczyc walke o terytorium i przejsc do FINALU (Szacowanie)? Punkty = liczba pol.")) act("startFinal"); }}>
                ▶ PRZEJDZ DO FINALU
              </button>
              <button className="btn btn-mag" onClick={() => act("endGame")}>ZAKONCZ GRE</button>
            </div>
          </div>
        );
      })()}

      {/* ===================== RUNDA 3: FINAL (SZACOWANIE) ===================== */}
      {phase === "final" && (() => {
        const fin = view.final;
        const estQuestions = (questions || []).filter((x) => x.categoryId === "cat_szacowanie");
        const used = new Set(state.usedQuestionIds || []);
        const finalists = (fin?.duelIds || []).map((id) => playerMap[id]).filter(Boolean);
        return (
          <div className="panel">
            <h3 className="display" style={{ color: "var(--green)", marginTop: 0 }}>FINAL · SZACOWANIE</h3>
            <div className="mono" style={{ marginBottom: 8 }}>
              Finalisci: {finalists.map((p) => `${p.emoji} ${p.name}`).join(" vs ") || "—"} ·
              Szansa manipulacji: <b style={{ color: "var(--magenta)" }}>{Math.round((fin?.manipChance || 0) * 100)}%</b>
            </div>

            {(!fin?.questionId || fin?.revealed) && (
              <div style={{ marginBottom: 12 }}>
                <div className="field-row" style={{ marginBottom: 8 }}>
                  <span className="mono">Typ (override):</span>
                  <button className={"chip" + (estType === "" ? " on" : "")} onClick={() => setEstType("")}>z pytania</button>
                  <button className={"chip" + (estType === "integer" ? " on" : "")} onClick={() => setEstType("integer")}>integer</button>
                  <button className={"chip" + (estType === "float" ? " on" : "")} onClick={() => setEstType("float")}>float</button>
                  <button className={"chip" + (estType === "time" ? " on" : "")} onClick={() => setEstType("time")}>time</button>
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  {estQuestions.length === 0 && <span className="mono muted">Brak pytan w kategorii SZACOWANIE (zaseeduj baze).</span>}
                  {estQuestions.map((qq) => (
                    <div key={qq.id} className="panel" style={{ display: "flex", gap: 10, alignItems: "center", padding: 10, opacity: used.has(qq.id) ? 0.5 : 1 }}>
                      <span className="mono" style={{ flex: 1 }}>[{qq.estimateType}] {qq.text} {used.has(qq.id) ? "· (uzyte)" : ""}</span>
                      <button className="btn btn-green btn-sm" disabled={used.has(qq.id)}
                        onClick={() => act("presentEstimate", { questionId: qq.id, estimateType: estType || undefined })}>POKAZ</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {fin?.questionId && !fin?.revealed && (
              <div className="panel" style={{ padding: 12 }}>
                <div className="mono">Zebrane szacunki:</div>
                <div style={{ display: "grid", gap: 4, margin: "6px 0" }}>
                  {(fin.duelIds || []).map((pid) => (
                    <span key={pid} className="mono">
                      {playerMap[pid]?.emoji} {playerMap[pid]?.name}: {answeredIds.includes(pid) ? "✓ wyslal" : "… czeka"}
                    </span>
                  ))}
                </div>
                {countdown && <div className="mono" style={{ color: "var(--cyan)" }}>{Math.ceil(countdown.left)}s</div>}
                <button className="btn btn-amber btn-lg" style={{ marginTop: 8 }} onClick={() => act("revealEstimate")}>
                  UJAWNIJ + LOSUJ MANIPULACJE
                </button>
              </div>
            )}

            {fin?.revealed && (
              <div className="panel" style={{ padding: 12 }}>
                <div className="mono">Poprawna{fin.manipulated ? " (zmanipulowana o 10%)" : ""}: <b style={{ color: "var(--amber)" }}>{fin.manipValue}</b></div>
                <div className="mono" style={{ marginTop: 4 }}>
                  Zwyciezca rundy: {fin.winnerId ? `${playerMap[fin.winnerId]?.emoji} ${playerMap[fin.winnerId]?.name}` : "—"}
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
              <button className="btn btn-mag btn-lg" onClick={() => { if (confirm("Zakonczyc final i pokazac tablice wynikow?")) act("endGame"); }}>
                ZAKONCZ I POKAZ WYNIKI
              </button>
            </div>
          </div>
        );
      })()}

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
