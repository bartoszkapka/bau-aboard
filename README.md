# VHS QUIZ — webowa aplikacja do quizów (Kahoot/Jackbox style)

Ciemna, retro, VHS-owa aplikacja quizowa: host, wielu uczestników na telefonach oraz publiczny ekran **TR YB TV**. Next.js (App Router) + Upstash Redis. Real-time przez polling (1 s), więc działa stabilnie na Vercel.

## Funkcje

- **Host**: tworzy kategorie i pytania (zapis na stałe w Redis), prowadzi rozgrywkę.
- **Pytania**: otwarte lub zamknięte (do 4 odpowiedzi, jedna poprawna), opcjonalne media (obraz / wideo / audio).
- **Uczestnicy**: dołączają 6-znakowym kodem, wybierają nick + emoji.
- **Tryb TV**: ten sam kod, wyświetla pytania, kod dołączenia i ranking na żywo.
- **Tryby odpowiadania**: wszyscy / wybrani uczestnicy / **buzzer** (pierwszy naciśnięty czerwony przycisk zyskuje prawo odpowiedzi — kolejność liczona po stronie serwera).
- **Host steruje**: kiedy pokazać odpowiedzi, limit czasu, punkty za pytanie, premię za szybkość (liczy się tylko kolejność, nie czas), kiedy ujawnić poprawną odpowiedź.
- Po czasie host może zaznaczyć odpowiedź **w imieniu** uczestnika lub uznać brak odpowiedzi; pytania otwarte ocenia ręcznie (OK / ŹLE).
- Przed pytaniem losowane są kafelki kategorii (host ustala ile), host wybiera kategorię.
- Host może **w dowolnym momencie edytować punkty** dowolnego uczestnika (+/-, ustaw wartość).
- Na start zaseedowane **12 pytań** w 6 kategoriach.

## Wymagania

- Node.js 18+ (lokalnie)
- Konto [Upstash](https://upstash.com) (darmowy Redis REST)
- Konto GitHub + [Vercel](https://vercel.com)

## Zmienne środowiskowe

Skopiuj `.env.example` do `.env.local` i uzupełnij:

```
UPSTASH_REDIS_REST_URL=...      # z panelu Upstash (REST API)
UPSTASH_REDIS_REST_TOKEN=...    # z panelu Upstash (REST API)
QUIZ_PREFIX=quiz:               # prefiks kluczy (baza jest współdzielona!)
HOST_SECRET=tajne-haslo         # opcjonalnie; puste = panel hosta otwarty
```

> **Współdzielona baza**: wszystkie klucze są poprzedzane `QUIZ_PREFIX`. Ustaw unikalny prefiks, by nie kolidować z innymi aplikacjami w tej samej bazie.

## Uruchomienie lokalne

```bash
npm install
npm run dev
```

Otwórz http://localhost:3000

## Deploy: GitHub + Vercel

1. Utwórz repo na GitHub i wypchnij kod:
   ```bash
   git init
   git add .
   git commit -m "VHS quiz"
   git branch -M main
   git remote add origin https://github.com/<user>/<repo>.git
   git push -u origin main
   ```
2. W Vercel: **New Project** → zaimportuj repo.
3. W **Settings → Environment Variables** dodaj `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `QUIZ_PREFIX`, (opcjonalnie) `HOST_SECRET`.
4. **Deploy**.

## Seed pytań

Pytania startowe zapisują się **po stronie hosta**. Wejdź na `/host`, (wpisz sekret jeśli ustawiony), zakładka **BAZA PYTAN** → przycisk **ZASEEDUJ**. Operacja jest idempotentna (nie duplikuje istniejących kategorii/pytań). Alternatywnie wywołaj `POST /api/seed` z nagłówkiem `x-host-secret`.

## Jak grać

1. **Host** → `/host`: utwórz grę (dostajesz 6-znakowy KOD). Ustaw limit czasu, punkty, premię za szybkość, liczbę kategorii.
2. **Ekran TV** → przycisk „EKRAN TV" (lub `/join` → tryb TV) na osobnym ekranie/rzutniku. Pokazuje kod i ranking.
3. **Uczestnicy** → strona główna lub `/join`: wpisują kod, nick i emoji.
4. Host: **ROZPOCZNIJ GRĘ** → pokaż/losuj kategorie → wybierz kategorię → wybierz pytanie → ustaw tryb (wszyscy/wybierz/buzzer) → **POKAŻ MOŻLIWE ODPOWIEDZI** → (timer) → **UJAWNIJ POPRAWNĄ** → **NASTĘPNA RUNDA**.

## Uwagi bezpieczeństwa

- Akcje zapisu (tworzenie pytań/gry, sterowanie rozgrywką) wymagają `HOST_SECRET`, jeśli jest ustawiony. Bez niego panel jest otwarty (wygodne do testów, **nie** na produkcję publiczną).
- Widok `GET /api/game/{code}?role=host` zawiera poprawne odpowiedzi i **nie** jest chroniony sekretem (kompromis na rzecz prostoty w grze towarzyskiej). Nie udostępniaj linku hosta z `role=host` uczestnikom. Widok uczestnika/TV ma usunięte poprawne odpowiedzi do momentu ich ujawnienia.

## Struktura

- `app/` — strony (`/`, `/host`, `/join`, `/play/[code]`, `/tv/[code]`) i API (`app/api/...`)
- `lib/` — Redis, store (dostęp do danych), auth, hooki polling, seed, helpery
- `app/globals.css` — efekty VHS (scanlines, chromatic aberration, flicker)

Sesja gry wygasa po 12 h (TTL w Redis). Kategorie i pytania są trwałe.
