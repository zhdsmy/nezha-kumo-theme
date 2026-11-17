import importlib.util
from pathlib import Path
import tempfile
import unittest
import zipfile

spec = importlib.util.spec_from_file_location('package', Path(__file__).parents[1] / 'package.py')
package = importlib.util.module_from_spec(spec)
spec.loader.exec_module(package)


class PackageTests(unittest.TestCase):
    def test_reproducible_and_nezha_layout(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            dist = root / 'build'
            dist.mkdir()
            (dist / 'index.html').write_text('<script src="/dashboard/assets/main.js"></script>')
            (dist / 'assets').mkdir()
            (dist / 'assets/main.js').write_text('console.log("synthetic")')
            for name in ['main.js.map', 'size-report.json', '.vite/manifest.json']:
                path = dist / name
                path.parent.mkdir(exist_ok=True)
                path.write_text('{}')
            first = root / 'first.zip'
            second = root / 'second.zip'
            package.package(dist, first)
            package.package(dist, second)
            self.assertEqual(first.read_bytes(), second.read_bytes())
            with zipfile.ZipFile(first) as archive:
                self.assertEqual(archive.namelist(), ['dist/assets/main.js', 'dist/index.html'])
                self.assertIn(b'/dashboard/', archive.read('dist/index.html'))
            self.assertTrue(first.with_suffix('.zip.sha256').read_text().endswith('  first.zip\n'))

    def test_empty_index_and_symlinks_are_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            dist = root / 'build'
            dist.mkdir()
            (dist / 'index.html').touch()
            with self.assertRaises(AssertionError):
                package.package(dist, root / 'empty.zip')
            (dist / 'index.html').write_text('index')
            (dist / 'link').symlink_to(dist / 'index.html')
            with self.assertRaises(AssertionError):
                package.package(dist, root / 'linked.zip')

    def test_invalid_archives_are_rejected(self):
        for name in ['kumo-dist/index.html', 'dist/../index.html', 'dist/a.map', 'dist/.vite/a', 'dist/size-report.json']:
            with self.subTest(name=name), tempfile.TemporaryDirectory() as directory:
                path = Path(directory) / 'bad.zip'
                with zipfile.ZipFile(path, 'w') as archive:
                    archive.writestr('dist/index.html', 'index')
                    archive.writestr(name, 'invalid')
                with self.assertRaises(AssertionError):
                    package.validate_archive(path)

    def test_limits_are_enforced(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'large.zip'
            with zipfile.ZipFile(path, 'w') as archive:
                archive.writestr('dist/index.html', 'index')
            for limit in ['MAX_ARCHIVE', 'MAX_EXTRACTED', 'MAX_ENTRIES']:
                original = getattr(package, limit)
                try:
                    setattr(package, limit, 0)
                    with self.assertRaises(AssertionError):
                        package.validate_archive(path)
                finally:
                    setattr(package, limit, original)


if __name__ == '__main__':
    unittest.main()
