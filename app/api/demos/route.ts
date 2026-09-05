import { createDemo, listDemos, transaction } from "../../../lib/db";
import { checkOrigin, failure } from "../../../lib/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET() { return Response.json(listDemos()); }
export async function POST(request: Request) {
  try { checkOrigin(request); const input = await request.json(); return Response.json(transaction(() => createDemo(input)), { status: 201 }); } catch (e) { return failure(e); }
}
