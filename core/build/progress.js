export const WEAK_TOPIC_MIN_ATTEMPTS = 3;
export const WEAK_TOPIC_MAX_ACCURACY = 60;
export function createEmptyProgress() {
    return { version: 1, groups: [] };
}
export function recordAttempt(progress, exercise, mode, status) {
    const existingIndex = progress.groups.findIndex((group) => group.level === exercise.level && group.topic === exercise.topic && group.mode === mode);
    const isCorrect = status === "correct";
    if (existingIndex < 0) {
        return {
            version: 1,
            groups: [
                ...progress.groups,
                {
                    level: exercise.level,
                    topic: exercise.topic,
                    mode,
                    attempts: 1,
                    correct: isCorrect ? 1 : 0,
                },
            ],
        };
    }
    return {
        version: 1,
        groups: progress.groups.map((group, index) => index === existingIndex
            ? { ...group, attempts: group.attempts + 1, correct: group.correct + (isCorrect ? 1 : 0) }
            : group),
    };
}
function metricsBy(groups, mode, key) {
    const totals = new Map();
    for (const group of groups) {
        if (group.mode !== mode)
            continue;
        const total = totals.get(group[key]) ?? { attempts: 0, correct: 0 };
        total.attempts += group.attempts;
        total.correct += group.correct;
        totals.set(group[key], total);
    }
    return [...totals.entries()]
        .map(([name, total]) => ({
        name,
        ...total,
        accuracyPercent: Math.round((total.correct / total.attempts) * 100),
    }))
        .sort((left, right) => left.accuracyPercent - right.accuracyPercent || left.name.localeCompare(right.name));
}
export function summarizeProgress(progress, mode) {
    const groups = progress.groups.filter((group) => group.mode === mode);
    const attempts = groups.reduce((total, group) => total + group.attempts, 0);
    const correct = groups.reduce((total, group) => total + group.correct, 0);
    const byTopic = metricsBy(groups, mode, "topic");
    return {
        attempts,
        correct,
        accuracyPercent: attempts === 0 ? 0 : Math.round((correct / attempts) * 100),
        byLevel: metricsBy(groups, mode, "level"),
        byTopic,
        weakTopics: byTopic.filter((topic) => topic.attempts >= WEAK_TOPIC_MIN_ATTEMPTS && topic.accuracyPercent < WEAK_TOPIC_MAX_ACCURACY),
    };
}
