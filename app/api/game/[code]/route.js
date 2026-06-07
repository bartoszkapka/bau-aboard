import { assembleView, getPlayer, setPlayer } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req, { params }) {
  const { code } = await params;
  const url = new URL(req.url);
  const role = url.searchParams.get("role") || "player";
  const pid = url.searchParams.get("pid") || null;

  const view = await assembleView(code, role, pid);
  if (!view) return Response.json({ error: "Nie znaleziono gry" }, { status: 404 });

  // odswiez "ostatnio widziany" gracza (heartbeat)
  if (pid) {
    const p = await getPlayer(code, pid);
    if (p) {
      p.lastSeen = Date.now();
      await setPlayer(code, p);
    }
  }

  return Response.json(view, {
    headers: { "cache-control": "no-store" },
  });
}
