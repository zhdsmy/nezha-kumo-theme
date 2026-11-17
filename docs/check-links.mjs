#!/usr/bin/env node
/**
 * Verify all relative links, image paths, and heading anchors across repository Markdown files.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "dist-ssr",
  "release",
  "test-results",
  "playwright-report",
]);

function collectMarkdownFiles(dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) collectMarkdownFiles(full, acc);
    else if (entry.isFile() && entry.name.endsWith(".md")) acc.push(full);
  }
  return acc.sort();
}

function stripCode(markdown) {
  return markdown
    .replace(/^(?:```|~~~)[\s\S]*?^(?:```|~~~)/gm, "")
    .replace(/`[^`\n]+`/g, "");
}

function slugifyHeading(raw) {
  const clean = raw
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/`/g, "")
    .trim()
    .toLowerCase();
  return clean.replace(/[^\p{L}\p{N}\s_-]/gu, "").replace(/\s+/g, "-");
}

function extractHeadings(markdown) {
  const slugs = new Set();
  const counts = new Map();
  const stripped = markdown.replace(/^(?:```|~~~)[\s\S]*?^(?:```|~~~)/gm, "");
  for (const match of stripped.matchAll(/^#{1,6}\s+(.+?)\s*#*\s*$/gm)) {
    const base = slugifyHeading(match[1]);
    if (!base) continue;
    const seen = counts.get(base) ?? 0;
    counts.set(base, seen + 1);
    slugs.add(seen === 0 ? base : `${base}-${seen}`);
  }
  for (const match of stripped.matchAll(/\bid=["']([^"']+)["']/g)) {
    slugs.add(match[1]);
  }
  return slugs;
}

function extractTargets(markdown) {
  const clean = stripCode(markdown);
  const targets = [];

  // Inline [label](url "optional title") and ![alt](url)
  for (const m of clean.matchAll(/!?\[[^\]]*\]\(([^)\n]+)\)/g)) {
    const inner = m[1].trim();
    const target = inner.startsWith("<")
      ? inner.slice(1, inner.indexOf(">"))
      : inner.split(/\s+/)[0];
    if (target) targets.push(target);
  }

  // Reference-style [id]: url
  for (const m of clean.matchAll(/^\[[^\]]+\]:\s*(\S+)/gm)) {
    targets.push(m[1].trim());
  }

  // HTML <img src="...">, <source srcset="...">, <a href="...">
  for (const m of clean.matchAll(/\b(?:src|href|srcset)=["']([^"']+)["']/g)) {
    const first = m[1].split(",")[0].trim().split(/\s+/)[0];
    if (first) targets.push(first);
  }

  return targets;
}

const EXTERNAL_RE = /^(?:https?:|mailto:|tel:|data:|javascript:)/i;

const mdFiles = collectMarkdownFiles(rootDir);
const headingCache = new Map();
const getHeadings = (file) => {
  if (!headingCache.has(file)) {
    headingCache.set(file, extractHeadings(readFileSync(file, "utf8")));
  }
  return headingCache.get(file);
};

let checked = 0;
const errors = [];

for (const mdFile of mdFiles) {
  const content = readFileSync(mdFile, "utf8");
  const relSource = relative(rootDir, mdFile);
  for (const rawTarget of extractTargets(content)) {
    if (EXTERNAL_RE.test(rawTarget)) continue;
    checked++;

    if (rawTarget.startsWith("#")) {
      const anchor = decodeURIComponent(rawTarget.slice(1)).toLowerCase();
      if (anchor && !getHeadings(mdFile).has(anchor)) {
        errors.push(`${relSource}: missing same-file anchor ${rawTarget}`);
      }
      continue;
    }

    const [pathPart, hashPart] = rawTarget.split("#");
    const decodedPath = decodeURIComponent(pathPart);
    const resolved = decodedPath.startsWith("/")
      ? join(rootDir, decodedPath)
      : resolve(dirname(mdFile), decodedPath);

    if (!existsSync(resolved)) {
      errors.push(`${relSource}: target does not exist -> ${rawTarget}`);
      continue;
    }

    const st = statSync(resolved);
    const targetFile = st.isDirectory()
      ? join(resolved, "README.md")
      : resolved;
    if (!existsSync(targetFile)) {
      errors.push(
        `${relSource}: directory target lacks README.md -> ${rawTarget}`,
      );
      continue;
    }
    if (statSync(targetFile).size === 0) {
      errors.push(`${relSource}: target file is empty -> ${rawTarget}`);
      continue;
    }

    if (hashPart && extname(targetFile) === ".md") {
      const anchor = decodeURIComponent(hashPart).toLowerCase();
      if (anchor && !getHeadings(targetFile).has(anchor)) {
        errors.push(
          `${relSource}: missing anchor #${hashPart} in ${relative(rootDir, targetFile)}`,
        );
      }
    }
  }
}

if (errors.length > 0) {
  console.error("Broken links or image paths found:");
  for (const err of errors) console.error(`  - ${err}`);
  process.exit(1);
}

console.log(
  `Checked ${checked} relative links/images across ${mdFiles.length} Markdown files: 0 broken.`,
);
