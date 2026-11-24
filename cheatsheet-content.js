const levels = new Set(["A1", "A2", "B1", "B2"]);
const sectionNames = [
  "Zasada",
  "Formy",
  "Wyjątki",
  "Pułapki językowe",
  "Przykłady",
  "Ćwiczenia",
];
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const topicPattern = /^[a-z][a-z0-9._-]*$/;
const inlinePattern = /<span class="gender-(masculine|feminine|neuter)">([^<>]*)<\/span>|\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`|\*([^*]+)\*/g;

function invalid(message) {
  throw new Error(`Nieprawidłowa ściąga: ${message}`);
}

function parseMetadata(source) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(source);
  if (!match) invalid("brak nagłówka metadanych.");

  const metadata = {};
  const lines = match[1].split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) continue;

    const listMatch = /^related_exercises:\s*(.*)$/.exec(line);
    if (listMatch) {
      if (Object.hasOwn(metadata, "related_exercises")) invalid("pole related_exercises występuje więcej niż raz.");
      const value = listMatch[1].trim();
      if (value === "[]") {
        metadata.related_exercises = [];
      } else if (value === "") {
        const items = [];
        while (index + 1 < lines.length && /^\s+-\s+/.test(lines[index + 1])) {
          const item = lines[index + 1].trim().replace(/^-\s+/, "");
          if (!idPattern.test(item)) invalid("pole related_exercises może zawierać tylko identyfikatory ćwiczeń.");
          items.push(item);
          index += 1;
        }
        metadata.related_exercises = items;
      } else {
        invalid("pole related_exercises musi być pustą tablicą albo listą.");
      }
      continue;
    }

    const fieldMatch = /^(id|level|topic):\s*([a-zA-Z0-9._-]+)$/.exec(line);
    if (!fieldMatch) invalid(`nieobsługiwane pole metadanych: ${line}`);
    const [, name, value] = fieldMatch;
    if (Object.hasOwn(metadata, name)) invalid(`pole ${name} występuje więcej niż raz.`);
    metadata[name] = value;
  }

  if (!idPattern.test(metadata.id ?? "")) invalid("identyfikator id musi składać się z małych liter, cyfr i łączników.");
  if (!levels.has(metadata.level)) invalid("poziom musi mieć wartość A1, A2, B1 albo B2.");
  if (!topicPattern.test(metadata.topic ?? "")) invalid("brakuje tematu albo ma on nieprawidłową wartość.");
  if (!Array.isArray(metadata.related_exercises) || new Set(metadata.related_exercises).size !== metadata.related_exercises.length) {
    invalid("pole related_exercises musi zawierać unikalne identyfikatory ćwiczeń.");
  }
  return { metadata, body: match[2] };
}

function validatePracticeLink(href, metadata) {
  let url;
  try {
    url = new URL(href, "https://cheatsheet.invalid/cheatsheet.html");
  } catch {
    invalid("adres odsyłający do ćwiczeń jest nieprawidłowy.");
  }
  if (url.origin !== "https://cheatsheet.invalid" || url.pathname !== "/odmiana.html") {
    invalid("odnośnik musi prowadzić do lokalnej strony ćwiczeń.");
  }
  if (
    !["easy", "hard"].includes(url.searchParams.get("level")) ||
    url.searchParams.get("cefr") !== metadata.level ||
    url.searchParams.get("topic") !== metadata.topic ||
    [...url.searchParams.keys()].some((key) => !["level", "cefr", "topic"].includes(key))
  ) {
    invalid("odnośnik musi odpowiadać poziomowi i tematowi ściągi.");
  }
  return `odmiana.html${url.search}`;
}

function parseInline(text, metadata) {
  const tokens = [];
  let cursor = 0;
  for (const match of text.matchAll(inlinePattern)) {
    const start = match.index;
    if (start > cursor) tokens.push({ type: "text", value: text.slice(cursor, start) });
    if (match[1]) {
      tokens.push({ type: "gender", gender: match[1], value: match[2] });
    } else if (match[3]) {
      tokens.push({
        type: "link",
        value: match[3],
        href: validatePracticeLink(match[4], metadata),
      });
    } else if (match[5]) {
      tokens.push({ type: "code", value: match[5] });
    } else if (match[6]) {
      tokens.push({ type: "emphasis", value: match[6] });
    }
    cursor = start + match[0].length;
  }
  if (cursor < text.length) tokens.push({ type: "text", value: text.slice(cursor) });
  return tokens;
}

function parseTableRow(line, metadata) {
  const cells = line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|");
  return cells.map((cell) => parseInline(cell.trim(), metadata));
}

function parseBlocks(lines, metadata) {
  const blocks = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) {
      index += 1;
      continue;
    }
    if (line.startsWith("|")) {
      const tableLines = [];
      while (index < lines.length && lines[index].trim().startsWith("|")) {
        tableLines.push(lines[index].trim());
        index += 1;
      }
      if (tableLines.length < 3) invalid("tabela form musi mieć nagłówek, separator i co najmniej jeden wiersz.");
      const rawRows = tableLines.map((tableLine) =>
        tableLine.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim())
      );
      if (!rawRows[1].every((cell) => /^:?-{3,}:?$/.test(cell))) invalid("separator tabeli form jest nieprawidłowy.");
      const headers = parseTableRow(tableLines[0], metadata);
      const rows = rawRows.slice(2).map((cells, rowIndex) => {
        if (cells.length !== headers.length) invalid(`wiersz ${rowIndex + 1} tabeli form ma nieprawidłową liczbę komórek.`);
        return cells.map((cell) => parseInline(cell, metadata));
      });
      blocks.push({ type: "table", headers, rows });
      continue;
    }

    const ordered = /^(\d+)\.\s+(.*)$/.exec(line);
    if (ordered) {
      const items = [];
      while (index < lines.length) {
        const item = /^(\d+)\.\s+(.*)$/.exec(lines[index].trim());
        if (!item) break;
        items.push({ number: Number(item[1]), content: parseInline(item[2], metadata) });
        index += 1;
      }
      blocks.push({ type: "ordered-list", items });
      continue;
    }

    const unordered = /^-\s+(.*)$/.exec(line);
    if (unordered) {
      const items = [];
      while (index < lines.length) {
        const item = /^-\s+(.*)$/.exec(lines[index].trim());
        if (!item) break;
        items.push(parseInline(item[1], metadata));
        index += 1;
      }
      blocks.push({ type: "unordered-list", items });
      continue;
    }

    const paragraph = [line];
    index += 1;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !lines[index].trim().startsWith("|") &&
      !/^(?:\d+\.|-)\s+/.test(lines[index].trim())
    ) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push({ type: "paragraph", content: parseInline(paragraph.join(" "), metadata) });
  }
  return blocks;
}

function tokenText(tokens) {
  return tokens.map(({ value }) => value).join("");
}

export function parseCheatsheet(source) {
  if (typeof source !== "string") invalid("źródło musi być tekstem.");
  const { metadata, body } = parseMetadata(source);
  const lines = body.replace(/<!--[\s\S]*?-->/g, "").trim().split(/\r?\n/);
  const titleMatch = /^#\s+(.+)$/.exec(lines.shift()?.trim() ?? "");
  if (!titleMatch) invalid("wymagany jest tytuł główny.");
  const title = titleMatch[1].trim();
  if (!title) invalid("tytuł nie może być pusty.");

  const sectionLines = new Map();
  let currentSection = "";
  for (const line of lines) {
    const heading = /^##\s+(.+)$/.exec(line.trim());
    if (heading) {
      currentSection = heading[1].trim();
      if (!sectionNames.includes(currentSection)) invalid(`nieznana sekcja: ${currentSection}.`);
      if (sectionLines.has(currentSection)) invalid(`sekcja ${currentSection} występuje więcej niż raz.`);
      sectionLines.set(currentSection, []);
      continue;
    }
    if (!currentSection && line.trim()) invalid("treść musi znajdować się pod nagłówkiem wymaganej sekcji.");
    if (currentSection) sectionLines.get(currentSection).push(line);
  }
  if (sectionNames.some((name) => !sectionLines.has(name))) invalid("ściąga musi zawierać wszystkie wymagane sekcje.");

  const sections = Object.fromEntries(sectionNames.map((name) => [
    name,
    parseBlocks(sectionLines.get(name), metadata),
  ]));
  if (sections["Formy"].filter(({ type }) => type === "table").length === 0) {
    invalid("sekcja „Formy” musi zawierać tabelę.");
  }
  if (
    sections["Zasada"].length !== 1 ||
    sections["Zasada"][0].type !== "paragraph"
  ) {
    invalid("sekcja „Zasada” musi zawierać jeden krótki akapit.");
  }
  const examples = sections["Przykłady"];
  if (
    examples.length !== 1 ||
    examples[0].type !== "ordered-list" ||
    examples[0].items.length !== 5 ||
    examples[0].items.some((item, index) => item.number !== index + 1)
  ) {
    invalid("sekcja „Przykłady” musi zawierać dokładnie pięć ponumerowanych przykładów.");
  }
  const practice = sections["Ćwiczenia"];
  if (
    practice.length !== 1 ||
    practice[0].type !== "paragraph" ||
    practice[0].content.filter(({ type }) => type === "link").length !== 1
  ) {
    invalid("sekcja „Ćwiczenia” musi zawierać jeden prawidłowy odnośnik.");
  }

  const explanatoryBlocks = [
    ...sections["Zasada"],
    ...sections["Wyjątki"],
    ...sections["Pułapki językowe"],
  ];
  const explanatoryText = explanatoryBlocks.map((block) =>
    block.type === "paragraph"
      ? tokenText(block.content)
      : block.type.endsWith("list")
        ? block.items.map((item) => tokenText(Array.isArray(item) ? item : item.content)).join(" ")
        : ""
  ).join(" ");
  if (explanatoryText.trim().split(/\s+/).filter(Boolean).length > 120) {
    invalid("tekst objaśniający nie może przekraczać 120 słów.");
  }

  return { metadata, title, sections };
}
