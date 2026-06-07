"use client";
import { useState } from "react";
import { api } from "@/lib/api";

const COLORS = ["#ff2d78", "#23e0c8", "#ffd23f", "#7c5cff", "#3fa7ff", "#ff7a2d", "#3ddc7f"];
const OPT_IDS = ["a", "b", "c", "d"];

function emptyQ() {
  return {
    id: null,
    categoryId: "",
    type: "closed",
    text: "",
    mediaType: "",
    mediaUrl: "",
    options: [
      { id: "a", text: "" },
      { id: "b", text: "" },
      { id: "c", text: "" },
      { id: "d", text: "" },
    ],
    correctOptionId: "a",
    correctAnswer: "",
  };
}

export default function Bank({ secret, categories, questions, reload }) {
  const [catName, setCatName] = useState("");
  const [catColor, setCatColor] = useState(COLORS[0]);
  const [q, setQ] = useState(emptyQ());
  const [filter, setFilter] = useState("");
  const [msg, setMsg] = useState("");
  const [seeding, setSeeding] = useState(false);

  function note(m) { setMsg(m); setTimeout(() => setMsg(""), 2500); }

  async function addCategory() {
    if (!catName.trim()) return;
    try {
      await api.post("/api/categories", { name: catName.trim().toUpperCase(), color: catColor }, secret);
      setCatName("");
      reload();
    } catch (e) { note(e.message); }
  }

  async function delCategory(id) {
    if (!confirm("Usunac kategorie i wszystkie jej pytania?")) return;
    await api.del(`/api/categories/${id}`, secret);
    reload();
  }

  function editQuestion(question) {
    setQ({
      id: question.id,
      categoryId: question.categoryId,
      type: question.type,
      text: question.text,
      mediaType: question.media?.type || "",
      mediaUrl: question.media?.url || "",
      options: question.type === "closed"
        ? OPT_IDS.map((id, i) => question.options[i] || { id, text: "" })
        : emptyQ().options,
      correctOptionId: question.correctOptionId || "a",
      correctAnswer: question.correctAnswer || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveQuestion() {
    const payload = {
      id: q.id,
      categoryId: q.categoryId,
      type: q.type,
      text: q.text,
      media: q.mediaType && q.mediaUrl ? { type: q.mediaType, url: q.mediaUrl } : null,
      options: q.type === "closed" ? q.options.filter((o) => o.text.trim()).map((o) => ({ id: o.id, text: o.text.trim() })) : [],
      correctOptionId: q.correctOptionId,
      correctAnswer: q.correctAnswer,
    };
    try {
      await api.post("/api/questions", payload, secret);
      setQ(emptyQ());
      note("Zapisano pytanie ✓");
      reload();
    } catch (e) { note(e.message); }
  }

  async function delQuestion(id) {
    if (!confirm("Usunac pytanie?")) return;
    await api.del(`/api/questions/${id}`, secret);
    reload();
  }

  async function seed() {
    setSeeding(true);
    try {
      await api.post("/api/seed", {}, secret);
      note("Zaseedowano przykladowe pytania ✓");
      reload();
    } catch (e) { note(e.message); }
    setSeeding(false);
  }

  const shown = filter ? questions.filter((x) => x.categoryId === filter) : questions;
  const catName2 = (id) => categories.find((c) => c.id === id)?.name || "?";

  return (
    <div className="col">
      {/* KATEGORIE */}
      <div className="panel col">
        <div className="spread">
          <h3 className="display ca" style={{ fontSize: 22 }}>KATEGORIE</h3>
          <button className="btn btn-sm btn-amber" onClick={seed} disabled={seeding}>
            {seeding ? "..." : "⤓ Zaseeduj 12 pytan"}
          </button>
        </div>
        <div className="row">
          {categories.map((c) => (
            <span key={c.id} className="tag" style={{ color: c.color, borderColor: c.color }}>
              {c.name}
              <button className="btn btn-sm" style={{ marginLeft: 8, padding: "0 6px", borderColor: c.color, color: c.color }} onClick={() => delCategory(c.id)}>×</button>
            </span>
          ))}
          {categories.length === 0 && <span className="muted mono small">Brak kategorii</span>}
        </div>
        <div className="row">
          <input style={{ flex: 1, minWidth: 160 }} value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="Nazwa kategorii" />
          <div className="row" style={{ gap: 6 }}>
            {COLORS.map((c) => (
              <button key={c} onClick={() => setCatColor(c)} style={{ width: 26, height: 26, background: c, border: catColor === c ? "2px solid #fff" : "1px solid #000", borderRadius: 3, cursor: "pointer" }} />
            ))}
          </div>
          <button className="btn btn-cyan" onClick={addCategory}>+ Dodaj</button>
        </div>
      </div>

      {/* EDYTOR PYTANIA */}
      <div className="panel col">
        <h3 className="display ca" style={{ fontSize: 22 }}>{q.id ? "EDYTUJ PYTANIE" : "NOWE PYTANIE"}</h3>

        <div className="row">
          <div className="flex1">
            <div className="label">Kategoria</div>
            <select value={q.categoryId} onChange={(e) => setQ({ ...q, categoryId: e.target.value })}>
              <option value="">— wybierz —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <div className="label">Typ</div>
            <div className="row" style={{ gap: 8 }}>
              <button className={`btn ${q.type === "closed" ? "btn-cyan active" : ""}`} onClick={() => setQ({ ...q, type: "closed" })}>Zamkniete</button>
              <button className={`btn ${q.type === "open" ? "btn-cyan active" : ""}`} onClick={() => setQ({ ...q, type: "open" })}>Otwarte</button>
            </div>
          </div>
        </div>

        <div>
          <div className="label">Tresc pytania</div>
          <textarea value={q.text} onChange={(e) => setQ({ ...q, text: e.target.value })} placeholder="O co pytamy?" />
        </div>

        <div className="row">
          <div>
            <div className="label">Medium (opcjonalnie)</div>
            <select value={q.mediaType} onChange={(e) => setQ({ ...q, mediaType: e.target.value })}>
              <option value="">brak</option>
              <option value="image">ilustracja</option>
              <option value="video">wideo</option>
              <option value="audio">muzyka</option>
            </select>
          </div>
          {q.mediaType && (
            <div className="flex1">
              <div className="label">URL ({q.mediaType})</div>
              <input value={q.mediaUrl} onChange={(e) => setQ({ ...q, mediaUrl: e.target.value })} placeholder="https://..." />
            </div>
          )}
        </div>

        {q.type === "closed" ? (
          <div className="col">
            <div className="label">Odpowiedzi (zaznacz poprawna)</div>
            {q.options.map((o, i) => (
              <div key={o.id} className="row" style={{ gap: 8 }}>
                <button
                  className={`btn btn-sm ${q.correctOptionId === o.id ? "btn-green active" : ""}`}
                  style={{ minWidth: 60 }}
                  onClick={() => setQ({ ...q, correctOptionId: o.id })}
                >
                  {q.correctOptionId === o.id ? "✓ poprawna" : OPT_IDS[i].toUpperCase()}
                </button>
                <input
                  style={{ flex: 1 }}
                  value={o.text}
                  onChange={(e) => {
                    const opts = [...q.options];
                    opts[i] = { ...o, text: e.target.value };
                    setQ({ ...q, options: opts });
                  }}
                  placeholder={`Odpowiedz ${OPT_IDS[i].toUpperCase()}`}
                />
              </div>
            ))}
          </div>
        ) : (
          <div>
            <div className="label">Poprawna odpowiedz (dla hosta)</div>
            <input value={q.correctAnswer} onChange={(e) => setQ({ ...q, correctAnswer: e.target.value })} placeholder="Wzorcowa odpowiedz" />
          </div>
        )}

        <div className="row">
          <button className="btn btn-cyan" onClick={saveQuestion}>{q.id ? "💾 Zapisz zmiany" : "+ Dodaj pytanie"}</button>
          {q.id && <button className="btn" onClick={() => setQ(emptyQ())}>Anuluj edycje</button>}
        </div>
      </div>

      {/* LISTA PYTAN */}
      <div className="panel col">
        <div className="spread">
          <h3 className="display ca" style={{ fontSize: 22 }}>PYTANIA ({questions.length})</h3>
          <select style={{ width: 200 }} value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">wszystkie kategorie</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="col" style={{ gap: 8, maxHeight: 420, overflowY: "auto" }}>
          {shown.map((question) => (
            <div key={question.id} className="spread" style={{ borderBottom: "1px solid var(--line)", paddingBottom: 8 }}>
              <div className="flex1">
                <span className="tag" style={{ marginRight: 8 }}>{catName2(question.categoryId)}</span>
                <span className="pill" style={{ marginRight: 8 }}>{question.type === "open" ? "otwarte" : "zamkniete"}</span>
                {question.media && <span className="pill" style={{ marginRight: 8 }}>📎 {question.media.type}</span>}
                <span>{question.text}</span>
              </div>
              <div className="row" style={{ gap: 6 }}>
                <button className="btn btn-sm" onClick={() => editQuestion(question)}>edytuj</button>
                <button className="btn btn-sm btn-mag" onClick={() => delQuestion(question.id)}>usun</button>
              </div>
            </div>
          ))}
          {shown.length === 0 && <div className="muted mono small">Brak pytan — dodaj wlasne lub uzyj seeda.</div>}
        </div>
      </div>

      {msg && <div className="toast">{msg}</div>}
    </div>
  );
}
