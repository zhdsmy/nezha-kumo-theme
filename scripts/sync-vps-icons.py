"""Regenerate bundled v1.4.0 icons: python3 scripts/sync-vps-icons.py /path/to/vps-icons."""
import argparse
import io
import json
from pathlib import Path
import re
import subprocess
import tarfile

ROOT = Path(__file__).resolve().parents[1]
TAG = "v1.4.0"
COMMIT = "79c5441af8518eb7ae4646835333b5230a08085d"


def sync(repo):
    def git(*args):
        return subprocess.check_output(["git", "-C", repo, *args])

    if git("rev-parse", TAG + "^{commit}").decode().strip() != COMMIT:
        raise ValueError(f"{TAG} must point to {COMMIT}")
    archive = git("archive", COMMIT, "svg", "LICENSE", "index.json")
    target = ROOT / "packages/shared/vps-icons" / TAG
    with tarfile.open(fileobj=io.BytesIO(archive)) as tree:
        icons = json.load(tree.extractfile("index.json"))["icons"]
        catalog = []
        notices = []
        for icon in icons:
            slug = icon["slug"]
            if not re.fullmatch(r"[a-z0-9-]+", slug):
                raise ValueError(f"Invalid slug: {slug}")
            small = icon.get("small", {})
            compact = small.get("maxSize", 0) >= 16
            prefix = "svg/small" if compact else "svg"
            for mode in ("light", "dark"):
                dark = mode == "dark" and "color-dark" in icon["variants"]["svg"]
                variant = "color-dark" if dark else "color"
                destination = target / mode / (slug + ".svg")
                destination.parent.mkdir(parents=True, exist_ok=True)
                destination.write_bytes(tree.extractfile(f"{prefix}/{variant}/{slug}.svg").read())
            catalog.append({
                "slug": slug,
                "name": icon["name"],
                "names": icon.get("names", {}),
                "aliases": icon.get("aliases", []),
                "nicknames": icon.get("nicknames", []),
            })
            source = small.get("source", icon["source"]) if compact else icon["source"]
            notices.append(f"{icon['name']} | {icon['license']} | {source}")
        (target / "LICENSE.txt").write_bytes(tree.extractfile("LICENSE").read())
        (target / "SOURCES.txt").write_text("\n".join(notices) + "\n", encoding="utf-8")
    index = ROOT / "apps/admin/src/lib/vps-icons.json"
    index.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("repo", type=Path)
    sync(parser.parse_args().repo)
