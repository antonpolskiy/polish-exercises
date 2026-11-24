import type { AnswerStatus, Exercise, ExerciseLevel, ExerciseMode } from "./types.js";
export interface RoundState {
    mode: ExerciseMode;
    roundNumber: number;
    exercises: readonly Exercise[];
    allExercises: readonly Exercise[];
    currentIndex: number;
    retryExercises: readonly Exercise[];
    isRetry: boolean;
}
export interface RoundFilters {
    level?: ExerciseLevel;
    topic?: string;
}
export declare function createRound(exercises: readonly Exercise[], mode: ExerciseMode, random?: () => number, filters?: RoundFilters): RoundState;
export declare function currentExercise(round: RoundState): Exercise;
export declare function recordAnswer(round: RoundState, status: AnswerStatus): RoundState;
export declare function advanceRound(round: RoundState, random?: () => number): RoundState;
