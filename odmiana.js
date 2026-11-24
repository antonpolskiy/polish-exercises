import { checkAnswer } from "./core/build/check.js";
import {
  recordAttempt,
  summarizeProgress,
  WEAK_TOPIC_MAX_ACCURACY,
  WEAK_TOPIC_MIN_ATTEMPTS,
} from "./core/build/progress.js";
import { advanceRound, createRound, currentExercise, recordAnswer } from "./core/build/rounds.js";
import { createLocalStorageProgressStorage } from "./storage.js";

const mode = new URLSearchParams(window.location.search).get("level") === "hard" ? "hard" : "easy";
const cefrLevels = ["A1", "A2", "B1", "B2"];
const exerciseLevels = [...cefrLevels, "unsorted"];
const form = document.querySelector("#exercise-form");
const filtersForm = document.querySelector("#filters-form");
const cefrFilter = document.querySelector("#cefr-filter");
const topicFilter = document.querySelector("#topic-filter");
const applyFiltersButton = document.querySelector("#apply-filters");
const filterStatus = document.querySelector("#filter-status");
const filterWarning = document.querySelector("#filter-warning");
const filterEmpty = document.querySelector("#filter-empty");
const filterEmptyMessage = document.querySelector("#filter-empty-message");
const rows = document.querySelector("#answer-rows");
const summary = document.querySelector("#summary");
const progressSummary = document.querySelector("#progress-summary");
const progressLevels = document.querySelector("#progress-levels");
const progressTopics = document.querySelector("#progress-topics");
const progressWeakTopics = document.querySelector("#progress-weak-topics");
const progressStorageError = document.querySelector("#progress-storage-error");
const checkButton = form.querySelector(".check-button");
const clearButton = document.querySelector("#clear-button");
const verbCard = document.querySelector("#verb-card");
const sentenceCard = document.querySelector("#sentence-card");
const exerciseCard = document.querySelector(".exercise-card");
let exercises = [];
let availableExercises = [];
let roundState;
let activeExercise;
let hasChecked = false;
let selectedCefr = "";
let selectedTopic = "";
let progressStorage;
let progress;
let progressError = "";

const tenseLabels = {
  present: "Czas teraźniejszy",
  past: "Czas przeszły",
  future: "Czas przyszły",
};
const easyInstructions = {
  present: "Wpisz końcówkę po podanym temacie czasownika.",
  past: "Wpisz całą zmienną część formy, także samogłoskę.",
  future: "Uzupełnij końcówkę czasownika posiłkowego „być”.",
};
const topicLabels = {
  "verb.aspect.context": "Aspekt czasownika w kontekście",
  "verb.future": "Czas przyszły",
  "verb.past": "Czas przeszły",
  "verb.present": "Czas teraźniejszy",
};

function isExerciseRecord(value) {
  if (!value || typeof value !== "object") return false;
  const presentation = value.presentation;
  return (
    typeof value.id === "string" &&
    typeof value.cheatsheet_id === "string" &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.cheatsheet_id) &&
    (cefrLevels.includes(value.level) || value.level === "unsorted") &&
    typeof value.topic === "string" &&
    ["ok", "needs_review", "rejected"].includes(value.status) &&
    Array.isArray(value.answers) &&
    Array.isArray(value.accept_variants) &&
    presentation !== null &&
    typeof presentation === "object" &&
    Array.isArray(presentation.modes) &&
    typeof presentation.verb === "string" &&
    typeof presentation.meaning === "string" &&
    typeof presentation.tense === "string" &&
    typeof presentation.subject === "string" &&
    typeof presentation.prefix === "string" &&
    typeof presentation.suffix === "string"
  );
}

async function loadExercises() {
  const indexUrl = new URL("content/exercise-index.json", window.location.href);
  const indexResponse = await fetch(indexUrl);
  if (!indexResponse.ok) {
    throw new Error(`Nie udało się pobrać indeksu ćwiczeń (błąd ${indexResponse.status}).`);
  }
  const index = await indexResponse.json();
  if (!index || !Array.isArray(index.files) || !index.files.every((path) => typeof path === "string")) {
    throw new Error("Indeks ćwiczeń ma nieprawidłowy format.");
  }

  const files = await Promise.all(index.files.map(async (path) => {
    const response = await fetch(new URL(path, indexUrl));
    if (!response.ok) throw new Error(`Nie udało się pobrać danych ćwiczeń (błąd ${response.status}): ${path}`);
    const records = await response.json();
    if (!Array.isArray(records) || !records.every(isExerciseRecord)) {
      throw new Error(`Dane ćwiczeń mają nieprawidłowy format: ${path}`);
    }
    return records;
  }));
  return files.flat();
}

function populateTopics(level, preferredTopic = "") {
  const topics = [...new Set(availableExercises
    .filter((exercise) => exercise.level === level)
    .map((exercise) => exercise.topic))]
    .sort();
  topicFilter.replaceChildren(new Option("Wszystkie tematy", ""));
  for (const topic of topics) {
    topicFilter.add(new Option(topicLabels[topic] ?? topic, topic));
  }
  topicFilter.disabled = topics.length === 0;
  topicFilter.value = topics.includes(preferredTopic) ? preferredTopic : "";
  selectedTopic = topicFilter.value;
}

function configureFilters(records) {
  availableExercises = records.filter((exercise) => exercise.status !== "rejected");
  const availableLevels = new Set(availableExercises.map((exercise) => exercise.level));
  for (const option of cefrFilter.options) {
    if (option.value) option.disabled = !availableLevels.has(option.value);
  }
  const params = new URLSearchParams(window.location.search);
  const requestedCefr = params.get("cefr");
  selectedCefr = availableLevels.has(requestedCefr)
    ? requestedCefr
    : exerciseLevels.find((candidate) => availableLevels.has(candidate)) ?? "";
  cefrFilter.value = selectedCefr;
  populateTopics(selectedCefr, params.get("topic") ?? "");
  applyFiltersButton.disabled = false;
  refreshFilterStatus();
  updateModeLinks();
}

function refreshFilterStatus() {
  const matchingExercises = availableExercises.filter((exercise) =>
    exercise.level === selectedCefr &&
    (!selectedTopic || exercise.topic === selectedTopic) &&
    exercise.presentation.modes.includes(mode)
  );
  const reviewCount = matchingExercises.filter((exercise) => exercise.status !== "ok").length;
  filterStatus.textContent = selectedCefr
    ? `Ćwiczenia w zestawie: ${matchingExercises.length}; sprawdzone: ${matchingExercises.length - reviewCount}; wymagają sprawdzenia: ${reviewCount}.`
    : "Brak dostępnych ćwiczeń: wszystkie wpisy zostały odrzucone.";

  const warningMessages = [];
  if (reviewCount > 0) {
    warningMessages.push(`${reviewCount} ćwiczeń wymaga ręcznego sprawdzenia.`);
  }
  if (selectedCefr === "unsorted" && matchingExercises.length > 0) {
    warningMessages.push("Poziom CEFR tych ćwiczeń nie został określony.");
  }
  filterWarning.hidden = warningMessages.length === 0;
  filterWarning.textContent = warningMessages.length
    ? `Uwaga: ${warningMessages.join(" ")} Odpowiedzi mogą zawierać błędy — korzystaj z nich ostrożnie.`
    : "";
}

function updateModeLinks() {
  const currentParams = new URLSearchParams(window.location.search);
  for (const [targetMode, selector] of [["easy", "#easy-link"], ["hard", "#hard-link"]]) {
    const params = new URLSearchParams(currentParams);
    params.set("level", targetMode);
    document.querySelector(selector).href = `odmiana.html?${params.toString()}`;
  }
}

function showFilterEmpty(message) {
  filterEmptyMessage.textContent = message;
  filterEmpty.hidden = false;
  verbCard.hidden = true;
  sentenceCard.hidden = true;
  exerciseCard.hidden = true;
  checkButton.disabled = true;
  clearButton.disabled = true;
}

function startFilteredRound() {
  if (!selectedCefr) {
    showFilterEmpty("Najpierw wybierz poziom CEFR.");
    return;
  }

  try {
    roundState = createRound(exercises, mode, Math.random, {
      level: selectedCefr,
      ...(selectedTopic ? { topic: selectedTopic } : {}),
    });
  } catch (error) {
    if (error instanceof RangeError && error.message.startsWith("No exercises are available")) {
      showFilterEmpty("Brak ćwiczeń w tym trybie dla wybranego poziomu i tematu. Spróbuj zmienić filtry.");
      return;
    }
    throw error;
  }

  filterEmpty.hidden = true;
  exerciseCard.hidden = false;
  checkButton.disabled = false;
  clearButton.disabled = false;
  renderExercise();
}

filtersForm.addEventListener("submit", (event) => {
  event.preventDefault();
  selectedCefr = cefrFilter.value;
  selectedTopic = topicFilter.value;
  const params = new URLSearchParams(window.location.search);
  params.set("level", mode);
  if (selectedCefr) params.set("cefr", selectedCefr);
  else params.delete("cefr");
  if (selectedTopic) params.set("topic", selectedTopic);
  else params.delete("topic");
  window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  updateModeLinks();
  refreshFilterStatus();
  startFilteredRound();
});

cefrFilter.addEventListener("change", () => {
  selectedCefr = cefrFilter.value;
  populateTopics(selectedCefr);
  refreshFilterStatus();
});

function renderProgress() {
  progressStorageError.hidden = !progressError;
  progressStorageError.textContent = progressError;
  if (!progress) {
    progressSummary.textContent = progressError
      ? "Postępy są niedostępne."
      : "Brak zapisanych prób w tym trybie.";
    progressLevels.textContent = "";
    progressTopics.textContent = "";
    progressWeakTopics.textContent = "";
    return;
  }

  const report = summarizeProgress(progress, mode);
  const modeName = mode === "easy" ? "łatwym" : "trudnym";
  progressSummary.textContent = report.attempts === 0
    ? `W trybie ${modeName} nie ma jeszcze zapisanych prób.`
    : `Tryb ${modeName}: prób — ${report.attempts}; poprawnych — ${report.correct} (${report.accuracyPercent}%).`;
  progressLevels.textContent = report.byLevel.length
    ? `Według poziomu CEFR: ${report.byLevel.map(({ name, correct, attempts, accuracyPercent }) => `${name} — ${correct}/${attempts} (${accuracyPercent}%)`).join("; ")}`
    : "";
  progressTopics.textContent = report.byTopic.length
    ? `Według tematów: ${report.byTopic.map(({ name, correct, attempts, accuracyPercent }) => `${name} — ${correct}/${attempts} (${accuracyPercent}%)`).join("; ")}`
    : "";
  progressWeakTopics.textContent = report.weakTopics.length
    ? `Tematy wymagające powtórki (poniżej ${WEAK_TOPIC_MAX_ACCURACY}% po co najmniej ${WEAK_TOPIC_MIN_ATTEMPTS} próbach): ${report.weakTopics.map(({ name }) => name).join(", ")}`
    : report.byTopic.some(({ attempts }) => attempts >= WEAK_TOPIC_MIN_ATTEMPTS)
      ? `Brak tematów wymagających powtórki według obecnego progu (poniżej ${WEAK_TOPIC_MAX_ACCURACY}%).`
      : `Do wskazania tematów wymagających powtórki potrzeba co najmniej ${WEAK_TOPIC_MIN_ATTEMPTS} prób na temat.`;
}

function initializeProgress() {
  try {
    progressStorage = createLocalStorageProgressStorage(window.localStorage);
    progress = progressStorage.load();
  } catch (error) {
    progressError = "Nie udało się odczytać lokalnych postępów. Szczegóły błędu zapisano w konsoli.";
    console.error(error);
  }
  renderProgress();
}

function persistAttempt(status) {
  if (!progressStorage || !progress) return;
  const updatedProgress = recordAttempt(progress, activeExercise, mode, status);
  try {
    progressStorage.save(updatedProgress);
  } catch (error) {
    progressError = "Nie udało się zapisać postępów w tej przeglądarce. Szczegóły błędu zapisano w konsoli.";
    console.error(error);
    renderProgress();
    return;
  }
  progress = updatedProgress;
  progressError = "";
  renderProgress();
}

function renderExercise() {
  activeExercise = currentExercise(roundState);
  hasChecked = false;
  const presentation = activeExercise.presentation;
  const isEasy = mode === "easy";
  const cheatsheetLink = document.querySelector("#cheatsheet-link");
  cheatsheetLink.href = `cheatsheet.html?id=${encodeURIComponent(activeExercise.cheatsheet_id)}`;
  cheatsheetLink.hidden = false;

  filterEmpty.hidden = true;
  exerciseCard.hidden = false;
  verbCard.hidden = !isEasy;
  sentenceCard.hidden = isEasy;

  if (isEasy) {
    document.querySelector("#verb-name").textContent = presentation.verb;
    document.querySelector("#verb-meaning").textContent = presentation.meaning;
    document.querySelector("#tense-name").textContent = tenseLabels[presentation.tense];
  } else {
    document.querySelector("#sentence-text").textContent = activeExercise.prompt;
  }
  document.querySelector("#instructions").textContent = isEasy
    ? easyInstructions[presentation.tense]
    : "Wpisz całą odmienioną formę, nie tylko końcówkę.";
  document.querySelector("#round-status").textContent =
    `Runda ${roundState.roundNumber}${roundState.isRetry ? " · powtórka błędnych" : ""} · pozostałe pytania: ${roundState.exercises.length - roundState.currentIndex - 1}`;
  summary.textContent = "";
  summary.className = "summary";
  checkButton.textContent = "Sprawdź odpowiedzi";

  rows.replaceChildren();
  const row = document.createElement("div");
  row.className = isEasy ? "row" : "row hard-row";
  const answer = document.createElement("input");
  answer.className = "ending";
  answer.type = "text";
  answer.autocomplete = "off";
  answer.autocapitalize = "off";
  answer.spellcheck = false;

  if (isEasy) {
    const pronoun = document.createElement("span");
    pronoun.className = "pronoun";
    pronoun.textContent = presentation.subject;

    const answerLabel = document.createElement("label");
    answerLabel.className = "answer";
    const stem = document.createElement("span");
    stem.className = "stem";
    stem.textContent = presentation.prefix ? `${presentation.prefix}-` : "";
    answer.setAttribute("aria-label", `${presentation.subject}: wpisz końcówkę`);
    answerLabel.append(stem, answer);
    if (presentation.suffix) {
      const suffix = document.createElement("span");
      suffix.className = "suffix";
      suffix.textContent = presentation.suffix;
      answerLabel.append(suffix);
    }
    row.append(pronoun, answerLabel);
  } else {
    const answerLabel = document.createElement("label");
    answerLabel.className = "hard-answer";
    const labelText = document.createElement("span");
    labelText.textContent = "Wpisz odmienioną formę:";
    answer.setAttribute("aria-label", "Pełna forma czasownika");
    answerLabel.append(labelText, answer);
    row.append(answerLabel);
  }

  const result = document.createElement("span");
  result.className = "row-result";
  result.setAttribute("aria-live", "polite");
  row.append(result);
  rows.append(row);
  answer.focus();
}

function renderMode() {
  const isEasy = mode === "easy";
  document.querySelector("#easy-link").classList.toggle("active", isEasy);
  document.querySelector("#hard-link").classList.toggle("active", !isEasy);
  document.querySelector("#tense-eyebrow").textContent =
    `Odmiana czasowników · poziom ${isEasy ? "łatwy" : "trudny"}`;
  document.querySelector("#intro").textContent = isEasy
    ? "Uzupełnij końcówkę jednego czasownika w podanym czasie i dla podanej osoby."
    : "Przeczytaj zdanie i wpisz pełną formę czasownika. Samodzielnie ustal osobę i czas.";
}

function checkAnswers() {
  const row = rows.querySelector(".row");
  const status = checkAnswer(activeExercise, mode, row.querySelector("input").value);
  roundState = recordAnswer(roundState, status);
  persistAttempt(status);
  const isCorrect = status === "correct";
  row.classList.toggle("correct", isCorrect);
  row.classList.toggle("incorrect", !isCorrect);
  row.querySelector(".row-result").textContent = isCorrect
    ? "Poprawnie"
    : status === "nearly-correct"
      ? `Prawie dobrze — poprawna forma: ${activeExercise.answers[0]}`
      : `Poprawna forma: ${activeExercise.answers[0]}`;
  summary.textContent = isCorrect
    ? "Świetnie! Odpowiedź jest poprawna."
    : status === "nearly-correct"
      ? "Prawie dobrze! Uzupełnij polskie znaki diakrytyczne."
      : "Nie tym razem. Sprawdź poprawną formę powyżej.";
  summary.classList.add(isCorrect ? "success" : "needs-work");
  hasChecked = true;
  checkButton.textContent = "Następne ćwiczenie";
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (hasChecked) {
    roundState = advanceRound(roundState);
    renderExercise();
    return;
  }
  checkAnswers();
});

clearButton.addEventListener("click", () => {
  if (hasChecked) {
    renderExercise();
  } else {
    form.reset();
    rows.querySelectorAll(".row").forEach((row) => {
      row.classList.remove("correct", "incorrect");
      row.querySelector(".row-result").textContent = "";
    });
    summary.textContent = "";
    summary.className = "summary";
  }
  rows.querySelector("input").focus();
});

checkButton.disabled = true;
clearButton.disabled = true;
applyFiltersButton.disabled = true;
renderMode();
initializeProgress();
loadExercises()
  .then((loadedExercises) => {
    exercises = loadedExercises;
    configureFilters(exercises);
    if (selectedCefr) {
      startFilteredRound();
    } else {
      showFilterEmpty("Brak ćwiczeń do wyświetlenia: wszystkie wpisy zostały odrzucone albo mają nieprawidłowy format.");
    }
  })
  .catch((error) => {
    checkButton.disabled = true;
    clearButton.disabled = true;
    applyFiltersButton.disabled = true;
    filterStatus.textContent = "Nie udało się wczytać ćwiczeń. Szczegóły błędu zapisano w konsoli.";
    document.querySelector("#intro").textContent = "Nie udało się wczytać ćwiczeń. Szczegóły błędu zapisano w konsoli.";
    console.error(error);
  });
