import { parseCheatsheet } from "./cheatsheet-content.js";

const sheet = document.querySelector("#sheet");
const sheetError = document.querySelector("#sheet-error");
const errorTitle = document.querySelector("#error-title");
const errorMessage = document.querySelector("#error-message");
const sheetMeta = document.querySelector("#sheet-meta");
const sheetTitle = document.querySelector("#sheet-title");
const sheetContent = document.querySelector("#sheet-content");
const backLink = document.querySelector("#back-link");
const id = new URLSearchParams(window.location.search).get("id");
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const sectionNames = ["Zasada", "Formy", "Wyjątki", "Pułapki językowe", "Przykłady", "Ćwiczenia"];

function renderInline(parent, tokens) {
  for (const token of tokens) {
    if (token.type === "gender") {
      const span = document.createElement("span");
      span.className = `gender-${token.gender}`;
      span.textContent = token.value;
      parent.append(span);
    } else if (token.type === "link") {
      const link = document.createElement("a");
      link.className = "practice-link";
      link.href = token.href;
      link.textContent = token.value;
      parent.append(link);
    } else if (token.type === "code") {
      const code = document.createElement("code");
      code.textContent = token.value;
      parent.append(code);
    } else if (token.type === "emphasis") {
      const emphasis = document.createElement("em");
      emphasis.textContent = token.value;
      parent.append(emphasis);
    } else {
      parent.append(document.createTextNode(token.value));
    }
  }
}

function renderBlock(parent, block) {
  if (block.type === "table") {
    const wrapper = document.createElement("div");
    wrapper.className = "table-scroll";
    const table = document.createElement("table");
    const head = document.createElement("thead");
    const headerRow = document.createElement("tr");
    for (const cell of block.headers) {
      const header = document.createElement("th");
      header.scope = "col";
      renderInline(header, cell);
      headerRow.append(header);
    }
    head.append(headerRow);
    const body = document.createElement("tbody");
    for (const row of block.rows) {
      const tableRow = document.createElement("tr");
      for (const cell of row) {
        const tableCell = document.createElement("td");
        renderInline(tableCell, cell);
        tableRow.append(tableCell);
      }
      body.append(tableRow);
    }
    table.append(head, body);
    wrapper.append(table);
    parent.append(wrapper);
    return;
  }

  if (block.type === "ordered-list" || block.type === "unordered-list") {
    const list = document.createElement(block.type === "ordered-list" ? "ol" : "ul");
    for (const item of block.items) {
      const listItem = document.createElement("li");
      renderInline(listItem, Array.isArray(item) ? item : item.content);
      list.append(listItem);
    }
    parent.append(list);
    return;
  }

  const paragraph = document.createElement("p");
  renderInline(paragraph, block.content);
  parent.append(paragraph);
}

function renderCheatsheet(data) {
  document.title = `${data.title} — Ściąga z języka polskiego`;
  sheetTitle.textContent = data.title;
  sheetMeta.textContent = `${data.metadata.level} · ${data.metadata.topic}`;
  sheetContent.replaceChildren();

  for (const name of sectionNames) {
    const section = document.createElement("section");
    section.className = "sheet-section";
    const heading = document.createElement("h2");
    heading.textContent = name;
    section.append(heading);
    for (const block of data.sections[name]) renderBlock(section, block);
    sheetContent.append(section);
  }

  backLink.href = `odmiana.html?level=hard&cefr=${encodeURIComponent(data.metadata.level)}&topic=${encodeURIComponent(data.metadata.topic)}`;
  sheet.hidden = false;
  sheetError.hidden = true;
}

function showError(title, message) {
  errorTitle.textContent = title;
  errorMessage.textContent = message;
  sheet.hidden = true;
  sheetError.hidden = false;
}

async function loadCheatsheet() {
  if (!idPattern.test(id ?? "")) {
    showError("Nieprawidłowy adres", "Brakuje identyfikatora ściągi lub ma on nieprawidłowy format.");
    return;
  }

  try {
    const url = new URL(`content/cheatsheets/${id}.md`, window.location.href);
    const response = await fetch(url);
    if (response.status === 404) {
      showError("Ściąga nie została jeszcze utworzona", `Nie ma jeszcze pliku ściągi o identyfikatorze „${id}”.`);
      return;
    }
    if (!response.ok) throw new Error(`Nie udało się pobrać ściągi (błąd ${response.status}).`);

    const data = parseCheatsheet(await response.text());
    if (data.metadata.id !== id) {
      throw new Error("Identyfikator w adresie nie zgadza się z identyfikatorem ściągi.");
    }
    renderCheatsheet(data);
  } catch (error) {
    console.error(error);
    showError("Nie udało się otworzyć ściągi", "Wystąpił błąd podczas wczytywania. Szczegóły zapisano w konsoli przeglądarki.");
  }
}

loadCheatsheet();
