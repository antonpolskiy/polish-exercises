const polishDiacritics = {
    ą: "a",
    ć: "c",
    ę: "e",
    ł: "l",
    ń: "n",
    ó: "o",
    ś: "s",
    ź: "z",
    ż: "z",
};
function normalizeAnswer(value) {
    return value.trim().replace(/\s+/gu, " ").toLocaleLowerCase("pl");
}
function withoutPolishDiacritics(value) {
    return value.replace(/[ąćęłńóśźż]/gu, (letter) => polishDiacritics[letter]);
}
function expectedInputs(exercise, mode) {
    const forms = [...exercise.answers, ...exercise.accept_variants];
    if (mode === "hard")
        return forms;
    const { prefix, suffix } = exercise.presentation;
    const inputs = forms
        .filter((form) => form.startsWith(prefix) && form.endsWith(suffix))
        .map((form) => form.slice(prefix.length, suffix ? form.length - suffix.length : form.length));
    if (inputs.length === 0) {
        throw new Error(`Ćwiczenie „${exercise.id}” nie ma odpowiedzi zgodnej z przedrostkiem i przyrostkiem trybu łatwego.`);
    }
    return inputs;
}
export function checkAnswer(exercise, mode, input) {
    const normalizedInput = normalizeAnswer(input);
    const expected = expectedInputs(exercise, mode).map(normalizeAnswer);
    if (expected.includes(normalizedInput))
        return "correct";
    if (expected.some((form) => withoutPolishDiacritics(form) === withoutPolishDiacritics(normalizedInput))) {
        return "nearly-correct";
    }
    return "incorrect";
}
