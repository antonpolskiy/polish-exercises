# Ćwiczenia z języka polskiego

## Uruchamianie strony

Strona ćwiczeń pobiera pliki JSON pogrupowane według tematów za pomocą `fetch`, dlatego należy udostępnić repozytorium przez HTTP zamiast otwierać bezpośrednio plik `odmiana.html`. Plik `.nojekyll` zapobiega przetwarzaniu źródłowych plików Markdown, które pobiera strona ściągi. Odnośniki wewnętrzne są względne, więc działają również wtedy, gdy GitHub Pages publikuje projekt pod ścieżką repozytorium:

```powershell
python -m http.server 8000
```

Następnie otwórz `http://localhost:8000/odmiana.html`. Parametr `?level=easy` włącza wpisywanie przedrostka lub końcówki, a `?level=hard` — wpisywanie całej formy w zdaniu.

Filtr ćwiczeń zawiera opcję `unsorted` dla starszych materiałów. Ćwiczenia oznaczone jako `needs_review` są wyświetlane z ostrzeżeniem; ćwiczenia `rejected` nigdy nie są pokazywane.

## Walidacja ćwiczeń

Uruchom `npm install` jeden raz, a następnie `npm run validate`. Polecenie sprawdza wszystkie rekordy w tablicach tematycznych w `content/exercises/`, w tym powtórzone identyfikatory w różnych plikach. Lista plików znajduje się w `content/exercise-index.json`.

Uruchom `npm run typecheck`, aby sprawdzić typy w modułach logiki, testach, walidatorze i jednorazowym importerze.

## Logika aplikacji

Uruchom `npm test`, aby sprawdzić weryfikowanie odpowiedzi, rundy i powtórki, postępy, magazyn danych oraz format ściąg. Polecenie `npm run typecheck` sprawdza typy modułów TypeScript niezależnych od DOM i testów. Podsumowania odpowiedzi są przechowywane lokalnie w przeglądarce; temat jest oznaczany jako wymagający powtórki po co najmniej trzech próbach, jeśli poprawność wynosi mniej niż 60%.

Przeglądarka korzysta z wygenerowanych plików w `core/build/`; `storage.js` powstaje z `storage.ts`. Po zmianie `/core` lub `storage.ts` uruchom `npm run build:core` i dołącz wygenerowane pliki do publikacji.

## Sprawdzanie form czasowników

Po zainstalowaniu pakietu Python `morfeusz2` uruchom `python check_morfeusz.py`. Skrypt odczytuje manifest, sprawdza każdą odpowiedź i zaakceptowany wariant względem oczekiwanego lematu, czasu i aspektu, oznacza podejrzane ćwiczenia statusem `needs_review` i zapisuje raport w `tools/reports/morfeusz-report.json`.

Uruchom `python -m unittest discover -s tools/tests -p 'test_*.py'`, aby sprawdzić skrypt i tworzenie raportu.

Do migracji starszych danych czasowników użyto `tools/import-exercises.ts`. Aby powtórzyć migrację, wskaż kopię pliku `odmiana.html` sprzed migracji za pomocą `--source` i dodaj `--force`, by zastąpić wygenerowane pliki, na przykład:

```powershell
npm run import:exercises -- --source C:\path\to\legacy-odmiana.html --force
```

## Tworzenie ściągi

Skopiuj `content/cheatsheets/_template.md` do nowego pliku Markdown. Zachowaj pola metadanych (`id`, `level`, `topic`, `related_exercises`) i wszystkie sześć nagłówków sekcji. Dodaj dokładnie pięć zwięzłych przykładów oraz odnośnik do ćwiczeń dla danego poziomu i tematu. W razie potrzeby oznacz formy klasami `gender-masculine`, `gender-feminine` i `gender-neuter`. Ogranicz objaśnienia do 120 słów, aby ściąga mieściła się na ekranie telefonu. Szablon z podkreśleniem na początku nazwy służy do tworzenia treści i nie jest publikowaną ściągą. Otwórz gotową stronę pod adresem `cheatsheet.html?id=<id>`; jej mechanizm obsługuje ograniczony podzbiór Markdown z szablonu i wyświetla czytelny komunikat, jeśli dana ściąga nie została jeszcze przygotowana.
