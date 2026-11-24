import json
import sys
from datetime import datetime, timezone
from pathlib import Path


def lexical_lemma(infinitive):
    return infinitive.split()[0]


def load_documents(content_dir):
    content_dir = content_dir.resolve()
    manifest_path = content_dir / "exercise-index.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if not isinstance(manifest, dict) or not isinstance(manifest.get("files"), list):
        raise ValueError(f"Invalid exercise manifest: {manifest_path}")

    documents = []
    for relative_path in manifest["files"]:
        if not isinstance(relative_path, str):
            raise ValueError(f"Invalid file path in exercise manifest: {relative_path!r}")
        file_path = (content_dir / relative_path).resolve()
        if not file_path.is_relative_to(content_dir):
            raise ValueError(f"Exercise path escapes the content directory: {relative_path}")
        records = json.loads(file_path.read_text(encoding="utf-8"))
        if not isinstance(records, list):
            raise ValueError(f"Expected an exercise array in {file_path}")
        documents.append((file_path, records))
    if not documents or not any(records for _, records in documents):
        raise ValueError("No exercises found in the content manifest.")
    return documents


def check_exercises(exercises, analyzer):
    cache = {}
    failures = []
    checked_forms = 0

    for exercise in exercises:
        presentation = exercise["presentation"]
        tense = presentation["tense"]
        required_tag = {
            "present": "fin:",
            "past": "praet:",
            "future": "bedzie:" if presentation["verb"] == "być" else "inf:",
        }[tense]
        aspect = {
            "perfective": "perf",
            "imperfective": "imperf",
        }.get(presentation.get("aspect"))

        for field in ("answers", "accept_variants"):
            for form in exercise[field]:
                checked_forms += 1
                if form not in cache:
                    cache[form] = analyzer.analyse(form)
                lemma = lexical_lemma(presentation["verb"])
                matching = [
                    item[2]
                    for item in cache[form]
                    if len(item) > 2
                    and len(item[2]) > 2
                    and (item[2][1] == lemma or item[2][1].startswith(lemma + ":"))
                    and item[2][2].startswith(required_tag)
                    and (aspect is None or item[2][2].endswith(":" + aspect))
                ]
                if matching:
                    continue

                recognized = sorted(
                    {
                        f"{item[2][1]} [{item[2][2]}]"
                        for item in cache[form]
                        if len(item) > 2 and len(item[2]) > 2 and item[2][2] != "ign"
                    }
                )
                failures.append(
                    {
                        "exercise_id": exercise["id"],
                        "field": field,
                        "form": form,
                        "infinitive": presentation["verb"],
                        "tense": tense,
                        "required_aspect": aspect,
                        "recognized_analyses": recognized or ["no dictionary analysis"],
                    }
                )

    return checked_forms, len(cache), failures


def mark_suspicious_for_review(documents, failures):
    failed_ids = {failure["exercise_id"] for failure in failures}
    updates = []
    for file_path, records in documents:
        changed = False
        for exercise in records:
            if exercise["id"] not in failed_ids or exercise.get("status") in {"needs_review", "rejected"}:
                continue
            previous_status = exercise.get("status")
            exercise["status"] = "needs_review"
            updates.append(
                {
                    "exercise_id": exercise["id"],
                    "from": previous_status,
                    "to": "needs_review",
                }
            )
            changed = True
        if changed:
            file_path.write_text(f"{json.dumps(records, ensure_ascii=False, indent=2)}\n", encoding="utf-8")
    return updates


def process_content(content_dir, analyzer, report_path):
    documents = load_documents(content_dir)
    exercises = [exercise for _, records in documents for exercise in records]
    checked_forms, unique_spellings, failures = check_exercises(exercises, analyzer)
    status_updates = mark_suspicious_for_review(documents, failures)
    report = {
        "tool": "morfeusz2",
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "records_checked": len(exercises),
        "answer_forms_checked": checked_forms,
        "unique_spellings": unique_spellings,
        "suspicious_exercises": len({failure["exercise_id"] for failure in failures}),
        "failures": failures,
        "status_updates": status_updates,
    }
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(f"{json.dumps(report, ensure_ascii=False, indent=2)}\n", encoding="utf-8")
    return report


def create_analyzer():
    try:
        import morfeusz2
    except ImportError as error:
        raise SystemExit("Install the morfeusz2 Python package to run this checker.") from error
    return morfeusz2.Morfeusz()


def main():
    root = Path(__file__).resolve().parent
    content_dir = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else root / "content"
    report_path = root / "tools" / "reports" / "morfeusz-report.json"
    report = process_content(content_dir, create_analyzer(), report_path)

    print(
        f"Checked {report['answer_forms_checked']} answer forms "
        f"({report['unique_spellings']} unique spellings) from {report['records_checked']} records."
    )
    print(f"Morfeusz report saved to {report_path.relative_to(root)}.")
    if report["failures"]:
        for failure in report["failures"]:
            print(
                f"FAIL\t{failure['exercise_id']}\t{failure['tense']}\t{failure['infinitive']}\t"
                f"{failure['form']}\t{'; '.join(failure['recognized_analyses'])}"
            )
        print(
            f"Found {len(report['failures'])} suspicious answer(s) in "
            f"{report['suspicious_exercises']} exercise(s); statuses set to needs_review where applicable."
        )
        return 1

    print("All exercise answers have a Morfeusz analysis matching their expected lemma, tense, and aspect.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
