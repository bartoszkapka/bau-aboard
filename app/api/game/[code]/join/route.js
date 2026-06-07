import { getGame, getPlayer, setPlayer } from "@/lib/store";
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

  // Powrot do gry: jesli przekazano pid istniejacego gracza, uzyj go ponownie
  // (zachowuje punkty po zamknieciu i ponownym otwarciu karty na tym samym urzadzeniu).
  if (!isTV && body.pid) {
    const existing = await getPlayer(code, body.pid);
    if (existing && !existing.isTV) {
      existing.name = body.name.trim().slice(0, 24);
      existing.emoji = body.emoji || existing.emoji || "🎮";
      existing.lastSeen = Date.now();
      await setPlayer(code, existing);
      return Response.json({ player: existing, resumed: true });
    }
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
