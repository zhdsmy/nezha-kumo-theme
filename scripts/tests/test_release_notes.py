import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('release_notes', Path(__file__).parents[1] / 'release_notes.py')
release_notes = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release_notes)


class ReleaseNotesTests(unittest.TestCase):
    def test_extracts_only_matching_version(self):
        text = '# Changelog\n\n## [Unreleased]\nfuture\n\n## [0.1.0] - 2026-11-18\n\n- Feature\n\n### Details\nDetails\n\n## [0.0.1]\nold\n'
        self.assertEqual(release_notes.extract(text, 'v0.1.0'), '- Feature\n\n### Details\nDetails\n')

    def test_rejects_missing_empty_and_invalid_versions(self):
        for text, tag in [('## [0.1.0]\n', 'v0.1.0'), ('## [0.1.0]\nnotes', 'v0.2.0'), ('## [0.1.0]\nnotes', 'v../bad')]:
            with self.subTest(tag=tag), self.assertRaises(AssertionError):
                release_notes.extract(text, tag)
