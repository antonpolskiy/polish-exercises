# Aktualna architektura

## Struktura repozytorium

| Plik | Przeznaczenie |
|------|---------------|
| `index.html` | Strona główna z odnośnikami do trybów ćwiczeń |
| `odmiana.html` / `odmiana.js` | Statyczny układ, style i interfejs odmiany; JavaScript ładuje ćwiczenia z plików JSON |
| `cheatsheet.html` / `cheatsheet.js` | Strona ściągi, ładowanie pliku Markdown według identyfikatora oraz odnośnik z ćwiczenia |
| `cheatsheet-content.js` | Walidacja metadanych i parser obsługiwanego podzbioru Markdown |
| `cheatsheet-content.test.js` | Testy jednostkowe metadanych, struktury sekcji i bezpiecznego odnośnika do ćwiczeń |
| `content/exercise-index.json` | Lista plików z ćwiczeniami pogrupowanymi według tematów |
| `content/exercises/unsorted/` | 2938 ćwiczeń zapisanych w tablicach JSON według tematów |
| `content/cheatsheets/_template.md` | Szablon ściągi Markdown z metadanymi, sekcjami i odnośnikiem do ćwiczeń |
| `content/schema/exercise.schema.json` | Schemat JSON rekordu ćwiczenia i metadanych prezentacji w interfejsie |
| `core/check.ts` / `core/rounds.ts` | Niezależne od DOM sprawdzanie odpowiedzi, stan rundy i powtarzanie błędów |
| `core/progress.ts` / `core/storage.ts` | Zliczanie postępów i niezależny od DOM interfejs magazynu danych |
| `core/tests/` | Testy jednostkowe sprawdzania odpowiedzi, znaków diakrytycznych, rund i powtórek |
| `core/build/` | Wygenerowane moduły ES ładowane przez statyczny interfejs |
| `storage.ts` / `storage.js` | Adapter przeglądarkowy wersjonowanego magazynu postępów w `localStorage` |
| `tools/import-exercises.ts` | Jednorazowy importer starego formatu wbudowanego do tablic ćwiczeń |
| `tools/validate.ts` | Walidator JSON przez Ajv; sprawdza tablice i unikalność identyfikatorów |
| `check_morfeusz.py` | Sprawdza odpowiedzi z manifestu za pomocą biblioteki `morfeusz2` |
| `tools/reports/morfeusz-report.json` | Ostatni raport kontroli odpowiedzi i statusów |
| `tools/fixtures/` | Jeden prawidłowy i jeden celowo nieprawidłowy rekord do ręcznego testowania walidatora |
| `package.json` / `package-lock.json` | Polecenia `npm run validate`, `npm run typecheck` oraz importer |
| `README.md` | Krótka instrukcja sprawdzania form |
| `PLAN.md` | Plan rozwoju produktu |

To statyczna strona przeznaczona do publikacji w GitHub Pages; nie korzysta z serwera ani API. Do pracy lokalnej należy udostępnić pliki przez HTTP, ponieważ przeglądarka pobiera ćwiczenia za pomocą `fetch`.

## Przepływ strony i danych

```text
index.html
  └─ odnośnik do odmiana.html?level=easy|hard
       ├─ odmiana.js: pobieranie manifestu i tablic ćwiczeń
       ├─ odmiana.js: wybór poziomu CEFR lub unsorted oraz tematu
       ├─ odmiana.js: odnośnik „Ściąga” na podstawie cheatsheet_id
       ├─ core/rounds.ts: wykluczanie statusu rejected, filtrowanie trybu, poziomu i tematu; rundy i powtórki
       ├─ core/check.ts: normalizacja i klasyfikacja odpowiedzi
       ├─ core/progress.ts + storage.js: zliczanie i zapisywanie prób
       └─ odmiana.js: wyświetlanie elementów strony, wyników i statystyk

cheatsheet.html?id=<id>
  ├─ cheatsheet.js: pobieranie content/cheatsheets/<id>.md
  ├─ cheatsheet-content.js: sprawdzanie metadanych i struktury Markdown
  └─ DOM: typografia, tabele form z oznaczeniem rodzaju i odnośnik do ćwiczeń
```

Filtry na stronie ćwiczeń pokazują dostępne poziomy CEFR oraz osobny poziom `unsorted`; tematy zależą od wybranego poziomu. Wpisy `rejected` są pomijane, a wpisy `needs_review` są dostępne z widocznym ostrzeżeniem i licznikiem. Obecnie wszystkie 2938 wpisów mają `level: unsorted` i `status: needs_review`, dlatego strona od razu pokazuje ten zestaw i informuje o konieczności ręcznego sprawdzenia.

Ściągi tworzy się jako pliki Markdown w `content/cheatsheets/`. Plik `_template.md` określa wymagane metadane, sześć sekcji, dokładnie pięć przykładów, klasy oznaczające rodzaj gramatyczny oraz zwięzłą objętość dostosowaną do ekranu telefonu. `cheatsheet.js` wyświetla treść przy użyciu DOM API i ograniczonego podzbioru Markdown sprawdzanego przez `cheatsheet-content.js`; Markdown nie jest wstawiany jako dowolny kod HTML. Jeśli plik nie istnieje, strona pokazuje czytelny komunikat. Obecnie katalog zawiera wyłącznie szablon, a nie gotowe ściągi.

### Dane i generowanie ćwiczeń

Ćwiczenia są przechowywane w plikach pogrupowanych według tematów w `content/exercises/unsorted/`; manifest zawiera listę tych plików. Każde pytanie ma stały identyfikator, pełną odpowiedź i pola `presentation`, które opisują tryb, czasownik, czas, podmiot, temat lub przedrostek oraz przyrostek używane do wyświetlenia zadania. Poziom pozostaje `unsorted`, ponieważ nie określono poziomów CEFR dla tych starszych ćwiczeń.

Podczas migracji utworzono 2925 podstawowych ćwiczeń (`117 × (6 + 13 + 6)`) oraz 13 osobnych ćwiczeń kontekstowych dla dokonanego czasownika `zarezerwować`. Tryb łatwy pokazuje wszystkie podstawowe formy, w tym niedokonane `rezerwować`; tryb trudny używa 13 ćwiczeń kontekstowych z dokonanym czasownikiem zamiast odpowiadających im zadań w czasie przeszłym. W obu trybach runda zawiera zatem po 2925 zadań.

### Typy zadań i sprawdzanie odpowiedzi

- **Tryb łatwy:** pokazuje czasownik, czas i osobę; użytkownik uzupełnia zmienną część formy.
- **Tryb trudny:** pokazuje zdanie z luką; użytkownik wpisuje pełną formę, określając czas i osobę na podstawie zdania.
- **Aspekt w kontekście:** zakończona rezerwacja jest zapisana jako osobne rekordy `choose_aspect` i wykorzystywana w trybie trudnym.

`core/check.ts` usuwa skrajne odstępy, sprowadza wielokrotne spacje do jednej i normalizuje wielkość liter zgodnie z polskimi zasadami. Odpowiedź bez polskich znaków diakrytycznych otrzymuje osobny status `nearly-correct`; pozostałe błędne odpowiedzi mają status `incorrect`. Tryb łatwy sprawdza wyłącznie wpisaną zmienną część, uwzględniając `prefix` i `suffix`; tryb trudny sprawdza całą formę. Interfejs wywołuje tę funkcję i pokazuje odpowiedni komunikat.

### Runda i postępy

`core/rounds.ts` tworzy losową rundę dla wybranego trybu, poziomu CEFR i tematu. Pomija wyłącznie wpisy ze statusem `rejected`, dzięki czemu wpisy `needs_review` są dostępne z ostrzeżeniem w interfejsie. Moduł śledzi bieżącą pozycję i dodaje błędne oraz prawie poprawne odpowiedzi do kolejki powtórek. Po zakończeniu rundy najpierw powtarzane są błędy, a następnie rozpoczyna się pełna runda. Kolejka pozostaje w pamięci karty przeglądarki i jest czyszczona po jej ponownym załadowaniu.

`core/progress.ts` zlicza próby i poprawność według poziomu CEFR, tematu i trybu. Statystyki są zapisywane przez interfejs `ProgressStorage` w `core/storage.ts`; `storage.ts` wdraża go dla `localStorage` z wersjonowanym kluczem `polish-exercises.progress.v1` i jest kompilowany do `storage.js`. Zapis zawiera tylko zbiorcze liczniki, a nie wprowadzone odpowiedzi. Temat uznaje się za wymagający powtórki, jeśli poprawność wynosi mniej niż 60% po co najmniej trzech próbach. Błędy odczytu i zapisu są widoczne w interfejsie, a uszkodzone dane nie są po cichu usuwane.

### Sprawdzanie morfologii

`check_morfeusz.py` odczytuje manifest i sprawdza każdą odpowiedź oraz zaakceptowany wariant z JSON według lematu, czasu i wskazanego aspektu, korzystając z `morfeusz2`. Podejrzane ćwiczenia otrzymują status `needs_review` (status `rejected` nie jest zmieniany). Ostatni raport jest zapisywany w `tools/reports/morfeusz-report.json`; sprawdzanie uruchamia się ręcznie poleceniem `python check_morfeusz.py`. Testy jednostkowe sprawdzania i tworzenia raportu uruchamia się poleceniem `python -m unittest discover -s tools/tests -p 'test_*.py'`.

`npm run validate` uruchamia `tools/validate.ts`: domyślnie sprawdza wpisy w `content/exercises/`; akceptuje zarówno pojedynczy obiekt, jak i tablicę obiektów w pliku. Walidator stosuje `content/schema/exercise.schema.json`, sprawdza powtórzone identyfikatory między plikami i kończy działanie z niezerowym kodem w razie błędów. `npm test` uruchamia testy jednostkowe logiki i adaptera magazynu, `npm run typecheck` sprawdza logikę, testy, walidator i importer, a `npm run build:core` generuje moduły ES dla przeglądarki w `core/build/`.

## Problemy do rozwiązania podczas migracji

1. **Strona nie została jeszcze wydzielona do osobnej aplikacji `/web`.** Układ i style pozostają w `odmiana.html`, a wyświetlanie elementów DOM — w `odmiana.js`; dane i główna logika zostały już wydzielone.
2. **Treść nadal wymaga ręcznego sprawdzenia.** Wszystkie przeniesione ćwiczenia mają `status: needs_review`; analiza Morfeusza nie potwierdza naturalności ani jednoznaczności kontekstu.
3. **Reguły morfologiczne zawierają niejawne wyjątki.** Niestandardowe tematy i końcówki są zapisane w osobnych polach, a para aspektowa jest na razie zdefiniowana lokalnie tylko dla jednego czasownika. Eksport powinien być objęty testami Morfeusza, aby zachować poprawne formy i zgodność z lematem.
4. **Nie zapisuje się historii poszczególnych odpowiedzi.** Przechowywane są tylko zbiorcze liczby prób; do powtórek rozłożonych w czasie i przywracania kolejki między sesjami potrzebny będzie osobny dziennik zdarzeń.
5. **Kontrole nie są zautomatyzowane w CI.** Testy jednostkowe, walidator JSON, sprawdzanie typów i skrypt Morfeusza tworzący raport są uruchamiane ręcznie.
6. **Ćwiczenia nie mają jeszcze przypisanych poziomów CEFR i wymagają ręcznego sprawdzenia.** Wszystkie przeniesione zadania są dostępne w zestawie `unsorted` z ostrzeżeniem; po przypisaniu poziomów pojawią się w odpowiednich grupach A1–B2.
