import assert from "node:assert/strict";
import { test } from "node:test";
import { advanceRound, createRound, currentExercise, recordAnswer } from "../rounds.ts";
import type { Exercise } from "../types.js";

function exercise(
  id: string,
  modes: Exercise["presentation"]["modes"] = ["easy", "hard"],
  level: Exercise["level"] = "B1",
  topic = "verb.past",
  status: Exercise["status"] = "ok",
): Exercise {
  return {
    id,
    level,
    topic,
    status,
    answers: [id],
    accept_variants: [],
    presentation: { modes, prefix: "", suffix: "" },
  };
}

const stableRandom = () => 0.999;

test("creates a shuffled round containing only exercises for the selected mode", () => {
  const easy = exercise("easy", ["easy"]);
  const hard = exercise("hard", ["hard"]);
  const round = createRound([easy, hard], "easy", stableRandom);

  assert.equal(round.roundNumber, 1);
  assert.equal(currentExercise(round).id, "easy");
  assert.deepEqual(round.exercises.map(({ id }) => id), ["easy"]);
});

test("filters rounds by level and topic, permits needs_review, and excludes rejected", () => {
  const selected = exercise("selected", ["hard"], "A2", "verb.present", "needs_review");
  const otherLevel = exercise("other-level", ["hard"], "B1", "verb.present");
  const otherTopic = exercise("other-topic", ["hard"], "A2", "verb.past", "needs_review");
  const rejected = exercise("rejected", ["hard"], "A2", "verb.present", "rejected");
  const round = createRound(
    [selected, otherLevel, otherTopic, rejected],
    "hard",
    stableRandom,
    { level: "A2", topic: "verb.present" },
  );

  assert.deepEqual(round.exercises.map(({ id }) => id), ["selected"]);
});

test("can start an unsorted needs_review round", () => {
  const legacy = exercise("legacy", ["easy"], "unsorted", "verb.past", "needs_review");
  const round = createRound([legacy], "easy", stableRandom, { level: "unsorted" });

  assert.equal(currentExercise(round).id, "legacy");
});

test("repeats missed and nearly-correct exercises before starting a full round", () => {
  const pool = [exercise("first"), exercise("second"), exercise("third")];
  let round = createRound(pool, "hard", stableRandom);
  round = recordAnswer(round, "incorrect");
  round = advanceRound(round, stableRandom);
  assert.equal(currentExercise(round).id, "second");
  round = recordAnswer(round, "correct");
  round = advanceRound(round, stableRandom);
  assert.equal(currentExercise(round).id, "third");
  round = recordAnswer(round, "nearly-correct");
  round = advanceRound(round, stableRandom);

  assert.equal(round.roundNumber, 2);
  assert.equal(round.isRetry, true);
  assert.deepEqual(round.exercises.map(({ id }) => id), ["first", "third"]);
});

test("resumes the full exercise pool after a retry round with no new mistakes", () => {
  const pool = [exercise("first"), exercise("second")];
  let round = createRound(pool, "hard", stableRandom);
  round = recordAnswer(round, "incorrect");
  round = advanceRound(round, stableRandom);
  round = advanceRound(round, stableRandom);
  assert.equal(round.isRetry, true);
  round = advanceRound(round, stableRandom);

  assert.equal(round.roundNumber, 3);
  assert.equal(round.isRetry, false);
  assert.deepEqual(round.exercises.map(({ id }) => id), ["first", "second"]);
});

test("rejects empty mode pools and invalid random values", () => {
  assert.throws(() => createRound([exercise("hard", ["hard"])], "easy"), /No exercises are available/);
  assert.throws(() => createRound([exercise("one"), exercise("two")], "easy", () => 1), /random source/);
  assert.throws(
    () => createRound([exercise("rejected", ["easy"], "A1", "verb.present", "rejected")], "easy"),
    /No exercises are available/,
  );
});
