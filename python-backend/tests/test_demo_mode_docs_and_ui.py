import unittest
from pathlib import Path


class DemoModeDocsAndUiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.repo_root = Path(__file__).resolve().parents[2]

    def test_demo_script_exists_and_contains_required_steps(self):
        demo_script = self.repo_root / "docs" / "DEMO_SCRIPT.md"
        self.assertTrue(demo_script.exists(), "docs/DEMO_SCRIPT.md must exist")

        body = demo_script.read_text(encoding="utf-8")
        self.assertIn("Demo Script (3-5 минут)", body)
        self.assertIn("admin@example.com", body)
        self.assertIn("target-postgres", body)
        self.assertIn("Запустить демо", body)

    def test_dashboard_strings_are_russian_for_demo_hints(self):
        strings_file = self.repo_root / "frontend" / "src" / "lib" / "strings.ts"
        self.assertTrue(strings_file.exists(), "frontend/src/lib/strings.ts must exist")

        body = strings_file.read_text(encoding="utf-8")
        self.assertIn("Подключите БД → настройте бэкапы → сделайте первый бэкап", body)
        self.assertIn("Запустить демо", body)
        self.assertIn("Остановить демо", body)
        self.assertNotIn("Start demo", body)
        self.assertNotIn("Guided demo", body)


if __name__ == "__main__":
    unittest.main()
