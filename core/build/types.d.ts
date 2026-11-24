export type ExerciseMode = "easy" | "hard";
export type AnswerStatus = "correct" | "nearly-correct" | "incorrect";
export type ExerciseLevel = "A1" | "A2" | "B1" | "B2" | "unsorted";
export type ExerciseStatus = "ok" | "needs_review" | "rejected";
export interface Exercise {
    id: string;
    level: ExerciseLevel;
    topic: string;
    status: ExerciseStatus;
    answers: readonly string[];
    accept_variants: readonly string[];
    presentation: {
        modes: readonly ExerciseMode[];
        prefix: string;
        suffix: string;
    };
}
export interface ProgressGroup {
    level: ExerciseLevel;
    topic: string;
    mode: ExerciseMode;
    attempts: number;
    correct: number;
}
export interface ProgressSnapshot {
    version: 1;
    groups: readonly ProgressGroup[];
}
export interface ProgressMetric {
    name: string;
    attempts: number;
    correct: number;
    accuracyPercent: number;
}
export interface ProgressSummary {
    attempts: number;
    correct: number;
    accuracyPercent: number;
    byLevel: readonly ProgressMetric[];
    byTopic: readonly ProgressMetric[];
    weakTopics: readonly ProgressMetric[];
}
