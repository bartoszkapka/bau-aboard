import { getQuestions, saveQuestion } from "@/lib/store";
import { checkHost, unauthorized } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req) {
  if (!checkHost(req)) return unauthorized();
  const questions = await getQuestions();
  return Response.json({ questions });
}

export async function POST(req) {
  if (!checkHost(req)) return unauthorized();
  const body = await req.json();
  if (!body.categoryId) return Response.json({ error: "Wybierz kategorie" }, { status: 400 });
  if (!body.text || !body.text.trim())
    return Response.json({ error: "Tresc pytania jest wymagana" }, { status: 400 });
  if (body.type === "closed") {
    const opts = (body.options || []).filter((o) => o.text && o.text.trim());
    if (opts.length < 2)
      return Response.json({ error: "Pytanie zamkniete potrzebuje min. 2 odpowiedzi" }, { status: 400 });
    if (!body.correctOptionId)
      return Response.json({ error: "Zaznacz poprawna odpowiedz" }, { status: 400 });
  }
  const q = await saveQuestion(body);
  return Response.json({ question: q });
}
