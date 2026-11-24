import json
import re
import sys
from pathlib import Path

try:
    import morfeusz2
except ImportError as error:
    raise SystemExit("Install the morfeusz2 Python package to run this checker.") from error


def parse_string(value):
    return json.loads(value)


def parse_array(source, name):
    match = re.search(rf"\b{name}\s*=\s*(\[[^\]]*\])", source)
    if not match:
        raise ValueError(f"Could not find JavaScript array {name}.")
    return json.loads(match.group(1))


def parse_extra_array(extra, name):
    match = re.search(rf"\b{name}\s*:\s*(\[[^\]]*\])", extra)
    return json.loads(match.group(1)) if match else None


def split_arguments(source):
    arguments = []
    start = 0
    depth = 0
    quote = None
    escaped = False

    for index, character in enumerate(source):
        if quote:
            if escaped:
                escaped = False
            elif character == "\\":
                escaped = True
            elif character == quote:
                quote = None
        elif character in "\"'":
            quote = character
        elif character in "[{(":
            depth += 1
        elif character in "]})":
            depth -= 1
        elif character == "," and depth == 0:
            arguments.append(source[start:index].strip())
            start = index + 1

    arguments.append(source[start:].strip())
    return arguments


def define_verb_calls(source):
    for match in re.finditer(r"\bdefineVerb\s*\(", source):
        start = match.end()
        depth = 1
        quote = None
        escaped = False

        for index in range(start, len(source)):
            character = source[index]
            if quote:
                if escaped:
                    escaped = False
                elif character == "\\":
                    escaped = True
                elif character == quote:
                    quote = None
            elif character in "\"'":
                quote = character
            elif character == "(":
                depth += 1
            elif character == ")":
                depth -= 1
                if depth == 0:
                    yield source[start:index]
                    break
        else:
            raise ValueError("Unclosed defineVerb call.")


def parse_past_vowels(extra, vowel, vowel_patterns):
    match = re.search(r"\bpastVowels\s*:\s*(Array\(13\)\.fill\(\"[^\"]*\"\)|[A-Za-z]+|\[[^\]]*\])", extra)
    if not match:
        return [vowel] * 13
    value = match.group(1)
    if value.startswith("Array("):
        repeated = re.search(r'\.fill\((".*?")\)', value)
        return [parse_string(repeated.group(1))] * 13
    if value.startswith("["):
        return json.loads(value)
    return vowel_patterns[value]


def parse_verb(call, vowel_patterns, present_classes):
    arguments = split_arguments(call)
    if len(arguments) < 6:
        raise ValueError(f"Expected six required defineVerb arguments: {call}")

    infinitive, meaning, present_stem, present_class, past_root, past_vowel = [
        parse_string(value) for value in arguments[:6]
    ]
    extra = arguments[6] if len(arguments) > 6 else ""
    present_endings = parse_extra_array(extra, "presentEndings") or present_classes[present_class]
    present_stems = parse_extra_array(extra, "presentStems")
    past_stems = parse_extra_array(extra, "pastStems")
    particle_match = re.search(r'\bparticle\s*:\s*("(?:\\.|[^"])*")', extra)
    future_match = re.search(r'\bfutureInfinitive\s*:\s*("(?:\\.|[^"])*")', extra)

    pair_match = re.search(
        r'\bpastAspectPair\s*:\s*\{\s*perfective\s*:\s*\{\s*'
        r'infinitive\s*:\s*("(?:\\.|[^"])*")\s*,\s*'
        r'pastRoot\s*:\s*("(?:\\.|[^"])*")\s*,\s*'
        r'pastVowel\s*:\s*("(?:\\.|[^"])*")',
        extra,
    )
    pair = None
    if pair_match:
        pair = {
            "infinitive": parse_string(pair_match.group(1)),
            "past_root": parse_string(pair_match.group(2)),
            "past_vowel": parse_string(pair_match.group(3)),
        }

    return {
        "infinitive": infinitive,
        "present_stem": present_stem,
        "present_endings": present_endings,
        "present_stems": present_stems,
        "past_root": past_root,
        "past_vowel": past_vowel,
        "past_vowels": parse_past_vowels(extra, past_vowel, vowel_patterns),
        "past_stems": past_stems,
        "particle": parse_string(particle_match.group(1)) if particle_match else "",
        "future_infinitive": parse_string(future_match.group(1)) if future_match else infinitive,
        "aspect_pair": pair,
    }


def lexical_lemma(infinitive):
    return infinitive.split()[0]


def main():
    html_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).with_name("odmiana.html")
    script = html_path.read_text(encoding="utf-8").split("<script>", 1)[1].split("</script>", 1)[0]

    classes_source = script.split("const presentClasses = {", 1)[1].split("};", 1)[0]
    present_classes = {
        name: json.loads(value)
        for name, value in re.findall(r"^\s*([^\s:]+)\s*:\s*(\[[^\]]*\])", classes_source, re.MULTILINE)
    }
    vowel_patterns = {
        "pastVowelsIaIe": parse_array(script, "pastVowelsIaIe"),
        "pastVowelsAie": parse_array(script, "pastVowelsAie"),
    }
    past_forms_source = script.split("const pastForms = [", 1)[1].split("\n    ];", 1)[0]
    past_endings = re.findall(r'\bending\s*:\s*("(?:\\.|[^"])*")', past_forms_source)
    past_endings = [parse_string(ending) for ending in past_endings]
    future_endings = parse_array(script, "futureEndings")

    verbs_source = script.split("const verbs = [", 1)[1].split("\n    ];", 1)[0]
    verbs = [parse_verb(call, vowel_patterns, present_classes) for call in define_verb_calls(verbs_source)]
    if not verbs:
        raise ValueError("No defineVerb entries were found.")

    candidates = []

    def add(form, infinitive, tense, required_tag, aspect=None):
        candidates.append(
            {
                "form": form.strip(),
                "infinitive": infinitive,
                "tense": tense,
                "required_tag": required_tag,
                "aspect": aspect,
            }
        )

    def add_verb_forms(verb, infinitive, past_root, past_vowel, aspect_pair=False):
        add(infinitive, infinitive, "infinitive", "inf:", "perf" if aspect_pair else None)

        if not aspect_pair:
            for index, ending in enumerate(verb["present_endings"]):
                stem = verb["present_stems"][index] if verb["present_stems"] else verb["present_stem"]
                add(stem + ending + verb["particle"], infinitive, "present", "fin:")

        for index, ending in enumerate(past_endings):
            stem = verb["past_stems"][index] if verb["past_stems"] else past_root
            vowel = verb["past_vowels"][index] if not aspect_pair else past_vowel
            add(stem + vowel + ending + verb["particle"], infinitive, "past", "praet:", "perf" if aspect_pair else None)

        if not aspect_pair:
            for ending in future_endings:
                form = "będ" + ending
                expected = infinitive if verb["future_infinitive"] else "być"
                if verb["future_infinitive"]:
                    form += " " + verb["future_infinitive"]
                add(form, expected, "future", "bedzie:" if expected == "być" else "inf:")

    for verb in verbs:
        add_verb_forms(verb, verb["infinitive"], verb["past_root"], verb["past_vowel"])
        if verb["aspect_pair"]:
            pair = verb["aspect_pair"]
            add_verb_forms(verb, pair["infinitive"], pair["past_root"], pair["past_vowel"], aspect_pair=True)

    analyzer = morfeusz2.Morfeusz()
    cache = {}
    failures = []

    for candidate in candidates:
        form = candidate["form"]
        if form not in cache:
            cache[form] = analyzer.analyse(form)
        analyses = cache[form]
        lemma = lexical_lemma(candidate["infinitive"])
        matching = [
            item[2]
            for item in analyses
            if len(item) > 2
            and len(item[2]) > 2
            and (item[2][1] == lemma or item[2][1].startswith(lemma + ":"))
            and item[2][2].startswith(candidate["required_tag"])
            and (candidate["aspect"] is None or item[2][2].endswith(":" + candidate["aspect"]))
        ]
        if not matching:
            recognized = [
                f"{item[2][1]} [{item[2][2]}]"
                for item in analyses
                if len(item) > 2 and len(item[2]) > 2 and item[2][2] != "ign"
            ]
            failures.append((candidate, ", ".join(sorted(set(recognized))) or "no dictionary analysis"))

    print(f"Checked {len(candidates)} generated forms ({len(cache)} unique spellings) from {html_path.name}.")
    if failures:
        for candidate, recognized in failures:
            print(
                f"FAIL\t{candidate['tense']}\t{candidate['infinitive']}\t"
                f"{candidate['form']}\t{recognized}"
            )
        print(f"Found {len(failures)} forms without the expected Morfeusz analysis.")
        return 1

    print("All generated forms have a Morfeusz analysis matching their expected lemma and tense.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
