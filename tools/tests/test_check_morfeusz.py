import json
import tempfile
import unittest
from pathlib import Path

from check_morfeusz import process_content


class FakeAnalyzer:
    def __init__(self, analyses):
        self.analyses = analyses
        self.calls = []

    def analyse(self, form):
        self.calls.append(form)
        lemma, tag = self.analyses[form]
        return [(0, 1, (form, lemma, tag))]


def exercise(exercise_id, answer, status="ok", aspect=None):
    presentation = {"verb": "ratować", "tense": "past"}
    if aspect is not None:
        presentation["aspect"] = aspect
    return {
        "id": exercise_id,
        "answers": [answer],
        "accept_variants": [],
        "status": status,
        "presentation": presentation,
    }


class MorfeuszReportTests(unittest.TestCase):
    def setUp(self):
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary_directory.name)
        self.content_dir = self.root / "content"
        self.exercise_file = self.content_dir / "exercises" / "past.json"
        self.exercise_file.parent.mkdir(parents=True)
        (self.content_dir / "exercise-index.json").write_text(
            json.dumps({"files": ["exercises/past.json"]}),
            encoding="utf-8",
        )
        self.report_path = self.root / "tools" / "reports" / "morfeusz-report.json"

    def tearDown(self):
        self.temporary_directory.cleanup()

    def write_exercises(self, records):
        self.exercise_file.write_text(json.dumps(records, ensure_ascii=False), encoding="utf-8")

    def test_suspicious_answers_are_reported_and_marked_for_review(self):
        self.write_exercises(
            [
                exercise("valid-answer", "ratowałem"),
                exercise("bad-answer", "rezerwałem"),
            ]
        )
        analyzer = FakeAnalyzer(
            {
                "ratowałem": ("ratować", "praet:imperf"),
                "rezerwałem": ("rezerwować", "praet:imperf"),
            }
        )

        report = process_content(self.content_dir, analyzer, self.report_path)
        saved_records = json.loads(self.exercise_file.read_text(encoding="utf-8"))
        saved_report = json.loads(self.report_path.read_text(encoding="utf-8"))

        self.assertEqual(report["suspicious_exercises"], 1)
        self.assertEqual(report["failures"][0]["exercise_id"], "bad-answer")
        self.assertEqual([record["status"] for record in saved_records], ["ok", "needs_review"])
        self.assertEqual(saved_report, report)

    def test_wrong_aspect_is_flagged_but_rejected_status_is_not_downgraded(self):
        self.write_exercises([exercise("rejected-answer", "ratowałem", status="rejected", aspect="perfective")])
        analyzer = FakeAnalyzer({"ratowałem": ("ratować", "praet:imperf")})

        report = process_content(self.content_dir, analyzer, self.report_path)
        saved_records = json.loads(self.exercise_file.read_text(encoding="utf-8"))

        self.assertEqual(report["suspicious_exercises"], 1)
        self.assertEqual(report["failures"][0]["required_aspect"], "perf")
        self.assertEqual(saved_records[0]["status"], "rejected")
        self.assertEqual(report["status_updates"], [])

    def test_reuses_analysis_for_duplicate_spellings(self):
        self.write_exercises(
            [
                exercise("first", "ratowałem"),
                exercise("second", "ratowałem"),
            ]
        )
        analyzer = FakeAnalyzer({"ratowałem": ("ratować", "praet:imperf")})

        report = process_content(self.content_dir, analyzer, self.report_path)

        self.assertEqual(report["answer_forms_checked"], 2)
        self.assertEqual(report["unique_spellings"], 1)
        self.assertEqual(analyzer.calls, ["ratowałem"])
        self.assertEqual(report["failures"], [])


if __name__ == "__main__":
    unittest.main()
