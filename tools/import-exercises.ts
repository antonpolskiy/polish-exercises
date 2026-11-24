import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { runInNewContext } from "node:vm";

type LegacyTense = {
  key: "present" | "past" | "future";
  label: string;
};

type LegacyVerb = {
  infinitive: string;
  meaning: string;
  pastAspectPair?: {
    perfective: {
      infinitive: string;
      pastRoot: string;
      pastVowel: string;
    };
    context: string;
  };
};

type LegacyForm = {
  pronoun: string;
  stem: string;
  ending: string;
  suffix: string;
};

type ExercisePresentation = {
  modes: ("easy" | "hard")[];
  verb: string;
  meaning: string;
  tense: LegacyTense["key"];
  subject: string;
  prefix: string;
  suffix: string;
  aspect?: "imperfective" | "perfective";
};

type ExerciseRecord = {
  id: string;
  level: "unsorted";
  topic: string;
  type: "fill_full_form" | "choose_aspect";
  prompt: string;
  answers: string[];
  accept_variants: string[];
  hint: string;
  explanation: string;
  cheatsheet_id: string;
  difficulty: number;
  status: "needs_review";
  presentation: ExercisePresentation;
};

type LegacyModel = {
  verbs: LegacyVerb[];
  tenses: LegacyTense[];
  pastSentenceSubjects: string[];
  getRows: (verb: LegacyVerb, tense: LegacyTense) => LegacyForm[];
  createSentence: (verb: LegacyVerb, tense: LegacyTense, rowIndex: number) => string;
  getFullForm: (item: LegacyForm) => string;
};

const root = resolve(import.meta.dirname, "..");
const sourceIndex = process.argv.indexOf("--source");
if (sourceIndex >= 0 && !process.argv[sourceIndex + 1]) {
  throw new Error("Provide a legacy HTML file after --source.");
}
const sourcePath = resolve(root, sourceIndex >= 0 ? process.argv[sourceIndex + 1] : "odmiana.html");
const outputRoot = resolve(root, "content");
const force = process.argv.includes("--force");
const requiredFiles = [
  "exercise-index.json",
  "exercises/unsorted/verb.present.json",
  "exercises/unsorted/verb.past.json",
  "exercises/unsorted/verb.future.json",
  "exercises/unsorted/verb.aspect.context.json",
];

function slug(value: string): string {
  const polishLetters: Record<string, string> = {
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
  return value
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, (letter) => polishLetters[letter])
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function readLegacyModel(html: string): LegacyModel {
  const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!scriptMatch) {
    throw new Error("Could not find the legacy exercise script; pass --source with a pre-migration odmiana.html.");
  }

  const script = scriptMatch[1];
  const domMarker = '    const form = document.querySelector("#exercise-form");';
  const formStart = script.indexOf(domMarker);
  const rowsStart = script.indexOf("    function getRows(verb, tense)");
  const renderStart = script.indexOf("    function renderExercise()");
  if (formStart < 0 || rowsStart < formStart || renderStart < rowsStart) {
    throw new Error("The legacy exercise data/functions in odmiana.html no longer match the importer.");
  }

  const migrationSource = [
    script.slice(0, formStart),
    script.slice(rowsStart, renderStart),
    "globalThis.__migration = { verbs, tenses, pastSentenceSubjects, getRows, createSentence, getFullForm };",
  ].join("\n");
  const context: {
    window: { location: { search: string } };
    URLSearchParams: typeof URLSearchParams;
    __migration?: unknown;
  } = {
    window: { location: { search: "?level=hard" } },
    URLSearchParams,
  };
  runInNewContext(migrationSource, context, { filename: "odmiana-legacy.js" });

  const model = context.__migration as LegacyModel | undefined;
  if (!model || !Array.isArray(model.verbs) || !Array.isArray(model.tenses)) {
    throw new Error("The legacy exercise data could not be loaded.");
  }
  return model;
}

function createHint(tense: LegacyTense["key"], subject: string, aspect?: "imperfective" | "perfective"): string {
  if (aspect === "perfective") {
    return `Czynność jest zakończona: wybierz aspekt dokonany i dopasuj formę do podmiotu (${subject}).`;
  }
  const tenseName = {
    present: "teraźniejszego",
    past: "przeszłego",
    future: "przyszłego",
  }[tense];
  return `Utwórz formę czasu ${tenseName} zgodnie z podmiotem (${subject}).`;
}

function createRecord(options: {
  id: string;
  topic: string;
  type: ExerciseRecord["type"];
  prompt: string;
  verb: string;
  meaning: string;
  tense: LegacyTense["key"];
  subject: string;
  item: LegacyForm;
  answer: string;
  modes: ("easy" | "hard")[];
  aspect?: "imperfective" | "perfective";
}): ExerciseRecord {
  const { id, topic, type, prompt, verb, meaning, tense, subject, item, answer, modes, aspect } = options;
  return {
    id,
    level: "unsorted",
    topic,
    type,
    prompt,
    answers: [answer],
    accept_variants: [],
    hint: createHint(tense, subject, aspect),
    explanation: `Forma: ${item.stem} + ${item.ending}${item.suffix} = ${answer}.`,
    cheatsheet_id: topic.replaceAll(".", "-"),
    difficulty: 2,
    status: "needs_review",
    presentation: {
      modes,
      verb,
      meaning,
      tense,
      subject,
      prefix: item.stem,
      suffix: item.suffix,
      ...(aspect ? { aspect } : {}),
    },
  };
}

async function ensureNoExistingOutput(): Promise<void> {
  if (force) return;
  for (const file of requiredFiles) {
    try {
      await access(resolve(outputRoot, file));
      throw new Error(`Refusing to overwrite ${file}; rerun with --force to replace generated exercise files.`);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Refusing to overwrite")) throw error;
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}

async function main(): Promise<void> {
  await ensureNoExistingOutput();
  const html = await readFile(sourcePath, "utf8");
  const model = readLegacyModel(html);
  const recordsByTopic = new Map<string, ExerciseRecord[]>();
  const addRecord = (record: ExerciseRecord) => {
    const records = recordsByTopic.get(record.topic) ?? [];
    records.push(record);
    recordsByTopic.set(record.topic, records);
  };

  for (const verb of model.verbs) {
    for (const tense of model.tenses) {
      const rows = model.getRows(verb, tense);
      for (const [rowIndex, item] of rows.entries()) {
        const pairedPast = tense.key === "past" && verb.pastAspectPair !== undefined;
        const answer = model.getFullForm(item);
        const topic = `verb.${tense.key}`;
        const subject = item.pronoun;
        const prompt = pairedPast
          ? `${model.pastSentenceSubjects[rowIndex]} wczoraj przez cały wieczór ___ ${verb.pastAspectPair!.context} (${verb.infinitive}).`
          : model.createSentence(verb, tense, rowIndex);
        addRecord(
          createRecord({
            id: `verb-${slug(verb.infinitive)}-${tense.key}-${String(rowIndex + 1).padStart(2, "0")}`,
            topic,
            type: "fill_full_form",
            prompt,
            verb: verb.infinitive,
            meaning: verb.meaning,
            tense: tense.key,
            subject,
            item,
            answer,
            modes: pairedPast ? ["easy"] : ["easy", "hard"],
            ...(pairedPast ? { aspect: "imperfective" as const } : {}),
          })
        );
      }

      if (tense.key === "past" && verb.pastAspectPair) {
        const perfective = verb.pastAspectPair.perfective;
        const perfectiveVerb = {
          ...verb,
          infinitive: perfective.infinitive,
          pastRoot: perfective.pastRoot,
          pastVowel: perfective.pastVowel,
        };
        const rows = model.getRows(perfectiveVerb, tense);
        for (const [rowIndex, item] of rows.entries()) {
          addRecord(
            createRecord({
              id: `verb-${slug(perfective.infinitive)}-past-context-${String(rowIndex + 1).padStart(2, "0")}`,
              topic: "verb.aspect.context",
              type: "choose_aspect",
              prompt: model.createSentence(verb, tense, rowIndex),
              verb: perfective.infinitive,
              meaning: verb.meaning,
              tense: "past",
              subject: item.pronoun,
              item,
              answer: model.getFullForm(item),
              modes: ["hard"],
              aspect: "perfective",
            })
          );
        }
      }
    }
  }

  const topics = [...recordsByTopic.keys()].sort();
  const manifest = {
    files: topics.map((topic) => `exercises/unsorted/${topic}.json`),
  };
  const outputs = new Map<string, string>([
    ["exercise-index.json", `${JSON.stringify(manifest, null, 2)}\n`],
    ...topics.map((topic) => [
      `exercises/unsorted/${topic}.json`,
      `${JSON.stringify(recordsByTopic.get(topic), null, 2)}\n`,
    ] as [string, string]),
  ]);

  for (const [path, content] of outputs) {
    const outputPath = resolve(outputRoot, path);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, content, "utf8");
    console.log(`Wrote ${relative(root, outputPath)}.`);
  }

  const total = [...recordsByTopic.values()].reduce((count, records) => count + records.length, 0);
  console.log(`Imported ${total} exercise records from ${model.verbs.length} verbs.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
