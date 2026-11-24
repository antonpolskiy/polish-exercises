import { readdir, readFile, stat } from "node:fs/promises";
import { extname, relative, resolve } from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";

type Exercise = {
  id: string;
  level: "A1" | "A2" | "B1" | "B2" | "unsorted";
  topic: string;
  type: "fill_full_form" | "choose_option" | "fix_error" | "transform_sentence" | "choose_aspect";
  prompt: string;
  answers: string[];
  accept_variants: string[];
  hint: string;
  explanation: string;
  cheatsheet_id: string;
  difficulty: number;
  status: "ok" | "needs_review" | "rejected";
  presentation: {
    modes: ("easy" | "hard")[];
    verb: string;
    meaning: string;
    tense: "present" | "past" | "future";
    subject: string;
    prefix: string;
    suffix: string;
    aspect?: "imperfective" | "perfective";
  };
};

const schemaPath = new URL("../content/schema/exercise.schema.json", import.meta.url);
const schema = JSON.parse(await readFile(schemaPath, "utf8"));
const ajv = new Ajv2020({ allErrors: true });
const validateExercise = ajv.compile<Exercise>(schema);
const isExercise = (record: unknown): record is Exercise => validateExercise(record);
const defaultTarget = "content/exercises";
const suppliedTarget = process.argv[2];
const target = resolve(suppliedTarget ?? defaultTarget);

async function findJsonFiles(path: string): Promise<string[]> {
  const fileInfo = await stat(path);
  if (fileInfo.isFile()) {
    if (extname(path).toLowerCase() !== ".json") {
      throw new Error(`Expected a JSON file or directory: ${relative(process.cwd(), path)}`);
    }
    return [path];
  }
  if (!fileInfo.isDirectory()) {
    throw new Error(`Expected a JSON file or directory: ${relative(process.cwd(), path)}`);
  }

  const entries = await readdir(path, { withFileTypes: true });
  const nested = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory() || (entry.isFile() && extname(entry.name).toLowerCase() === ".json"))
      .map((entry) => findJsonFiles(resolve(path, entry.name)))
  );
  return nested.flat().sort();
}

function formatSchemaError(error: NonNullable<typeof validateExercise.errors>[number]): string {
  const missingProperty =
    error.keyword === "required"
      ? `/${(error.params as { missingProperty: string }).missingProperty}`
      : "";
  const instancePath = `${error.instancePath}${missingProperty}` || "/";
  return `${instancePath}: ${error.message ?? "is invalid"}`;
}

async function main(): Promise<number> {
  let files: string[];
  try {
    files = await findJsonFiles(target);
  } catch (error) {
    if (!suppliedTarget && (error as NodeJS.ErrnoException).code === "ENOENT") {
      console.log("No exercise records yet; content/exercises has not been created.");
      return 0;
    }
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }

  if (files.length === 0) {
    console.log(`No exercise JSON files found under ${relative(process.cwd(), target)}; nothing was validated.`);
    return 0;
  }

  const ids = new Map<string, string>();
  let errors = 0;
  let checked = 0;

  for (const file of files) {
    const displayPath = relative(process.cwd(), file);
    let parsed: unknown;
    try {
      parsed = JSON.parse(await readFile(file, "utf8"));
    } catch (error) {
      console.error(`FAIL ${displayPath}: ${error instanceof Error ? error.message : String(error)}`);
      errors += 1;
      continue;
    }

    const records = Array.isArray(parsed) ? parsed : [parsed];
    if (records.length === 0) {
      console.error(`FAIL ${displayPath}: topic file must contain at least one exercise.`);
      errors += 1;
      continue;
    }

    checked += records.length;
    records.forEach((record, index) => {
      const recordPath = Array.isArray(parsed) ? `${displayPath}[${index}]` : displayPath;
      if (!isExercise(record)) {
        for (const error of validateExercise.errors ?? []) {
          console.error(`FAIL ${recordPath}: ${formatSchemaError(error)}`);
        }
        errors += 1;
        return;
      }

      const previousPath = ids.get(record.id);
      if (previousPath) {
        console.error(`FAIL ${recordPath}: duplicate id "${record.id}" also found in ${previousPath}`);
        errors += 1;
        return;
      }
      ids.set(record.id, recordPath);
    });
  }

  if (errors > 0) {
    console.error(`Validation failed: ${errors} error(s) in ${checked} record(s).`);
    return 1;
  }

  console.log(`Validated ${checked} exercise record(s) successfully.`);
  return 0;
}

process.exitCode = await main();
