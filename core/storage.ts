import type { ProgressSnapshot } from "./types.js";

export interface ProgressStorage {
  load(): ProgressSnapshot;
  save(progress: ProgressSnapshot): void;
}
