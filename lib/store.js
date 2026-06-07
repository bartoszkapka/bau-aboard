import { redis, KEYS, GAME_TTL } from "./redis";
import { makeId } from "./ids";

/* ----------------------------- KATEGORIE ----------------------------- */

export async function getCategories() {
  const all = (await redis.hgetall(KEYS.categories())) || {};
  return Object.values(all).sort((a, b) => a.name.localeCompare(b.name));
}

export async function saveCategory(cat) {
  const id = cat.id || makeId("cat");
  const record = { id, name: cat.name, color: cat.color || "#23e0c8" };
  await redis.hset(KEYS.categories(), { [id]: record });
  return record;
}

export async function deleteCategory(id) {
  await redis.hdel(KEYS.categories(), id);
  // usun pytania nalezace do kategorii
  const qs = await getQuestions();
  const toDel = qs.filter((q) => q.categoryId === id).map((q) => q.id);
  if (toDel.length) await redis.hdel(KEYS.questions(), ...toDel);
}

/* ------------------------------ PYTANIA ------------------------------ */

export async function getQuestions() {
  const all = (await redis.hgetall(KEYS.questions())) || {};
  return Object.values(all);
}

export async function getQuestion(id) {
  return (await redis.hget(KEYS.questions(), id)) || null;
}

export async function saveQuestion(q) {
  const id = q.id || makeId("q");
  const type = q.type === "open" ? "open" : q.type === "estimate" ? "estimate" : "closed";
  const record = {
    id,
    categoryId: q.categoryId,
    type,
    text: q.text || "",
    media: q.media && q.media.url ? { type: q.media.type, url: q.media.url } : null,
    options: type === "closed" ? (q.options || []).slice(0, 4) : [],
    correctOptionId: type === "closed" ? q.correctOptionId || null : null,
    correctAnswer: type === "open" ? q.correctAnswer || "" : "",
    estimateType: type === "estimate" ? (q.estimateType || "integer") : null,
    correctValue: type === "estimate" ? Number(q.correctValue) || 0 : null,
    unit: type === "estimate" ? (q.unit || "") : "",
  };
  await redis.hset(KEYS.questions(), { [id]: record });
  return record;
}

export async function deleteQuestion(id) {
  await redis.hdel(KEYS.questions(), id);
}

/* -------------------------------- GRA -------------------------------- */

export function defaultSettings() {
  return {
    timeLimitSec: 30, // 0 = bez limitu
    pointsPerQuestion: 100,
    speedBonus: true,
    bonuses: [50, 30, 15], // premie dla 1., 2. i 3. najszybszej poprawnej odpowiedzi
    wrongPenalty: 0, // kara punktowa za bledna odpowiedz (>=0, odejmowana)
    categoriesToShow: 4,
    // RUNDA 2 — walka o terytorium
    boardSize: 4, // matryca boardSize x boardSize
    // RUNDA 3 — szacowanie
    estimatePoints: 100, // punkty dla blizszej odpowiedzi
    estimateExactBonus: 50, // dodatkowo za trafienie dokladne
  };
}

export function freshQuestionState() {
  return {
    selectedCategoryId: null,
    currentQuestionId: null,
    answersRevealed: false, // czy pokazano warianty odpowiedzi
    correctRevealed: false, // czy ujawniono poprawna odpowiedz
    scored: false,
    answerMode: "all", // all | select | buzzer
    eligibleIds: [], // kto moze odpowiadac
    buzzerOpen: false,
    buzzerWinnerId: null,
    timer: { startedAt: null, durationSec: 0, running: false },
  };
}

export async function createGame(settings) {
  const code = settings.code;
  const state = {
    code,
    createdAt: Date.now(),
    status: "lobby", // lobby | active | ended
    phase: "lobby", // lobby | category | question | reveal | territory | final
    round: 0,
    roundType: "classic", // classic | territory | final
    settings: { ...defaultSettings(), ...(settings.settings || {}) },
    shownCategoryIds: [],
    usedQuestionIds: [],
    questionNumber: 0,
    territory: null, // { size, cells:[{idx,row,col,categoryId,owner}], duel, aliensCells }
    final: null, // stan rundy finalowej
    ...freshQuestionState(),
  };
  await redis.set(KEYS.game(code), state, { ex: GAME_TTL });
  await redis.sadd(KEYS.codeIndex(), code);
  return state;
}

export async function getGame(code) {
  return (await redis.get(KEYS.game(code))) || null;
}

export async function saveGame(code, state) {
  await redis.set(KEYS.game(code), state, { ex: GAME_TTL });
  return state;
}

/* ------------------------------ GRACZE ------------------------------- */

export async function getPlayers(code) {
  const all = (await redis.hgetall(KEYS.players(code))) || {};
  return Object.values(all);
}

export async function getPlayer(code, pid) {
  return (await redis.hget(KEYS.players(code), pid)) || null;
}

export async function setPlayer(code, player) {
  await redis.hset(KEYS.players(code), { [player.id]: player });
  await redis.expire(KEYS.players(code), GAME_TTL);
  return player;
}

export async function removePlayer(code, pid) {
  await redis.hdel(KEYS.players(code), pid);
}

/* --------------------------- ODPOWIEDZI ------------------------------ */

export async function getAnswers(code) {
  return (await redis.hgetall(KEYS.answers(code))) || {};
}

export async function setAnswer(code, pid, answer) {
  await redis.hset(KEYS.answers(code), { [pid]: answer });
  await redis.expire(KEYS.answers(code), GAME_TTL);
}

export async function clearAnswers(code) {
  await redis.del(KEYS.answers(code));
}

/* ----------------------------- BUZZER -------------------------------- */

export async function pushBuzz(code, pid) {
  // RPUSH zachowuje kolejnosc dotarcia zadan na serwer
  await redis.rpush(KEYS.buzz(code), pid);
  await redis.expire(KEYS.buzz(code), GAME_TTL);
}

export async function getBuzz(code) {
  return (await redis.lrange(KEYS.buzz(code), 0, -1)) || [];
}

export async function clearBuzz(code) {
  await redis.del(KEYS.buzz(code));
}

/* --------------------- SKLADANIE WIDOKU DLA KLIENTA ------------------ */

function sanitizeQuestion(q, { revealCorrect, includeAnswers }) {
  if (!q) return null;
  const out = {
    id: q.id,
    categoryId: q.categoryId,
    type: q.type,
    text: q.text,
    media: q.media,
    options: (q.options || []).map((o) => ({ id: o.id, text: o.text })),
    estimateType: q.estimateType || null,
    unit: q.unit || "",
  };
  if (revealCorrect || includeAnswers) {
    out.correctOptionId = q.correctOptionId;
    out.correctAnswer = q.correctAnswer;
    out.correctValue = q.correctValue;
  }
  return out;
}

// role: 'host' | 'player' | 'tv'
export async function assembleView(code, role, pid) {
  const state = await getGame(code);
  if (!state) return null;

  const [players, answersRaw, buzz, categories] = await Promise.all([
    getPlayers(code),
    getAnswers(code),
    getBuzz(code),
    getCategories(),
  ]);

  const isHost = role === "host";
  let question = null;
  if (state.currentQuestionId) {
    const full = await getQuestion(state.currentQuestionId);
    question = sanitizeQuestion(full, {
      revealCorrect: state.correctRevealed,
      includeAnswers: isHost,
    });
  }

  const ranked = players
    .filter((p) => !p.isTV)
    .sort((a, b) => b.score - a.score || a.joinedAt - b.joinedAt);

  const answeredIds = Object.keys(answersRaw);

  // Pelne odpowiedzi widzi tylko host; reszta po ujawnieniu poprawnej.
  const answers = isHost || state.correctRevealed ? answersRaw : {};

  const shownCategories = (state.shownCategoryIds || [])
    .map((id) => categories.find((c) => c.id === id))
    .filter(Boolean);

  // Dla nie-hosta tniemy ID poprawnych z konfiguracji rund/timera nie ma potrzeby ukrywac
  // Stan finalowy — chowamy poprawna/zmanipulowana wartosc do ujawnienia
  let finalView = null;
  if (state.final) {
    const f = state.final;
    finalView = {
      questionId: f.questionId,
      estimateType: f.estimateType,
      unit: f.unit,
      duelIds: f.duelIds || [],
      manipChance: f.manipChance,
      manipDrawn: !!f.manipDrawn, // czy juz wylosowano (kolo moze sie zakrecic)
      manipulated: f.manipDrawn ? !!f.manipulated : null, // wynik losowania jest jawny przed odpowiedziami
      submittedIds: f.submittedIds || [],
      revealed: !!f.revealed,
      phase: f.phase, // idle | collecting | done
    };
    if (isHost || f.revealed) {
      finalView.correctValue = f.correctValue; // prawdziwa, niezmanipulowana
      finalView.manipValue = f.manipValue; // wartosc do porownania
      finalView.estimates = f.estimates || {};
      finalView.winnerId = f.winnerId;
      finalView.exact = f.exact;
    }
  }

  return {
    role,
    pid: pid || null,
    state: {
      code: state.code,
      status: state.status,
      phase: state.phase,
      round: state.round,
      roundType: state.roundType || "classic",
      settings: state.settings,
      usedQuestionIds: state.usedQuestionIds || [],
      questionNumber: state.questionNumber || 0,
      answersRevealed: state.answersRevealed,
      correctRevealed: state.correctRevealed,
      answerMode: state.answerMode,
      eligibleIds: state.eligibleIds,
      buzzerOpen: state.buzzerOpen,
      buzzerWinnerId: state.buzzerWinnerId,
      selectedCategoryId: state.selectedCategoryId,
      timer: state.timer,
    },
    question,
    shownCategories,
    players: ranked,
    answeredIds,
    answers,
    buzz,
    territory: state.territory || null,
    final: finalView,
    categories,
  };
}
