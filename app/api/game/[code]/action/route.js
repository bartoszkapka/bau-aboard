import {
  getGame,
  saveGame,
  getQuestion,
  getQuestions,
  getCategories,
  getPlayers,
  setPlayer,
  getPlayer,
  removePlayer,
  getAnswers,
  setAnswer,
  clearAnswers,
  clearBuzz,
  getBuzz,
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

async function pickCategories(game, count) {
  const [cats, questions] = await Promise.all([getCategories(), getQuestions()]);
  const used = new Set(game.usedQuestionIds || []);
  const available = cats.filter((c) =>
    questions.some((q) => q.categoryId === c.id && !used.has(q.id))
  );
  const n = Math.max(1, Math.min(count || game.settings.categoriesToShow || 4, available.length));
  return shuffle(available).slice(0, n).map((c) => c.id);
}

async function applyScoring(game) {
  if (game.scored) return;
  const q = await getQuestion(game.currentQuestionId);
  if (!q) return;
  const [answers, players] = await Promise.all([getAnswers(game.code), getPlayers(game.code)]);

  // ktorzy gracze byli uprawnieni
  const eligibleSet =
    game.answerMode === "all"
      ? new Set(players.filter((p) => !p.isTV).map((p) => p.id))
      : new Set(game.eligibleIds || []);

  // zbierz poprawne odpowiedzi z kolejnoscia
  const correctEntries = [];
  for (const pid of Object.keys(answers)) {
    if (!eligibleSet.has(pid)) continue;
    const a = answers[pid];
    let correct = false;
    if (q.type === "closed") correct = a.optionId && a.optionId === q.correctOptionId;
    else correct = a.judged === true;
    if (correct) correctEntries.push({ pid, order: a.order || 999 });
  }
  correctEntries.sort((x, y) => x.order - y.order);

  const base = game.settings.pointsPerQuestion || 0;
  const bonuses = Array.isArray(game.settings.bonuses)
    ? game.settings.bonuses
    : [game.settings.bonusPoints || 0]; // zgodnosc ze starym formatem
  const playerMap = {};
  for (const p of players) playerMap[p.id] = p;

  correctEntries.forEach((e, idx) => {
    const p = playerMap[e.pid];
    if (!p) return;
    let gain = base;
    // premia tylko za KOLEJNOSC (1./2./3. najszybsza poprawna), nie za czas
    if (game.settings.speedBonus && bonuses[idx]) gain += Number(bonuses[idx]) || 0;
    p.score = (p.score || 0) + gain;
  });

  await Promise.all(correctEntries.map((e) => playerMap[e.pid] && setPlayer(game.code, playerMap[e.pid])));
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
      Object.assign(game, freshQuestionState());
      game.shownCategoryIds = await pickCategories(game, body.count);
      await clearAnswers(code);
      await clearBuzz(code);
      break;
    }

    case "showCategories": {
      game.phase = "category";
      Object.assign(game, freshQuestionState());
      game.shownCategoryIds = await pickCategories(game, body.count);
      await clearAnswers(code);
      await clearBuzz(code);
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
      game.currentQuestionId = q.id;
      game.selectedCategoryId = q.categoryId;
      game.answerMode = body.answerMode || "all";
      game.usedQuestionIds = Array.from(new Set([...(game.usedQuestionIds || []), q.id]));
      await clearAnswers(code);
      await clearBuzz(code);
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
      game.eligibleIds = [];
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
      game.eligibleIds = [];
      await clearBuzz(code);
      break;
    }

    case "revealAnswers": {
      game.answersRevealed = true;
      if (game.settings.timeLimitSec > 0) {
        game.timer = { startedAt: Date.now(), durationSec: game.settings.timeLimitSec, running: true };
      }
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
      // host zaznacza odpowiedz w imieniu uczestnika (po czasie)
      const pid = body.pid;
      const existing = await getAnswers(code);
      const order = existing[pid]?.order || Object.keys(existing).length + 1;
      const answer = {
        pid,
        optionId: body.optionId || null,
        text: body.text != null ? String(body.text) : existing[pid]?.text || "",
        order,
        at: Date.now(),
        byHost: true,
        judged: body.correct != null ? !!body.correct : existing[pid]?.judged ?? null,
      };
      await setAnswer(code, pid, answer);
      break;
    }

    case "judgeAnswer": {
      // ocena pytania otwartego: poprawne / niepoprawne
      const pid = body.pid;
      const existing = await getAnswers(code);
      if (existing[pid]) {
        existing[pid].judged = !!body.correct;
        await setAnswer(code, pid, existing[pid]);
      }
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
      game.round = (game.round || 0) + 1;
      game.phase = "category";
      Object.assign(game, freshQuestionState());
      game.shownCategoryIds = await pickCategories(game, body.count);
      await clearAnswers(code);
      await clearBuzz(code);
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
