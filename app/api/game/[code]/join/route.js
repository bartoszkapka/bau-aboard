import { getGame, setPlayer } from "@/lib/store";
import { makeId } from "@/lib/ids";

export const dynamic = "force-dynamic";

export async function POST(req, { params }) {
  const { code } = await params;
  const game = await getGame(code);
  if (!game) return Response.json({ error: "Nie ma gry o takim kodzie" }, { status: 404 });

  const body = await req.json();
  const isTV = !!body.isTV;

  if (!isTV && (!body.name || !body.name.trim())) {
    return Response.json({ error: "Podaj swoja nazwe" }, { status: 400 });
  }

  const player = {
    id: makeId(isTV ? "tv" : "p"),
    name: isTV ? "TV" : body.name.trim().slice(0, 24),
    emoji: isTV ? "📺" : body.emoji || "🎮",
    score: 0,
    isTV,
    joinedAt: Date.now(),
    lastSeen: Date.now(),
  };

  await setPlayer(code, player);
  return Response.json({ player });
}
