function shuffle(items, random) {
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
function buildRound(allExercises, selectedExercises, mode, roundNumber, isRetry, random) {
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
export function createRound(exercises, mode, random = Math.random, filters = {}) {
    const eligibleExercises = exercises.filter((exercise) => exercise.status !== "rejected" &&
        exercise.presentation.modes.includes(mode) &&
        (filters.level === undefined || exercise.level === filters.level) &&
        (filters.topic === undefined || exercise.topic === filters.topic));
    if (eligibleExercises.length === 0) {
        throw new RangeError(`No exercises are available for the selected filters and ${mode} mode.`);
    }
    return buildRound(eligibleExercises, eligibleExercises, mode, 1, false, random);
}
export function currentExercise(round) {
    const exercise = round.exercises[round.currentIndex];
    if (!exercise)
        throw new RangeError("The round has no current exercise.");
    return exercise;
}
export function recordAnswer(round, status) {
    if (status === "correct")
        return round;
    const exercise = currentExercise(round);
    if (round.retryExercises.some((retry) => retry.id === exercise.id))
        return round;
    return { ...round, retryExercises: [...round.retryExercises, exercise] };
}
export function advanceRound(round, random = Math.random) {
    if (round.currentIndex < round.exercises.length - 1) {
        return { ...round, currentIndex: round.currentIndex + 1 };
    }
    const isRetry = round.retryExercises.length > 0;
    const nextExercises = isRetry ? round.retryExercises : round.allExercises;
    return buildRound(round.allExercises, nextExercises, round.mode, round.roundNumber + 1, isRetry, random);
}
