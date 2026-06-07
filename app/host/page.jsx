"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import Bank from "./Bank";
import GameControl from "./GameControl";

const LS_SECRET = "vhsquiz:secret";
const LS_GAME = "vhsquiz:hostgame";

async function getWithSecret(url, secret) {
  const res = await fetch(url, {
    headers: secret ? { "x-host-secret": secret } : {},
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Blad ${res.status}`);
  return data;
}

export default function HostPage() {
  const [secret, setSecret] = useState("");
  const [secretInput, setSecretInput] = useState("");
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState("game");
  const [categories, setCategories] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [creating, setCreating] = useState(false);

  // wczytanie zapisanych danych
  useEffect(() => {
    const s = localStorage.getItem(LS_SECRET) || "";
    const g = localStorage.getItem(LS_GAME) || "";
    setSecret(s);
    setSecretInput(s);
    setCode(g);
    setReady(true);
  }, []);

  const reload = useCallback(async () => {
    try {
      const [c, q] = await Promise.all([
        api.get("/api/categories"),
        getWithSecret("/api/questions", secret),
      ]);
      setCategories(c.categories || []);
      setQuestions(q.questions || []);
      setErr("");
    } catch (e) {
      setErr(e.message);
    }
  }, [secret]);

  useEffect(() => {
    if (ready) reload();
  }, [ready, reload]);

  function saveSecret() {
    localStorage.setItem(LS_SECRET, secretInput);
    setSecret(secretInput);
  }

  async function createGame() {
    setCreating(true);
    try {
      const res = await api.post("/api/game", {}, secret);
      setCode(res.code);
      localStorage.setItem(LS_GAME, res.code);
      setTab("game");
    } catch (e) {
      setErr(e.message);
    } finally {
      setCreating(false);
    }
  }

  function forgetGame() {
    localStorage.removeItem(LS_GAME);
    setCode("");
  }

  if (!ready) return null;

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "24px 16px" }}>
      <h1 className="display ca-strong" data-text="HOST" style={{ fontSize: 40, color: "var(--magenta)" }}>
        PANEL HOSTA
      </h1>

      {/* SEKRET */}
      <div className="panel" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <label className="mono">Sekret hosta:</label>
        <input className="mono" type="password" value={secretInput}
          placeholder="(puste = tryb otwarty)"
          onChange={(e) => setSecretInput(e.target.value)} style={{ minWidth: 200 }} />
        <button className="btn btn-cyan btn-sm" onClick={saveSecret}>ZAPISZ SEKRET</button>
        {err && <span className="mono" style={{ color: "var(--magenta)" }}>{err}</span>}
      </div>

      {/* GRA */}
      <div className="panel" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginTop: 14 }}>
        {code ? (
          <>
            <span className="display" style={{ fontSize: 24, color: "var(--cyan)" }}>KOD GRY: {code}</span>
            <a className="btn btn-purple btn-sm" href={`/tv/${code}`} target="_blank" rel="noreferrer">EKRAN TV</a>
            <span className="mono" style={{ opacity: 0.7 }}>{origin}/join (kod: {code})</span>
            <button className="btn btn-amber btn-sm" onClick={createGame} disabled={creating}>NOWA GRA</button>
            <button className="btn btn-mag btn-sm" onClick={forgetGame}>ZAPOMNIJ</button>
          </>
        ) : (
          <button className="btn btn-green btn-lg" onClick={createGame} disabled={creating}>
            {creating ? "TWORZENIE..." : "UTWORZ NOWA GRE"}
          </button>
        )}
      </div>

      {/* ZAKLADKI */}
      <div style={{ display: "flex", gap: 8, margin: "18px 0" }}>
        <button className={"btn " + (tab === "game" ? "active" : "btn-cyan")} onClick={() => setTab("game")}>ROZGRYWKA</button>
        <button className={"btn " + (tab === "bank" ? "active" : "btn-cyan")} onClick={() => { setTab("bank"); reload(); }}>BAZA PYTAN</button>
      </div>

      {tab === "game" && (
        <GameControl secret={secret} code={code} categories={categories} questions={questions} />
      )}
      {tab === "bank" && (
        <Bank secret={secret} categories={categories} questions={questions} reload={reload} />
      )}
    </div>
  );
}
