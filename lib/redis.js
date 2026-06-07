import { Redis } from "@upstash/redis";

// Jeden wspoldzielony klient. Upstash dziala po REST -> idealne dla serverless/Vercel.
export const redis = Redis.fromEnv();

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
