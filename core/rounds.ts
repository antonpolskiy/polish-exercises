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

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const sample = random();
    if (!Number.isFinite(sample) || sample < 0 || sample >= 1) {
      throw new RangeError("The random source must return a number in [0, 1).");
    }
    const swapIndex = Math.floor(sample * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function buildRound(
  allExercises: readonly Exercise[],
  selectedExercises: readonly Exercise[],
  mode: ExerciseMode,
  roundNumber: number,
  isRetry: boolean,
  random: () => number,
): RoundState {
  return {
    mode,
    roundNumber,
    exercises: shuffle(selectedExercises, random),
    allExercises,
    currentIndex: 0,
    retryExercises: [],
    isRetry,
  };
}

export function createRound(
  exercises: readonly Exercise[],
  mode: ExerciseMode,
  random: () => number = Math.random,
  filters: RoundFilters = {},
): RoundState {
  const eligibleExercises = exercises.filter((exercise) =>
    exercise.status !== "rejected" &&
    exercise.presentation.modes.includes(mode) &&
    (filters.level === undefined || exercise.level === filters.level) &&
    (filters.topic === undefined || exercise.topic === filters.topic)
  );
  if (eligibleExercises.length === 0) {
    throw new RangeError(`No exercises are available for the selected filters and ${mode} mode.`);
  }
  return buildRound(eligibleExercises, eligibleExercises, mode, 1, false, random);
}

export function currentExercise(round: RoundState): Exercise {
  const exercise = round.exercises[round.currentIndex];
  if (!exercise) throw new RangeError("The round has no current exercise.");
  return exercise;
}

export function recordAnswer(round: RoundState, status: AnswerStatus): RoundState {
  if (status === "correct") return round;
  const exercise = currentExercise(round);
  if (round.retryExercises.some((retry) => retry.id === exercise.id)) return round;
  return { ...round, retryExercises: [...round.retryExercises, exercise] };
}

export function advanceRound(round: RoundState, random: () => number = Math.random): RoundState {
  if (round.currentIndex < round.exercises.length - 1) {
    return { ...round, currentIndex: round.currentIndex + 1 };
  }

  const isRetry = round.retryExercises.length > 0;
  const nextExercises = isRetry ? round.retryExercises : round.allExercises;
  return buildRound(round.allExercises, nextExercises, round.mode, round.roundNumber + 1, isRetry, random);
}
