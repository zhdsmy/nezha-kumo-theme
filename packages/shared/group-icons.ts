export const GROUP_ICONS_SCRIPT_ID = "nezha-kumo-group-icons";

export type GroupIcons = Record<string, string>;

export type ParsedGroupIcon =
  { kind: "text"; value: string } | { kind: "image"; value: string };

const SCRIPT_BLOCK_RE =
  /<script\b[^>]*\bid=(?:"nezha-kumo-group-icons"|'nezha-kumo-group-icons')[^>]*>([\s\S]*?)<\/script>/i;

const URI_SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;

// One grapheme: the sidebar slot is 16px wide, so longer text does not fit.
export const MAX_GROUP_ICON_CHARS = 1;

const segmenter =
  typeof Intl !== "undefined" && typeof Intl.Segmenter === "function"
    ? new Intl.Segmenter()
    : null;

function countGraphemes(text: string): number {
  if (segmenter) {
    let count = 0;
    for (const _ of segmenter.segment(text)) count++;
    return count;
  }
  return Array.from(text).length;
}

export function classifyGroupIcon(raw: string): ParsedGroupIcon | null {
  const value = raw.trim();
  if (!value) return null;
  if (value.startsWith("//") || URI_SCHEME_RE.test(value)) {
    if (/\s/.test(value)) return null;
    try {
      const url = new URL(value);
      if (url.protocol !== "https:" || !url.hostname) return null;
      return { kind: "image", value };
    } catch {
      return null;
    }
  }
  if (countGraphemes(value) > MAX_GROUP_ICON_CHARS) return null;
  return { kind: "text", value };
}

export function normalizeGroupIcons(icons: GroupIcons): GroupIcons {
  const clean: GroupIcons = {};
  const keys = Object.keys(icons).sort(
    (a, b) => Number(a) - Number(b) || a.localeCompare(b),
  );
  for (const rawKey of keys) {
    const key = rawKey.trim();
    if (!key) continue;
    const rawVal = icons[rawKey];
    if (typeof rawVal !== "string") continue;
    const parsed = classifyGroupIcon(rawVal);
    if (parsed) clean[key] = parsed.value;
  }
  return clean;
}

export function sameGroupIcons(a: GroupIcons, b: GroupIcons): boolean {
  const left = normalizeGroupIcons(a);
  const right = normalizeGroupIcons(b);
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every((key) => left[key] === right[key])
  );
}

export function parseGroupIcons(
  customCode: string | null | undefined,
): GroupIcons {
  if (!customCode) return {};
  const match = SCRIPT_BLOCK_RE.exec(customCode);
  if (!match) return {};
  try {
    const parsed: unknown = JSON.parse(match[1]);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
      return {};
    return normalizeGroupIcons(parsed as Record<string, string>);
  } catch {
    return {};
  }
}

export function serializeGroupIconsBlock(icons: GroupIcons): string {
  const clean = normalizeGroupIcons(icons);
  if (Object.keys(clean).length === 0) return "";
  const json = JSON.stringify(clean).replace(/<\//g, "<\\/");
  return `<script type="application/json" id="${GROUP_ICONS_SCRIPT_ID}">${json}</script>`;
}

export function updateGroupIconsInCustomCode(
  customCode: string | null | undefined,
  icons: GroupIcons,
): string {
  const source = customCode ?? "";
  const nextIcons = normalizeGroupIcons(icons);
  const match = SCRIPT_BLOCK_RE.exec(source);
  if (
    match &&
    Object.keys(nextIcons).length > 0 &&
    sameGroupIcons(parseGroupIcons(source), nextIcons)
  ) {
    return source;
  }
  const block = serializeGroupIconsBlock(nextIcons);
  if (match) {
    const before = source.slice(0, match.index);
    const after = source.slice(match.index + match[0].length);
    if (block) {
      return before + block + after;
    }
    if (!before && !after) return "";
    if (!after) {
      return before.endsWith("\r\n")
        ? before.slice(0, -2)
        : before.endsWith("\n")
          ? before.slice(0, -1)
          : before;
    }
    if (!before) {
      return after.startsWith("\r\n")
        ? after.slice(2)
        : after.startsWith("\n")
          ? after.slice(1)
          : after;
    }
    if (
      (before.endsWith("\n") || before.endsWith("\r\n")) &&
      after.startsWith("\r\n")
    ) {
      return before + after.slice(2);
    }
    if (
      (before.endsWith("\n") || before.endsWith("\r\n")) &&
      after.startsWith("\n")
    ) {
      return before + after.slice(1);
    }
    return before + after;
  }
  if (!block) return source;
  if (!source) return block;
  return source.endsWith("\n") ? source + block : `${source}\n${block}`;
}
