import { deleteDemo, detail, updateDemo } from "../../../../lib/db";
import { checkOrigin, failure } from "../../../../lib/http";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, context: Context) {
  const result = detail((await context.params).id);
  return result ? Response.json(result) : Response.json({ error: "Demo not found." }, { status: 404 });
}
export async function PATCH(request: Request, context: Context) {
  try { checkOrigin(request); return Response.json(updateDemo((await context.params).id, await request.json())); } catch (e) { return failure(e); }
}
export async function DELETE(request: Request, context: Context) {
  try { checkOrigin(request); if (!deleteDemo((await context.params).id)) throw new Error("Demo not found."); return Response.json({ ok: true }); } catch (e) { return failure(e); }
}
