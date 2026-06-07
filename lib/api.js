// Cienka warstwa nad fetch. Sekret hosta przekazujemy naglowkiem.

async function req(method, url, { body, secret } = {}) {
  const headers = { "content-type": "application/json" };
  if (secret) headers["x-host-secret"] = secret;
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  let data = null;
  try { data = await res.json(); } catch { data = {}; }
  if (!res.ok) throw new Error(data.error || `Blad ${res.status}`);
  return data;
}

export const api = {
  get: (url) => req("GET", url),
  post: (url, body, secret) => req("POST", url, { body, secret }),
  del: (url, secret) => req("DELETE", url, { secret }),
};

// akcja hosta
export function hostAction(code, action, payload, secret) {
  return api.post(`/api/game/${code}/action`, { action, ...payload }, secret);
}
