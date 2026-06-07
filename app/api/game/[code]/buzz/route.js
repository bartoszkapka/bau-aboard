import { getGame, getPlayer, getBuzz, pushBuzz } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(req, { params }) {
  const { code } = await params;
  const game = await getGame(code);
  if (!game) return Response.json({ error: "Nie ma gry" }, { status: 404 });

  const body = await req.json();
  const pid = body.pid;
  const player = pid ? await getPlayer(code, pid) : null;
  if (!player || player.isTV) return Response.json({ error: "Nieznany gracz" }, { status: 400 });

  if (game.answerMode !== "buzzer" || !game.buzzerOpen)
    return Response.json({ error: "Buzzer zamkniety" }, { status: 409 });

  // W pojedynku o terytorium buzzer dziala tylko dla atakujacego i zaatakowanego
  const duel = game.territory && game.territory.duel;
  if (duel && !duel.resolved) {
    if (pid !== duel.attackerId && pid !== duel.defenderId)
      return Response.json({ error: "Nie bierzesz udzialu w tym pojedynku" }, { status: 403 });
  }

  const current = await getBuzz(code);
  if (current.includes(pid)) return Response.json({ ok: true, position: current.indexOf(pid) + 1 });

  await pushBuzz(code, pid);
  const updated = await getBuzz(code);
  return Response.json({ ok: true, position: updated.indexOf(pid) + 1 });
}
