import assert from "node:assert/strict";
import { test } from "node:test";
import { createEmptyProgress, recordAttempt, summarizeProgress } from "../progress.ts";
import type { Exercise } from "../types.js";

function exercise(id: string, topic: string, level: Exercise["level"] = "unsorted"): Exercise {
  return {
    id,
    level,
    topic,
    status: "ok",
    answers: [id],
    accept_variants: [],
    presentation: { modes: ["easy", "hard"], prefix: "", suffix: "" },
  };
}

test("aggregates attempts and accuracy by topic and content level, separately by mode", () => {
  const first = exercise("one", "verb.past", "B1");
  const second = exercise("two", "verb.aspect");
  let progress = createEmptyProgress();
  progress = recordAttempt(progress, first, "easy", "correct");
  progress = recordAttempt(progress, first, "easy", "incorrect");
  progress = recordAttempt(progress, second, "easy", "nearly-correct");
  progress = recordAttempt(progress, first, "hard", "correct");

  const easy = summarizeProgress(progress, "easy");
  assert.equal(easy.attempts, 3);
  assert.equal(easy.correct, 1);
  assert.equal(easy.accuracyPercent, 33);
  assert.deepEqual(easy.byLevel.map(({ name }) => name), ["unsorted", "B1"]);
  assert.deepEqual(easy.byTopic.map(({ name }) => name), ["verb.aspect", "verb.past"]);
  assert.equal(summarizeProgress(progress, "hard").accuracyPercent, 100);
});

test("flags only topics below the accuracy threshold after enough attempts", () => {
  const target = exercise("one", "verb.past");
  let progress = createEmptyProgress();
  progress = recordAttempt(progress, target, "easy", "incorrect");
  progress = recordAttempt(progress, target, "easy", "nearly-correct");
  assert.equal(summarizeProgress(progress, "easy").weakTopics.length, 0);
  progress = recordAttempt(progress, target, "easy", "incorrect");
  assert.deepEqual(summarizeProgress(progress, "easy").weakTopics.map(({ name }) => name), ["verb.past"]);
});

test("returns zeroed totals for a mode with no attempts", () => {
  assert.deepEqual(summarizeProgress(createEmptyProgress(), "hard"), {
    attempts: 0,
    correct: 0,
    accuracyPercent: 0,
    byLevel: [],
    byTopic: [],
    weakTopics: [],
  });
});
