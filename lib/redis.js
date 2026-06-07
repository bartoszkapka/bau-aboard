import { Redis } from "@upstash/redis";

// Znajdz URL i TOKEN niezaleznie od prefiksu nazw zmiennych.
// Obsluguje: standardowe UPSTASH_REDIS_REST_*, KV_REST_API_*,
// oraz dowolny prefiks z integracji Vercel (np. STORAGE_REST_API_URL).
function resolveCreds() {
  const env = process.env;
  const isUrlKey = (key) => /(_REST_API_URL|_REST_URL|UPSTASH_REDIS_REST_URL)$/.test(key);
  const isTokenKey = (key) =>
    /(_REST_API_TOKEN|_REST_TOKEN|UPSTASH_REDIS_REST_TOKEN)$/.test(key) &&
    !/READ_ONLY/.test(key); // pomijamy token tylko-do-odczytu

  // priorytet dla nazw standardowych
  const url =
    env.UPSTASH_REDIS_REST_URL ||
    env.KV_REST_API_URL ||
    env[Object.keys(env).find(isUrlKey)] ||
    null;
  const token =
    env.UPSTASH_REDIS_REST_TOKEN ||
    env.KV_REST_API_TOKEN ||
    env[Object.keys(env).find(isTokenKey)] ||
    null;
  return { url, token };
}

const { url, token } = resolveCreds();

let _client = null;
function getClient() {
  if (_client) return _client;
  if (!url || !token) {
    throw new Error(
      "Brak konfiguracji Upstash Redis. Ustaw UPSTASH_REDIS_REST_URL i UPSTASH_REDIS_REST_TOKEN " +
        "lub zmienne z prefiksu integracji (np. STORAGE_REST_API_URL / STORAGE_REST_API_TOKEN) i zrob redeploy."
    );
  }
  _client = new Redis({ url, token });
  return _client;
}

// Leniwy klient: realny obiekt @upstash/redis tworzy sie przy pierwszym uzyciu,
// dzieki czemu brak zmiennych daje czytelny blad (a nie crash importu modulu).
export const redis = new Proxy(
  {},
  {
    get(_t, prop) {
      const c = getClient();
      const v = c[prop];
      return typeof v === "function" ? v.bind(c) : v;
    },
  }
);

const PREFIX = process.env.QUIZ_PREFIX || "quiz:";

// Buduje klucz z prefiksem: k("game","ABC123","players") -> "quiz:game:ABC123:players"
export const k = (...parts) => PREFIX + parts.filter(Boolean).join(":");

export const KEYS = {
  categories: () => k("categories"),
  questions: () => k("questions"),
  game: (code) => k("game", code),
  players: (code) => k("game", code, "players"),
  answers: (code) => k("game", code, "answers"),
  buzz: (code) => k("game", code, "buzz"),
  codeIndex: () => k("activecodes"),
};

// Czas zycia sesji gry: 12h
export const GAME_TTL = 60 * 60 * 12;
