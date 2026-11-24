import type { AnswerStatus, Exercise, ExerciseMode, ProgressSnapshot, ProgressSummary } from "./types.js";
export declare const WEAK_TOPIC_MIN_ATTEMPTS = 3;
export declare const WEAK_TOPIC_MAX_ACCURACY = 60;
export declare function createEmptyProgress(): ProgressSnapshot;
export declare function recordAttempt(progress: ProgressSnapshot, exercise: Exercise, mode: ExerciseMode, status: AnswerStatus): ProgressSnapshot;
export declare function summarizeProgress(progress: ProgressSnapshot, mode: ExerciseMode): ProgressSummary;
