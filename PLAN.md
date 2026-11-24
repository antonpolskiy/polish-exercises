# Plan: gramatyka polska A1–B2

Aplikacja do nauki języka polskiego i przygotowania do egzaminu B1–B2. Obecnie: statyczna strona w GitHub Pages (`antonpolskiy.github.io`). Docelowo: aplikacja mobilna. Aktualny priorytet: **gramatyka**.

## Zasady pracy z tym plikiem

1. Na początku sesji przeczytaj ten plik oraz `ARCHITECTURE.md` (po ukończeniu S0.1).
2. Wybierz **jedno** pierwsze niezakończone zadanie `[ ]` z bieżącej fazy. Nie wybieraj kilku.
3. Wykonaj je do spełnienia warunku **Gotowe, gdy**. Uruchom walidację treści i testy.
4. Zaznacz `[x]` i dopisz na końcu pliku wiersz do „Dziennika sesji” (data, zadanie, zmiany i pozostałe kwestie).
5. Nie łącz zmian treści, logiki i interfejsu w jednym zatwierdzeniu.

## Zasady projektowe

- **Dane oddzielone od kodu, kod oddzielony od interfejsu.** Migracja do aplikacji mobilnej nie powinna wymagać ponownego zapisywania danych.
- **Automatycznie generowane formy polskie mogą zawierać błędy.** Każda odpowiedź w ćwiczeniach jest automatycznie sprawdzana przez Morfeusza 2; podejrzane formy otrzymują status `needs_review`.
- **Jedno ćwiczenie to jeden rekord JSON.** Nie umieszczaj ćwiczeń bezpośrednio w HTML ani JavaScript.
- **Interfejs powinien być prosty:** wywołuje `core` i wyświetla wynik.
- Interfejs i objaśnienia są po polsku. Ćwiczenia są po polsku.

## Docelowa struktura repozytorium

```text
/content
  /exercises/{level}/{topic}.json     # ćwiczenia
  /cheatsheets/{id}.md                # ściągi (metadane i Markdown)
  /vocab/...                          # słowniki (później)
  schema/exercise.schema.json
/core                                 # TypeScript bez DOM i localStorage
  check.ts  rounds.ts  progress.ts  srs.ts  storage.ts (interfejs)
  tests/
/web                                  # obecny interfejs GitHub Pages
/mobile                               # później (Capacitor)
/tools                                # walidator, importer, kontrola Morfeuszem, tworzenie PDF
ARCHITECTURE.md
PLAN.md
```

## Schemat ćwiczenia

```json
{
  "id": "verb-past-ratowac-ty-m-001",
  "level": "B1",
  "topic": "verb.past",
  "type": "fill_full_form",
  "prompt": "Ty (mężczyzna) wczoraj ____ (ratować).",
  "answers": ["ratowałeś"],
  "accept_variants": [],
  "hint": "Czas przeszły, 2. os. lp., rodzaj męski",
  "explanation": "ratować → ratowa-ł-eś",
  "cheatsheet_id": "verb-past",
  "difficulty": 2,
  "status": "ok"
}
```

Początkowy zestaw wartości `type`: `fill_full_form`, `choose_option`, `fix_error`, `transform_sentence`, `choose_aspect`.
Możliwe wartości `status`: `ok` | `needs_review` | `rejected`.

---

## Faza 0. Podstawy (bez dodawania nowej treści)

- [x] **S0.1 Audyt.** Opisać obecną strukturę `/web`, sposób przechowywania i generowania około 2900 ćwiczeń, dostępne typy, logikę sprawdzania i zapisywanie postępów.
  **Gotowe, gdy:** istnieje `ARCHITECTURE.md` ze schematem przepływu danych i listą problemów do rozwiązania podczas migracji.
- [x] **S0.2 Schemat i walidator.** Utworzyć `exercise.schema.json` i `tools/validate.ts`: unikalne identyfikatory, wymagane pola, dozwolone wartości `level`/`topic`/`type` oraz niepuste `answers`.
  **Gotowe, gdy:** `npm run validate` wykrywa celowo uszkodzony rekord i akceptuje poprawne rekordy.
- [x] **S0.3 Migracja ćwiczeń do `/content`.** Za pomocą skryptu przenieść stary format do tablic JSON pogrupowanych według tematów. Oznaczyć `level` i `topic`; jeśli poziom jest nieznany, użyć `level: "unsorted"`.
  **Gotowe, gdy:** wszystkie dotychczasowe ćwiczenia znajdują się w `/content`, interfejs działa jak wcześniej, a walidacja przechodzi.
- [x] **S0.4 Wydzielenie logiki do `/core`.** Sprawdzanie odpowiedzi (wielkość liter, zbędne spacje; brak znaków diakrytycznych jako osobna kategoria „prawie poprawnie”), rundy i powtarzanie błędów. Dodać testy jednostkowe.
  **Gotowe, gdy:** `/web` korzysta z `core`, kod interfejsu nie zawiera logiki sprawdzania, a testy przechodzą.
- [x] **S0.5 Magazyn danych i postępy.** Zdefiniować interfejs `Storage` i implementację dla `localStorage` w warstwie przeglądarkowej. Zliczać próby, poprawność i trudne tematy według tematu i poziomu.
  **Gotowe, gdy:** postępy są zachowane po ponownym załadowaniu strony, a `core` nie korzysta bezpośrednio z `localStorage`.
- [x] **S0.6 Sprawdzanie Morfeuszem.** Skrypt sprawdza, czy każda odpowiedź z `answers` jest poprawną formą lematu z polecenia. Podejrzane formy otrzymują status `needs_review`.
  **Gotowe, gdy:** w `tools/reports/` znajduje się raport z listą podejrzanych ćwiczeń.
- [x] **S0.7 Nawigacja według poziomów i tematów.** Dodać wybór poziomu (A1–B2 lub `unsorted`) i tematu; wykluczyć wpisy `rejected`, a wpisy `needs_review` udostępniać z ostrzeżeniem.
  **Gotowe, gdy:** można ćwiczyć osobno według tematu i poziomu.

---

## Faza 1. Szablon ściąg (1–2 sesje)

- [x] **S1.1 Szablon ściągi.** Markdown i metadane (`id`, `level`, `topic`, `related_exercises`). Wymagane sekcje:
  1. Zasada (1–2 zdania)
  2. Tabela form (kolory oznaczają rodzaj: męski, żeński, nijaki)
  3. Wyjątki
  4. Pułapki językowe
  5. Pięć przykładów
  6. Odnośnik do ćwiczeń z danego tematu
  Ograniczenie: **każda ściąga powinna mieścić się na jednym ekranie telefonu**.
- [x] **S1.2 Wyświetlanie w interfejsie.** Dodać stronę ściągi i przycisk „Ściąga” w ćwiczeniu (`cheatsheet_id`), a także czytelną typografię i tabele z oznaczeniem rodzaju.
- [ ] **S1.3 Tworzenie plików PDF.** `tools/build-pdf` tworzy wersję A4 z tych samych plików `.md`. Jeden plik zawiera wszystkie ściągi z danego poziomu.
  **Gotowe, gdy:** jeden plik `.md` jest źródłem zarówno wersji ekranowej, jak i PDF, bez ręcznych poprawek.

---

## Faza 2. Gramatyka A1–A2

Dla każdego tematu: ściąga, 40–80 ćwiczeń (co najmniej trzy typy), walidacja i sprawdzenie Morfeuszem. Jedna lub dwie sesje na temat.

- [ ] **A1.1** Czasowniki być i mieć; czas teraźniejszy (koniugacje 1/2/3)
- [ ] **A1.2** Rodzaj i liczba rzeczowników, przymiotniki
- [ ] **A1.3** Mianownik i biernik (podstawy), przeczenia, pytania
- [ ] **A2.1** Czas przeszły (rodzaj i osoba)
- [ ] **A2.2** Czas przyszły (będę + bezokolicznik / forma dokonana)
- [ ] **A2.3** Miejscownik i dopełniacz (liczba pojedyncza)
- [ ] **A2.4** Narzędnik i celownik (liczba pojedyncza)
- [ ] **A2.5** Czasowniki modalne (musieć, móc, chcieć, umieć), tryb rozkazujący
- [ ] **A2.6** Stopniowanie, zaimki dzierżawcze i wskazujące

## Faza 3. Gramatyka B1 (największy zakres)

- [ ] **B1.1–B1.7** Siedem przypadków w liczbie pojedynczej: jedna sesja na przypadek i jedna na powtórzenie mieszane
- [ ] **B1.8–B1.14** Siedem przypadków w liczbie mnogiej: taki sam układ
- [ ] **B1.15** Rodzaj męskoosobowy i niemęskoosobowy w liczbie mnogiej
- [ ] **B1.16** Biernik dla osób i zwierząt
- [ ] **B1.17** Aspekt czasownika: pary, tworzenie form (przedrostki i przyrostki)
- [ ] **B1.18** Aspekt w kontekście (`choose_aspect`)
- [ ] **B1.19** Tryb przypuszczający (bym, byś, by…)
- [ ] **B1.20** Który, co, kto; zdania względne
- [ ] **B1.21** Liczebniki i przypadki
- [ ] **B1.22** Czasowniki ruchu (iść/chodzić, jechać/jeździć, przedrostki)
- [ ] **B1.23** Czasowniki zwrotne (się, sobie)
- [ ] **B1.24** Sprawdzian B1: zadania mieszane, limit czasu, ocena

## Faza 4. Gramatyka B2

- [ ] **B2.1** Imiesłowy przymiotnikowe (czynne, bierne)
- [ ] **B2.2** Imiesłowy przysłówkowe (współczesne, uprzednie)
- [ ] **B2.3** Strona bierna (zostać / być + imiesłów) i formy bezosobowe (-no/-to)
- [ ] **B2.4** Mowa zależna
- [ ] **B2.5** Zdania warunkowe: gdyby, jeśli, o ile; różne typy
- [ ] **B2.6** Liczebniki zbiorowe (dwoje, troje), ułamkowe i porządkowe
- [ ] **B2.7** Rekcja: zestawienia „czasownik + przypadek + przyimek” (osobny plik danych)
- [ ] **B2.8** Czasowniki przedrostkowe i odcienie znaczeniowe
- [ ] **B2.9** Słowotwórstwo (przyrostki, przedrostki, złożenia)
- [ ] **B2.10** Spójniki i wyrażenia łączące, żeby / aby / by
- [ ] **B2.11** Sprawdzian B2: zadania mieszane, limit czasu, ocena

---

## Faza 5. Tryby nauki (logika w `core`, osobny interfejs)

- [ ] **S5.1** Test diagnostyczny poziomu (adaptacyjny: początek na A2, później poziom rośnie lub spada zależnie od wyniku)
- [ ] **S5.2** Powtórki błędów w systemie SRS (odstępy 1/3/7/21 dni), „dzisiejsza kolejka”
- [ ] **S5.3** Nowe typy ćwiczeń: `choose_option`, `fix_error`, `transform_sentence`
- [ ] **S5.4** Sprawdziany poziomów: limit czasu, ocena, omówienie błędów z odnośnikiem do ściągi
- [ ] **S5.5** Statystyki: mapa tematów, serie dni nauki

## Faza 6. Aplikacja mobilna

- [ ] **S6.1** PWA: manifest, service worker, pamięć podręczna offline dla `/content`
- [ ] **S6.2** Dostosowanie interfejsu do telefonu (bezpieczne marginesy, duże pola dotykowe, klawiatura z polskimi znakami)
- [ ] **S6.3** Opakowanie w Capacitor, ikony, ekran powitalny
- [ ] **S6.4** Magazyn danych dla aplikacji mobilnej (SQLite / Preferences), migracja postępów
- [ ] **S6.5** Lokalne przypomnienia i publikacja (TestFlight / wewnętrzne testy Google Play)

## Faza 7 (później). Pozostałe części egzaminu

Słownictwo według tematów egzaminacyjnych, rozumienie ze słuchu (TTS), czytanie, pisanie ze sprawdzaniem przez sztuczną inteligencję, mówienie.

---

## Stała kontrola jakości treści

- Każda zmiana wprowadzająca treść: `npm run validate` oraz raport Morfeusza bez nowych wpisów `needs_review`.
- Ćwiczenie nie może mieć dwóch poprawnych odpowiedzi, chyba że druga znajduje się w `accept_variants`.
- Nie wymyślaj reguł: w spornych przypadkach ustaw `status: needs_review` i dodaj pytanie do dziennika.
- Raz na fazę sprawdź próbkę około 50 ćwiczeń z pomocą rodzimego użytkownika języka lub nauczyciela.
- Walidator odrzuca powtórzone polecenia `prompt`.

## Dziennik sesji

| Data | Zadanie | Wykonane prace | Pozostałe zadanie / pytanie |
|------|---------|----------------|-----------------------------|
| 2026-11-24 | S0.1 Audyt | Utworzono `ARCHITECTURE.md`: opisano strukturę strony statycznej, generowanie 2925 zadań, typy ćwiczeń, sprawdzanie odpowiedzi, stan rundy i problemy związane z migracją. | S0.2: schemat ćwiczeń i walidator. |
| 2026-11-24 | S0.2 Schemat i walidator | Dodano schemat, walidator Ajv, interfejs wiersza poleceń dla plików i katalogów JSON, sprawdzanie unikalności identyfikatorów oraz poprawne i niepoprawne pliki testowe. Zaktualizowano opis architektury. | S0.3: migracja ćwiczeń do `/content`. |
| 2026-11-24 | S0.3 Migracja ćwiczeń | Przeniesiono 2938 ćwiczeń dla 117 czasowników do czterech tablic tematycznych; interfejs ładuje je z manifestu w trybach łatwym i trudnym. Sprawdzono morfologię Morfeuszem oraz oba tryby i parę `rezerwować / zarezerwować` w przeglądarce. | S0.4: wydzielenie sprawdzania i logiki rund do `/core`. |
| 2026-11-24 | S0.4 Logika `core` | Dodano niezależne od DOM moduły `core/check.ts` i `core/rounds.ts`, osobny status odpowiedzi bez znaków diakrytycznych, kolejkę powtórek błędów, kompilację przeglądarkową i 10 testów jednostkowych. Interfejs korzysta z `core` zamiast własnego sprawdzania i tasowania. | S0.5: magazyn danych i zapisywanie postępów. |
| 2026-11-24 | S0.5 Magazyn danych i postępy | Dodano interfejs magazynu danych, adapter `localStorage` i zbiorcze statystyki według trybu, poziomu i tematu; interfejs pokazuje próby, poprawność i tematy wymagające powtórki (po 3 próbach, poniżej 60%). Sprawdzono zachowanie danych po ponownym załadowaniu; przechodzi 16 testów jednostkowych. | S0.6: raport Morfeusza dla podejrzanych ćwiczeń. |
| 2026-11-24 | S0.6 Sprawdzanie Morfeuszem | Skrypt sprawdza odpowiedzi i zaakceptowane warianty, oznacza podejrzane ćwiczenia statusem `needs_review` i tworzy raport JSON. Sprawdzono 2938 form; nie znaleziono podejrzanych. Dodano trzy testy jednostkowe błędów, aspektu i buforowania analiz. | S0.7: nawigacja według poziomów i tematów. |
| 2026-11-24 | S0.7 Nawigacja poziomów i tematów | Dodano filtry CEFR A1–B2 i tematy na stronie ćwiczeń; początkowo `core` uwzględniał tylko wpisy `ok`, a pusty wybór pokazywał komunikat. Ponieważ wszystkie 2938 wpisów miały `unsorted`/`needs_review`, nie były dostępne żadne ćwiczenia. | Faza 0 zakończona; następne zadanie: S1.1, szablon ściągi. |
| 2026-11-24 | S1.1 Szablon ściągi | Dodano `content/cheatsheets/_template.md` z metadanymi, sześcioma sekcjami, znacznikami CSS rodzaju, pięcioma przykładami, odnośnikiem do ćwiczeń i ograniczeniem objętości; zaktualizowano instrukcje w README i opisie architektury. | S1.2: wyświetlanie ściągi i przycisk z ćwiczenia. |
| 2026-11-24 | S1.2 Wyświetlanie ściąg | Dodano stronę `cheatsheet.html`, przycisk z ćwiczenia na podstawie `cheatsheet_id`, bezpieczny mechanizm wyświetlania ograniczonego podzbioru Markdown i style tabel rozróżniające rodzaj. Sprawdzono 20 testów; dla brakujących ściąg pojawia się czytelny komunikat. | S1.3: tworzenie PDF z tych samych plików Markdown. |
| 2026-11-24 | S0.7: dostępność ćwiczeń | Zmieniono filtr na prośbę użytkownika: wpisy `needs_review` i `unsorted` są teraz dostępne z widocznym ostrzeżeniem, a `rejected` pozostaje wykluczone; jeśli nie ma poziomów CEFR, wybierany jest `unsorted`. | Następne zadanie: S1.3, tworzenie PDF ze ściąg. |
