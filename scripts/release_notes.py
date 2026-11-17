"""Extract one version's user-facing notes from CHANGELOG.md."""
from pathlib import Path
import re
import sys


def extract(changelog, tag):
    assert re.fullmatch(r'v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?', tag), 'Expected a version tag'
    section = re.search(r'^## \[' + re.escape(tag[1:]) + r'\][^\n]*\n(.*?)(?=^## |\Z)', changelog, re.M | re.S)
    assert section and section[1].strip(), f'Missing release notes for {tag}'
    return section[1].strip() + '\n'


if __name__ == '__main__':
    print(extract(Path('CHANGELOG.md').read_text(), sys.argv[1]), end='')
