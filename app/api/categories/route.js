import { getCategories, saveCategory } from "@/lib/store";
import { checkHost, unauthorized } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const categories = await getCategories();
  return Response.json({ categories });
}

export async function POST(req) {
  if (!checkHost(req)) return unauthorized();
  const body = await req.json();
  if (!body.name || !body.name.trim()) {
    return Response.json({ error: "Nazwa kategorii jest wymagana" }, { status: 400 });
  }
  const cat = await saveCategory(body);
  return Response.json({ category: cat });
}
