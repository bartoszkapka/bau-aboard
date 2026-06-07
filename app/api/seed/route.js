import { redis, KEYS } from "@/lib/redis";
import { SEED_CATEGORIES, SEED_QUESTIONS } from "@/lib/seed";
import { checkHost, unauthorized } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req) {
  if (!checkHost(req)) return unauthorized();

  const catMap = {};
  for (const c of SEED_CATEGORIES) catMap[c.id] = c;
  await redis.hset(KEYS.categories(), catMap);

  const qMap = {};
  for (const q of SEED_QUESTIONS) qMap[q.id] = q;
  await redis.hset(KEYS.questions(), qMap);

  return Response.json({
    ok: true,
    categories: SEED_CATEGORIES.length,
    questions: SEED_QUESTIONS.length,
  });
}
