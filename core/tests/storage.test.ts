import assert from "node:assert/strict";
import { test } from "node:test";
import { createLocalStorageProgressStorage } from "../../storage.ts";
import { createEmptyProgress, recordAttempt } from "../progress.ts";
import type { Exercise } from "../types.js";

function exercise(): Exercise {
  return {
    id: "past-example",
    level: "unsorted",
    topic: "verb.past",
    status: "ok",
    answers: ["ratowałem"],
    accept_variants: [],
    presentation: { modes: ["easy", "hard"], prefix: "ratow", suffix: "" },
  };
}

function memoryStorage(initialValue: string | null = null) {
  let value = initialValue;
  return {
    getItem: () => value,
    setItem: (_key: string, nextValue: string) => {
      value = nextValue;
    },
  };
}

test("loads empty progress and persists updated aggregates across store instances", () => {
  const storage = memoryStorage();
  const firstStore = createLocalStorageProgressStorage(storage);
  const initial = firstStore.load();
  const updated = recordAttempt(initial, exercise(), "easy", "correct");
  firstStore.save(updated);

  assert.deepEqual(createLocalStorageProgressStorage(storage).load(), updated);
});

test("zgłasza błędy uszkodzonych lub nieobsługiwanych zapisanych postępów", () => {
  assert.throws(() => createLocalStorageProgressStorage(memoryStorage("{")).load(), /nie są prawidłowym plikiem JSON/);
  assert.throws(
    () => createLocalStorageProgressStorage(memoryStorage('{"version":2,"groups":[]}')).load(),
    /nieobsługiwany lub nieprawidłowy format/,
  );
});

test("surfaces browser storage write failures", () => {
  const storage = {
    getItem: () => null,
    setItem: () => {
      throw new Error("storage full");
    },
  };
  const store = createLocalStorageProgressStorage(storage);
  assert.throws(() => store.save(createEmptyProgress()), /storage full/);
});
