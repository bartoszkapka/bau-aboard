import {
  getGame, saveGame, getQuestion, getQuestions, getCategories,
  getPlayers, setPlayer, getPlayer, removePlayer,
  getAnswers, setAnswer, clearAnswers, clearBuzz, getBuzz,
  freshQuestionState,
} from "@/lib/store";
import { checkHost, unauthorized } from "@/lib/auth";

export const dynamic = "force-dynamic";

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const clampN = (n, lo, hi) => Math.max(lo, Math.min(hi, Number(n) || 0));

function neighbors(idx, size) {
  const r = Math.floor(idx / size), c = idx % size, out = [];
  if (r > 0) out.push(idx - size);
  if (r < size - 1) out.push(idx + size);
  if (c > 0) out.push(idx - 1);
  if (c < size - 1) out.push(idx + 1);
  return out;
}

async function pickUnusedQuestion(game, categoryId) {
  const qs = await getQuestions();
  const used = new Set(game.usedQuestionIds || []);
  let pool = qs.filter((q) => q.categoryId === categoryId && q.type !== "estimate" && !used.has(q.id));
  if (!pool.length) pool = qs.filter((q) => q.categoryId !== "cat_szacowanie" && q.type !== "estimate" && !used.has(q.id));
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

async function pickCategories(game, count) {
  const [cats, questions] = await Promise.all([getCategories(), getQuestions()]);
  const used = new Set(game.usedQuestionIds || []);
  const available = cats.filter((c) =>
    !c.final && questions.some((q) => q.categoryId === c.id && q.type !== "estimate" && !used.has(q.id))
  );
  const n = Math.max(1, Math.min(count || game.settings.categoriesToShow || 4, available.length));
  return shuffle(available).slice(0, n).map((c) => c.id);
}

async function buildTerritory(game, size) {
  size = clampN(size, 2, 8);
  const [cats, qs, allPlayers] = await Promise.all([getCategories(), getQuestions(), getPlayers(game.code)]);
  const players = allPlayers.filter((p) => !p.isTV);
  const total = size * size;
  let aliens = Math.floor(total / 2); // kosmici 50%
  // gwarancja min. 1 pola na gracza — w razie potrzeby ograniczamy kosmitow
  if (players.length > total - aliens) aliens = Math.max(0, total - players.length);
  const playerCells = total - aliens;

  const counts = players.map(() => 0);
  if (players.length) {
    const base = Math.min(players.length, playerCells);
    for (let i = 0; i < base; i++) counts[i] = 1; // minimum 1 pole
    let rem = playerCells - base;
    if (rem > 0) {
      const sum = players.reduce((s, p) => s + Math.max(0, p.score || 0), 0);
      if (sum <= 0) {
        let i = 0; while (rem > 0) { counts[i % players.length]++; rem--; i++; }
      } else {
        const raw = players.map((p) => rem * Math.max(0, p.score || 0) / sum);
        const add = raw.map((x) => Math.floor(x));
        const r2 = rem - add.reduce((a, b) => a + b, 0);
        const order = raw.map((x, i) => ({ i, f: x - Math.floor(x) })).sort((a, b) => b.f - a.f);
        for (let k = 0; k < r2; k++) add[order[k % order.length].i]++;
        for (let i = 0; i < counts.length; i++) counts[i] += add[i];
      }
    }
  }

  let avail = cats.filter((c) => !c.final && qs.some((q) => q.categoryId === c.id && q.type !== "estimate" && !(new Set(game.usedQuestionIds || [])).has(q.id)));
  if (!avail.length) avail = cats.filter((c) => !c.final);
  if (!avail.length) avail = cats.slice(0, 1);
  const availS = shuffle(avail);

  const owners = [];
  for (let i = 0; i < aliens; i++) owners.push("aliens");
  players.forEach((p, idx) => { for (let k = 0; k < counts[idx]; k++) owners.push(p.id); });
  while (owners.length < total) owners.push("aliens");
  const randomOwners = shuffle(owners); // pola rozlosowane losowo

  const cells = [];
  for (let idx = 0; idx < total; idx++) {
    const cat = availS[idx % availS.length];
    cells.push({ idx, row: Math.floor(idx / size), col: idx % size, categoryId: cat.id, owner: randomOwners[idx] });
  }
  return { size, total, cells, duel: null };
}

async function applyScoring(game) {
  if (game.scored) return;
  const q = await getQuestion(game.currentQuestionId);
  if (!q) return;
  const [answers, players] = await Promise.all([getAnswers(game.code), getPlayers(game.code)]);

  const eligibleSet =
    game.answerMode === "all"
      ? new Set(players.filter((p) => !p.isTV).map((p) => p.id))
      : new Set(game.eligibleIds || []);

  const playerMap = {};
  for (const p of players) playerMap[p.id] = p;
  const touched = new Set();

  const correctEntries = [];
  for (const pid of Object.keys(answers)) {
    if (!eligibleSet.has(pid)) continue;
    const a = answers[pid];
    if (a.late && a.lateAccepted !== true) continue; // po czasie i niezaliczona = pomijamy (liczy sie jak bledna)
    let correct = q.type === "closed" ? a.optionId && a.optionId === q.correctOptionId : a.judged === true;
    if (correct) correctEntries.push({ pid, order: a.order || 999 });
  }
  correctEntries.sort((x, y) => x.order - y.order);

  const base = game.settings.pointsPerQuestion || 0;
  const bonuses = Array.isArray(game.settings.bonuses) ? game.settings.bonuses : [game.settings.bonusPoints || 0];
  const allowSpeed = game.settings.speedBonus && eligibleSet.size > 1 && game.answerMode !== "buzzer";
  correctEntries.forEach((e, idx) => {
    const p = playerMap[e.pid];
    if (!p) return;
    let gain = base;
    if (allowSpeed && bonuses[idx]) gain += Number(bonuses[idx]) || 0;
    p.score = (p.score || 0) + gain;
    touched.add(e.pid);
  });

  // kara za bledna odpowiedz — TAKZE za brak odpowiedzi (kazdy uprawniony bez poprawnej)
  const penalty = Number(game.settings.wrongPenalty) || 0;
  if (penalty > 0) {
    const correctIds = new Set(correctEntries.map((e) => e.pid));
    for (const pid of eligibleSet) {
      if (correctIds.has(pid)) continue;
      const p = playerMap[pid];
      if (p) { p.score = (p.score || 0) - penalty; touched.add(pid); }
    }
  }

  await Promise.all([...touched].map((pid) => playerMap[pid] && setPlayer(game.code, playerMap[pid])));
  game.scored = true;
}

export async function POST(req, { params }) {
  if (!checkHost(req)) return unauthorized();
  const { code } = await params;
  const game = await getGame(code);
  if (!game) return Response.json({ error: "Nie ma gry" }, { status: 404 });

  const body = await req.json();
  const action = body.action;

  switch (action) {
    case "updateSettings": {
      game.settings = { ...game.settings, ...(body.settings || {}) };
      break;
    }
    case "start": {
      game.status = "active";
      game.phase = "category";
      game.round = 1;
      game.roundType = "classic";
      Object.assign(game, freshQuestionState());
      game.shownCategoryIds = await pickCategories(game, body.count);
      await clearAnswers(code); await clearBuzz(code);
      break;
    }
    case "showCategories": {
      game.phase = "category";
      Object.assign(game, freshQuestionState());
      game.shownCategoryIds = await pickCategories(game, body.count);
      await clearAnswers(code); await clearBuzz(code);
      break;
    }
    case "selectCategory": {
      game.selectedCategoryId = body.categoryId || null;
      break;
    }
    case "presentQuestion": {
      const q = await getQuestion(body.questionId);
      if (!q) return Response.json({ error: "Nie ma pytania" }, { status: 404 });
      Object.assign(game, freshQuestionState());
      game.phase = "question";
      game.questionNumber = (game.questionNumber || 0) + 1;
      game.currentQuestionId = q.id;
      game.selectedCategoryId = q.categoryId;
      game.answerMode = body.answerMode || "all";
      game.usedQuestionIds = Array.from(new Set([...(game.usedQuestionIds || []), q.id]));
      await clearAnswers(code); await clearBuzz(code);
      break;
    }
    case "setAnswerMode": {
      game.answerMode = body.mode || "all";
      game.eligibleIds = body.mode === "select" ? body.eligibleIds || [] : [];
      game.buzzerOpen = false;
      game.buzzerWinnerId = null;
      await clearBuzz(code);
      break;
    }
    case "openBuzzer": {
      game.answerMode = "buzzer";
      game.buzzerOpen = true;
      game.buzzerWinnerId = null;
      // w pojedynku ograniczamy buzzer do dwoch graczy (eligibleIds ustawia UI), inaczej czyscimy
      if (!(game.territory && game.territory.duel)) game.eligibleIds = [];
      await clearBuzz(code);
      break;
    }
    case "acceptBuzz": {
      const buzz = await getBuzz(code);
      const winner = body.pid || buzz[0] || null;
      game.buzzerWinnerId = winner;
      game.eligibleIds = winner ? [winner] : [];
      game.buzzerOpen = false;
      break;
    }
    case "clearBuzzer": {
      game.buzzerOpen = true;
      game.buzzerWinnerId = null;
      if (!(game.territory && game.territory.duel)) game.eligibleIds = [];
      await clearBuzz(code);
      break;
    }
    case "revealAnswers": {
      game.answersRevealed = true;
      if (game.settings.timeLimitSec > 0)
        game.timer = { startedAt: Date.now(), durationSec: game.settings.timeLimitSec, running: true };
      break;
    }
    case "startTimer": {
      const dur = body.durationSec != null ? body.durationSec : game.settings.timeLimitSec;
      game.timer = { startedAt: Date.now(), durationSec: dur, running: true };
      break;
    }
    case "stopTimer": {
      game.timer = { ...game.timer, running: false };
      break;
    }
    case "markAnswer": {
      const pid = body.pid;
      const existing = await getAnswers(code);
      const order = existing[pid]?.order || Object.keys(existing).length + 1;
      await setAnswer(code, pid, {
        pid,
        optionId: body.optionId || null,
        text: body.text != null ? String(body.text) : existing[pid]?.text || "",
        value: body.value != null ? Number(body.value) : existing[pid]?.value ?? null,
        order, at: Date.now(), byHost: true,
        judged: body.correct != null ? !!body.correct : existing[pid]?.judged ?? null,
        late: existing[pid]?.late ?? false,
        lateAccepted: existing[pid]?.lateAccepted ?? false,
      });
      break;
    }
    case "judgeAnswer": {
      const pid = body.pid;
      const existing = await getAnswers(code);
      if (existing[pid]) { existing[pid].judged = !!body.correct; await setAnswer(code, pid, existing[pid]); }
      break;
    }
    case "acceptLate": {
      const pid = body.pid;
      const existing = await getAnswers(code);
      if (existing[pid]) { existing[pid].lateAccepted = !!body.accept; await setAnswer(code, pid, existing[pid]); }
      break;
    }
    case "revealCorrect": {
      await applyScoring(game);
      game.correctRevealed = true;
      game.phase = "reveal";
      game.timer = { ...game.timer, running: false };
      break;
    }
    case "adjustPoints": {
      const p = await getPlayer(code, body.pid);
      if (p) {
        if (body.value != null) p.score = Number(body.value) || 0;
        else p.score = (p.score || 0) + (Number(body.delta) || 0);
        await setPlayer(code, p);
      }
      break;
    }
    case "nextRound": {
      game.phase = "category";
      Object.assign(game, freshQuestionState());
      game.shownCategoryIds = await pickCategories(game, body.count);
      await clearAnswers(code); await clearBuzz(code);
      break;
    }

    /* ----------------------- RUNDA 2: TERYTORIUM ---------------------- */
    case "startTerritory": {
      game.roundType = "territory";
      game.round = 2;
      game.phase = "territory";
      Object.assign(game, freshQuestionState());
      game.territory = await buildTerritory(game, body.size || game.settings.boardSize);
      await clearAnswers(code); await clearBuzz(code);
      break;
    }
    case "setFieldOwner": {
      const t = game.territory;
      if (t && t.cells[body.idx]) t.cells[body.idx].owner = body.owner;
      break;
    }
    case "setFieldCategory": {
      const t = game.territory;
      if (t && t.cells[body.idx]) t.cells[body.idx].categoryId = body.categoryId;
      break;
    }
    case "startDuel": {
      const t = game.territory;
      if (!t) return Response.json({ error: "Brak planszy" }, { status: 400 });
      const idx = body.fieldIdx;
      const cell = t.cells[idx];
      if (!cell) return Response.json({ error: "Zle pole" }, { status: 400 });
      const attackerId = body.attackerId;
      const defenderId = cell.owner;
      if (defenderId === attackerId) return Response.json({ error: "Atakujacy juz ma to pole" }, { status: 400 });
      const adj = neighbors(idx, t.size).some((n) => t.cells[n].owner === attackerId);
      if (!adj && !body.force) return Response.json({ error: "Pole nie sasiaduje z terytorium atakujacego" }, { status: 400 });
      const q = await pickUnusedQuestion(game, cell.categoryId);
      if (!q) return Response.json({ error: "Brak dostepnych pytan" }, { status: 400 });
      Object.assign(game, freshQuestionState());
      game.questionNumber = (game.questionNumber || 0) + 1;
      game.currentQuestionId = q.id;
      game.usedQuestionIds = Array.from(new Set([...(game.usedQuestionIds || []), q.id]));
      const mode = defenderId === "aliens" ? "aliens" : (body.mode || "all");
      if (defenderId === "aliens") { game.answerMode = "select"; game.eligibleIds = [attackerId]; }
      else if (mode === "buzzer") { game.answerMode = "buzzer"; game.buzzerOpen = false; game.eligibleIds = []; }
      else { game.answerMode = "select"; game.eligibleIds = [attackerId, defenderId]; }
      t.duel = { fieldIdx: idx, attackerId, defenderId, mode, resolved: false, winner: null };
      await clearAnswers(code); await clearBuzz(code);
      break;
    }
    case "duelPass": {
      const t = game.territory;
      if (!t || !t.duel) break;
      const d = t.duel;
      const other = body.pid || (game.eligibleIds[0] === d.attackerId ? d.defenderId : d.attackerId);
      game.eligibleIds = [other];
      game.buzzerWinnerId = other;
      game.buzzerOpen = false;
      break;
    }
    case "resolveDuel": {
      const t = game.territory;
      if (!t || !t.duel) break;
      const d = t.duel;
      const q = await getQuestion(game.currentQuestionId);
      const answers = await getAnswers(code);
      const correctOf = (pid) => {
        const a = answers[pid];
        if (!a) return false;
        if (a.late && a.lateAccepted !== true) return false; // po czasie i niezaliczona
        if (q && q.type === "closed") return a.optionId && a.optionId === q.correctOptionId;
        return a.judged === true;
      };
      const orderOf = (pid) => (answers[pid]?.order != null ? answers[pid].order : 999);
      let winner;
      if (d.defenderId === "aliens") {
        winner = correctOf(d.attackerId) ? d.attackerId : "aliens";
      } else {
        const ac = correctOf(d.attackerId), dc = correctOf(d.defenderId);
        if (ac && dc) winner = orderOf(d.attackerId) <= orderOf(d.defenderId) ? d.attackerId : d.defenderId;
        else if (ac) winner = d.attackerId;
        else if (dc) winner = d.defenderId;
        else winner = "aliens";
      }
      t.cells[d.fieldIdx].owner = winner;
      t.duel = { ...d, resolved: true, winner };
      game.currentQuestionId = null;
      game.answerMode = "all"; game.eligibleIds = []; game.buzzerOpen = false; game.buzzerWinnerId = null;
      await clearAnswers(code); await clearBuzz(code);
      break;
    }
    case "clearDuel": {
      if (game.territory) game.territory.duel = null;
      game.currentQuestionId = null;
      Object.assign(game, freshQuestionState());
      await clearAnswers(code); await clearBuzz(code);
      break;
    }

    /* ----------------------- RUNDA 3: SZACOWANIE ---------------------- */
    case "startFinal": {
      const t = game.territory;
      const total = t ? t.total : 0;
      const players = (await getPlayers(code)).filter((p) => !p.isTV);
      const cnt = {};
      let aliensCells = 0;
      if (t) for (const c of t.cells) { if (c.owner === "aliens") aliensCells++; else cnt[c.owner] = (cnt[c.owner] || 0) + 1; }
      // kazde posiadane pole = 100 pkt, doliczane do dotychczasowych punktow
      for (const p of players) { p.score = (p.score || 0) + (cnt[p.id] || 0) * 100; await setPlayer(code, p); }
      const duelIds = players.filter((p) => (cnt[p.id] || 0) > 0).map((p) => p.id);
      game.roundType = "final";
      game.round = 3;
      game.phase = "final";
      Object.assign(game, freshQuestionState());
      game.final = {
        duelIds, manipChance: total ? aliensCells / total : 0,
        phase: "idle", estimates: {}, submittedIds: [], revealed: false, questionId: null,
        manipDrawn: false, manipulated: null, manipValue: null,
      };
      await clearAnswers(code); await clearBuzz(code);
      break;
    }
    case "presentEstimate": {
      const q = await getQuestion(body.questionId);
      if (!q) return Response.json({ error: "Nie ma pytania" }, { status: 404 });
      Object.assign(game, freshQuestionState());
      game.phase = "final";
      game.questionNumber = (game.questionNumber || 0) + 1;
      game.currentQuestionId = q.id;
      game.usedQuestionIds = Array.from(new Set([...(game.usedQuestionIds || []), q.id]));
      game.answerMode = "select";
      game.eligibleIds = game.final?.duelIds || [];
      const estimateType = body.estimateType || q.estimateType || "integer";
      const correctValue = Number(q.correctValue) || 0;
      // Manipulacja losowana JESZCZE PRZED odpowiedziami
      const manipChance = game.final?.manipChance || 0;
      const manipulated = Math.random() < manipChance;
      let manipValue = correctValue;
      if (manipulated) {
        const sign = Math.random() < 0.5 ? -1 : 1;
        let v = correctValue * (1 + sign * 0.10);
        if (estimateType === "integer" || estimateType === "time") v = Math.round(v);
        else v = Math.round(v * 100) / 100;
        manipValue = v;
      }
      game.final = {
        ...(game.final || {}),
        questionId: q.id, estimateType, unit: q.unit || "",
        correctValue, manipChance,
        manipDrawn: true, manipulated, manipValue,
        phase: "collecting", estimates: {}, submittedIds: [], revealed: false,
        winnerId: null, exact: false,
      };
      await clearAnswers(code);
      if (game.settings.timeLimitSec > 0)
        game.timer = { startedAt: Date.now(), durationSec: game.settings.timeLimitSec, running: true };
      break;
    }
    case "revealEstimate": {
      const f = game.final;
      if (!f) break;
      const answers = await getAnswers(code);
      const ids = f.duelIds || [];
      const estimates = {};
      for (const pid of ids) {
        const a = answers[pid];
        if (a && a.late && a.lateAccepted !== true) { estimates[pid] = null; continue; } // po czasie, niezaliczona
        estimates[pid] = a && a.value != null ? Number(a.value) : null;
      }

      const manipValue = f.manipValue != null ? f.manipValue : f.correctValue; // wylosowane wczesniej
      let best = null, bestD = Infinity;
      for (const pid of ids) {
        const v = estimates[pid];
        if (v == null) continue;
        const dd = Math.abs(v - manipValue);
        if (dd < bestD - 1e-9) { bestD = dd; best = pid; }
      }
      const players = await getPlayers(code);
      const pm = {}; for (const p of players) pm[p.id] = p;
      const pts = Number(game.settings.estimatePoints) || 0;
      const exb = Number(game.settings.estimateExactBonus) || 0;
      let exactAny = false;
      if (best && pm[best]) pm[best].score = (pm[best].score || 0) + pts;
      for (const pid of ids) {
        const v = estimates[pid];
        if (v != null && Math.abs(v - manipValue) < 1e-9 && pm[pid]) {
          pm[pid].score = (pm[pid].score || 0) + exb;
          exactAny = true;
        }
      }
      await Promise.all(ids.filter((pid) => pm[pid]).map((pid) => setPlayer(code, pm[pid])));
      f.estimates = estimates; f.winnerId = best; f.exact = exactAny; f.revealed = true; f.phase = "done";
      game.timer = { ...game.timer, running: false };
      break;
    }

    case "removePlayer": {
      await removePlayer(code, body.pid);
      break;
    }
    case "endGame": {
      game.status = "ended";
      game.phase = "reveal";
      break;
    }
    default:
      return Response.json({ error: "Nieznana akcja: " + action }, { status: 400 });
  }

  await saveGame(code, game);
  return Response.json({ ok: true, state: game });
}
