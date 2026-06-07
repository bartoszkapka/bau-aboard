import { deleteQuestion } from "@/lib/store";
import { checkHost, unauthorized } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function DELETE(req, { params }) {
  if (!checkHost(req)) return unauthorized();
  const { id } = await params;
  await deleteQuestion(id);
  return Response.json({ ok: true });
}
