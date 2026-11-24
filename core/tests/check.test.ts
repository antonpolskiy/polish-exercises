import assert from "node:assert/strict";
import { test } from "node:test";
import { checkAnswer } from "../check.ts";
import type { Exercise } from "../types.js";

function exercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: "booking-past-f",
    level: "unsorted",
    topic: "verb.aspect.context",
    status: "ok",
    answers: ["zarezerwowała"],
    accept_variants: [],
    presentation: {
      modes: ["easy", "hard"],
      prefix: "zarezerw",
      suffix: "",
    },
    ...overrides,
  };
}

test("checks hard-mode answers case-insensitively and ignores extra whitespace", () => {
  assert.equal(checkAnswer(exercise(), "hard", "  ZAREZERWOWAŁA  "), "correct");
});

test("classifies an answer missing Polish diacritics separately", () => {
  assert.equal(checkAnswer(exercise(), "hard", "zarezerwowala"), "nearly-correct");
});

test("rejects a different conjugation rather than treating it as a diacritic error", () => {
  assert.equal(checkAnswer(exercise(), "hard", "rezerwała"), "incorrect");
});

test("checks only the variable segment in easy mode and preserves suffixes", () => {
  const reflexive = exercise({
    answers: ["cieszę się"],
    presentation: { modes: ["easy"], prefix: "ciesz", suffix: " się" },
  });
  assert.equal(checkAnswer(reflexive, "easy", "Ę"), "correct");
  assert.equal(checkAnswer(reflexive, "hard", "ciesze sie"), "nearly-correct");
});

test("accepts explicitly listed answer variants", () => {
  const withVariant = exercise({ accept_variants: ["zarezerwowały"] });
  assert.equal(checkAnswer(withVariant, "hard", "zarezerwowały"), "correct");
});

test("reports invalid easy-mode answer metadata", () => {
  const invalid = exercise({ presentation: { modes: ["easy"], prefix: "wrong", suffix: "" } });
  assert.throws(() => checkAnswer(invalid, "easy", "a"), /nie ma odpowiedzi zgodnej z przedrostkiem i przyrostkiem trybu łatwego/);
});
