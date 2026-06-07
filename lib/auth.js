export function checkHost(req) {
  const secret = process.env.HOST_SECRET || "";
  if (!secret) return true; // jesli nie ustawiono sekretu, panel jest otwarty (dev)
  const header = req.headers.get("x-host-secret") || "";
  const url = new URL(req.url);
  const q = url.searchParams.get("secret") || "";
  return header === secret || q === secret;
}

export function unauthorized() {
  return new Response(JSON.stringify({ error: "Brak autoryzacji hosta" }), {
    status: 401,
    headers: { "content-type": "application/json" },
  });
}
