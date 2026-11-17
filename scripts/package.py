"""Build deterministic Nezha distributions using only the Python standard library."""
import argparse
import hashlib
from pathlib import Path, PurePosixPath
import stat
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[1]
MAX_ARCHIVE = 64 * 1024 * 1024
MAX_EXTRACTED = 256 * 1024 * 1024
MAX_ENTRIES = 10_000
ASSETS = {'frontend': 'dist.zip', 'admin': 'nezha-kumo-admin-dist.zip'}


def excluded(path):
    return path.suffix == '.map' or '.vite' in path.parts or path.name == 'size-report.json'


def validate_archive(path):
    assert path.stat().st_size <= MAX_ARCHIVE, 'ZIP exceeds 64 MiB'
    with zipfile.ZipFile(path) as archive:
        entries = archive.infolist()
        assert len(entries) <= MAX_ENTRIES, 'ZIP exceeds 10,000 entries'
        assert sum(entry.file_size for entry in entries) <= MAX_EXTRACTED, 'ZIP expands beyond 256 MiB'
        seen = set()
        for entry in entries:
            name = entry.filename.rstrip('/')
            parts = PurePosixPath(name)
            assert name == str(parts) and parts.parts[0] == 'dist', 'Expected dist/ layout'
            assert '..' not in parts.parts and not any(c in name for c in '\\:'), 'Unsafe ZIP path'
            assert name not in seen, 'Duplicate ZIP path'
            seen.add(name)
            mode = entry.external_attr >> 16
            assert stat.S_ISREG(mode) or stat.S_ISDIR(mode), 'Links and special files are forbidden'
            assert not excluded(parts), 'Build metadata or source maps in ZIP'
        assert archive.getinfo('dist/index.html').file_size > 0, 'Empty index.html'
        assert archive.testzip() is None, 'ZIP integrity check failed'
    return len(entries)


def package(dist, output):
    assert dist.is_dir() and not dist.is_symlink(), 'Run pnpm build first'
    files = []
    for path in sorted(dist.rglob('*')):
        assert not path.is_symlink(), f'Symbolic link in build: {path.name}'
        assert path.is_file() or path.is_dir(), f'Special file in build: {path.name}'
        if path.is_file() and not excluded(path.relative_to(dist)):
            files.append(path)
    assert (dist / 'index.html').is_file() and (dist / 'index.html').stat().st_size, 'Missing or empty index.html'
    assert len(files) <= MAX_ENTRIES, 'Too many files'
    assert sum(path.stat().st_size for path in files) <= MAX_EXTRACTED, 'Build exceeds 256 MiB'
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=output.parent) as staging:
        archive_path = Path(staging) / output.name
        with zipfile.ZipFile(archive_path, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
            for path in files:
                entry = zipfile.ZipInfo('dist/' + path.relative_to(dist).as_posix(), (1980, 1, 1, 0, 0, 0))
                entry.create_system = 3
                entry.external_attr = (stat.S_IFREG | 0o644) << 16
                entry.compress_type = zipfile.ZIP_DEFLATED
                archive.writestr(entry, path.read_bytes(), compresslevel=9)
        count = validate_archive(archive_path)
        digest = hashlib.sha256(archive_path.read_bytes()).hexdigest()
        archive_path.replace(output)
    output.with_suffix('.zip.sha256').write_text(f'{digest}  {output.name}\n')
    print(f'{output.name}: {output.stat().st_size} bytes, {count} entries, sha256 {digest}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('apps', nargs='*', choices=list(ASSETS))
    args = parser.parse_args()
    for app in args.apps or ASSETS:
        package(ROOT / 'apps' / app / 'dist', ROOT / 'release' / ASSETS[app])
