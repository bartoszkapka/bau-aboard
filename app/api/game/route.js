import { createGame, getGame } from "@/lib/store";
import { makeGameCode } from "@/lib/ids";
import { checkHost, unauthorized } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req) {
  if (!checkHost(req)) return unauthorized();
  const body = await req.json().catch(() => ({}));

  // wygeneruj unikalny kod
  let code = makeGameCode();
  for (let i = 0; i < 5; i++) {
    const existing = await getGame(code);
    if (!existing) break;
    code = makeGameCode();
  }

  const state = await createGame({ code, settings: body.settings || {} });
  return Response.json({ code, state });
}
