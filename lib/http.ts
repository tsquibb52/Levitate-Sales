export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin) {
    const source = new URL(origin);
    const target = new URL(request.url);
    if (source.host !== (request.headers.get("host") || target.host) || source.protocol !== target.protocol) throw new Error("Cross-origin changes are not allowed.");
  }
}
export function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  return Response.json({ error: message }, { status: message === "Demo not found." ? 404 : 400 });
}
