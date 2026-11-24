import { createEmptyProgress } from "./core/build/progress.js";
import type { ProgressStorage } from "./core/build/storage.js";
import type { ProgressSnapshot } from "./core/build/types.js";

const progressStorageKey = "polish-exercises.progress.v1";
const levels = new Set<string>(["A1", "A2", "B1", "B2", "unsorted"]);
const modes = new Set<string>(["easy", "hard"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isProgressSnapshot(value: unknown): value is ProgressSnapshot {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.groups)) return false;
  const keys = new Set<string>();

  for (const candidate of value.groups as unknown[]) {
    if (!isRecord(candidate)) return false;
    const level = candidate.level;
    const topic = candidate.topic;
    const mode = candidate.mode;
    const attempts = candidate.attempts;
    const correct = candidate.correct;
    if (
      typeof level !== "string" ||
      !levels.has(level) ||
      typeof topic !== "string" ||
      topic.trim().length === 0 ||
      typeof mode !== "string" ||
      !modes.has(mode) ||
      typeof attempts !== "number" ||
      !Number.isInteger(attempts) ||
      attempts < 1 ||
      typeof correct !== "number" ||
      !Number.isInteger(correct) ||
      correct < 0 ||
      correct > attempts
    ) {
      return false;
    }

    const key = `${level}\u0000${topic}\u0000${mode}`;
    if (keys.has(key)) return false;
    keys.add(key);
  }
  return true;
}

export function createLocalStorageProgressStorage(
  storage: Pick<Storage, "getItem" | "setItem">,
): ProgressStorage {
  return {
    load() {
      const saved = storage.getItem(progressStorageKey);
      if (saved === null) return createEmptyProgress();

      let parsed: unknown;
      try {
        parsed = JSON.parse(saved);
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(`Zapisane postępy nie są prawidłowym plikiem JSON: ${detail}`);
      }
      if (!isProgressSnapshot(parsed)) {
        throw new Error("Zapisane postępy mają nieobsługiwany lub nieprawidłowy format.");
      }
      return parsed;
    },
    save(progress) {
      if (!isProgressSnapshot(progress)) {
        throw new TypeError("Nie można zapisać nieprawidłowego zestawienia postępów.");
      }
      storage.setItem(progressStorageKey, JSON.stringify(progress));
    },
  };
}
