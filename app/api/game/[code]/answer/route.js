import { getGame, getPlayer, getAnswers, setAnswer } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(req, { params }) {
  const { code } = await params;
  const game = await getGame(code);
  if (!game) return Response.json({ error: "Nie ma gry" }, { status: 404 });

  const body = await req.json();
  const pid = body.pid;
  const player = pid ? await getPlayer(code, pid) : null;
  if (!player || player.isTV) return Response.json({ error: "Nieznany gracz" }, { status: 400 });

  const isFinal = game.phase === "final";
  const okPhase = game.phase === "question" || game.phase === "territory" || isFinal;
  if (!okPhase)
    return Response.json({ error: "Teraz nie mozna odpowiadac" }, { status: 409 });
  if (game.correctRevealed || (isFinal && game.final?.revealed))
    return Response.json({ error: "Odpowiedz juz ujawniona" }, { status: 409 });
  // W rundzie finalowej gracze odpowiadaja od razu; w pozostalych po odkryciu wariantow
  if (!isFinal && !game.answersRevealed)
    return Response.json({ error: "Warianty jeszcze nieodkryte" }, { status: 409 });

  const eligible =
    (game.answerMode === "all") || (game.eligibleIds || []).includes(pid);
  if (!eligible) return Response.json({ error: "Nie masz prawa odpowiadac" }, { status: 403 });

  // limit czasu — odpowiedzi po czasie sa DOZWOLONE, ale oznaczane jako spoznione
  let late = false;
  const t = game.timer;
  if (t && t.running && t.startedAt && t.durationSec > 0) {
    const elapsed = (Date.now() - t.startedAt) / 1000;
    if (elapsed > t.durationSec) late = true;
  }

  const existing = await getAnswers(code);
  if (existing[pid]) return Response.json({ ok: true, already: true });

  const order = Object.keys(existing).length + 1;
  const answer = {
    pid,
    optionId: body.optionId || null,
    text: body.text != null ? String(body.text).slice(0, 200) : "",
    value: body.value != null && body.value !== "" ? Number(body.value) : null, // szacowanie
    order,
    at: Date.now(),
    byHost: false,
    judged: null,
    late, // odpowiedz po czasie — host decyduje czy zaliczyc
    lateAccepted: false,
  };
  await setAnswer(code, pid, answer);
  return Response.json({ ok: true, order, late });
}
