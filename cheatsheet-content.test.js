import assert from "node:assert/strict";
import { test } from "node:test";
import { parseCheatsheet } from "./cheatsheet-content.js";

const validSheet = `---
id: verb-present
level: A1
topic: verb.present
related_exercises:
  - verb-present-example-001
---
# Czas teraźniejszy
## Zasada
Krótka zasada gramatyczna.
## Formy
| Forma | Przykład |
|---|---|
| <span class="gender-masculine">Rodzaj męski</span> | czytałem |
| Rodzaj żeński | czytałam |
## Wyjątki
- Jeden wyjątek.
## Pułapki językowe
- Zwróć uwagę na częste pomyłki.
## Przykłady
1. Ja czytam.
2. Ty czytasz.
3. On czyta.
4. My czytamy.
5. Oni czytają.
## Ćwiczenia
[Przejdź do ćwiczeń →](odmiana.html?level=hard&cefr=A1&topic=verb.present)
`;

test("parses metadata, gender spans, examples, and a matching practice link", () => {
  const sheet = parseCheatsheet(validSheet);
  assert.equal(sheet.metadata.id, "verb-present");
  assert.deepEqual(sheet.metadata.related_exercises, ["verb-present-example-001"]);
  assert.equal(sheet.sections["Formy"][0].rows[0][0][0].gender, "masculine");
  assert.equal(sheet.sections["Przykłady"][0].items.length, 5);
  assert.equal(
    sheet.sections["Ćwiczenia"][0].content[0].href,
    "odmiana.html?level=hard&cefr=A1&topic=verb.present",
  );
  assert.equal(
    new URL(sheet.sections["Ćwiczenia"][0].content[0].href, "https://antonpolskiy.github.io/polish-exercises/cheatsheet.html").pathname,
    "/polish-exercises/odmiana.html",
  );
});

test("rejects a practice link for a different topic", () => {
  assert.throws(
    () => parseCheatsheet(validSheet.replace("topic=verb.present", "topic=verb.past")),
    /odnośnik musi odpowiadać/,
  );
});

test("rejects malformed or incomplete sheets", () => {
  assert.throws(() => parseCheatsheet(validSheet.replace("5. Oni czytają.\n", "")), /dokładnie pięć/);
  assert.throws(() => parseCheatsheet(validSheet.replace("## Wyjątki\n", "## Nieznana sekcja\n")), /nieznana sekcja/);
  assert.throws(
    () => parseCheatsheet(validSheet.replace("odmiana.html?level=hard&cefr=A1&topic=verb.present", "javascript:alert(1)")),
    /adres odsyłający do ćwiczeń jest nieprawidłowy|odnośnik musi prowadzić/,
  );
});
