#!/usr/bin/env node
/**
 * Generate release screenshots in docs/screenshots/ using mocked Nezha APIs.
 * Set NKT_DOCS_LANG to en, zh-CN, zh-TW, zh-HK, or ja. English is the default.
 * Ports used: 5381 (frontend Vite dev server), 5382 (admin Vite preview server).
 */
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "../apps/frontend/node_modules/@playwright/test/index.mjs";
import { mockNezha } from "../apps/frontend/tests/mock.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const feDir = join(rootDir, "apps/frontend");
const adminDir = join(rootDir, "apps/admin");
const language = process.env.NKT_DOCS_LANG ?? "en";
const LANGUAGE_CONFIGS = {
  en: {
    locale: "en-US",
    timezoneId: "UTC",
    directory: "",
    adminEditLabel: "Edit",
    groups: ["Edge", "Compute", "Storage", "Relay"],
  },
  "zh-CN": {
    locale: "zh-CN",
    timezoneId: "Asia/Shanghai",
    directory: "zh-CN",
    adminEditLabel: "编辑",
    groups: ["边缘", "计算", "存储", "中继"],
  },
  "zh-TW": {
    locale: "zh-TW",
    timezoneId: "Asia/Taipei",
    directory: "zh-TW",
    adminEditLabel: "編輯",
    groups: ["邊緣", "運算", "儲存", "中繼"],
  },
  "zh-HK": {
    locale: "zh-HK",
    timezoneId: "Asia/Hong_Kong",
    directory: "zh-HK",
    adminEditLabel: "編輯",
    groups: ["邊緣", "運算", "儲存", "中繼"],
  },
  ja: {
    locale: "ja-JP",
    timezoneId: "Asia/Tokyo",
    directory: "ja",
    adminEditLabel: "編集",
    groups: ["エッジ", "コンピュート", "ストレージ", "リレー"],
  },
};
const languageConfig = LANGUAGE_CONFIGS[language];
if (!languageConfig) {
  throw new Error("NKT_DOCS_LANG must be en, zh-CN, zh-TW, zh-HK, or ja");
}
const browserLocale = {
  locale: languageConfig.locale,
  timezoneId: languageConfig.timezoneId,
};
const outDir = join(__dirname, "screenshots", languageConfig.directory);
const tmpDir = join(outDir, ".tmp-png");

const FE_PORT = Number(process.env.NKT_DOCS_FE_PORT) || 5381;
const ADMIN_PORT = Number(process.env.NKT_DOCS_ADMIN_PORT) || 5382;
const MAX_BYTES = 200 * 1024;

const groupResponse = (serverIds) => ({
  success: true,
  data: languageConfig.groups.map((name, index) => ({
    group: { id: index + 1, name },
    servers: serverIds[index],
  })),
});

const SYNTHETIC_GROUPS = groupResponse([
  [6, 25, 29, 32],
  [4, 8, 9, 23],
  [19, 27, 31],
  [35, 38, 40, 42, 44],
]);

const ADMIN_GROUPS = groupResponse([
  [1, 2],
  [3, 4],
  [5],
  [6],
]);

const CUSTOM_GROUP_ICONS =
  '<script type="application/json" id="nezha-kumo-group-icons">{"1":"vps:aws","2":"vps:azure","3":"🗄️","4":"🛡️"}</script>';

const ADMIN_SERVERS = [
  {
    id: 1,
    name: "edge-tyo-01",
    uuid: "00000000-0000-4000-8000-000000000101",
    display_index: 100,
    hide_for_guest: false,
    enable_ddns: true,
    note: "",
    public_note: JSON.stringify({
      billingDataMod: {
        startDate: "2026-05-01T00:00:00+09:00",
        endDate: "2027-05-01T00:00:00+09:00",
        autoRenewal: "1",
        cycle: "Year",
        amount: "USD 48.00",
      },
      planDataMod: {
        bandwidth: "1Gbps",
        trafficVol: "2TB/Month",
        trafficType: "2",
        IPv4: "1",
        IPv6: "1",
        networkRoute: "IIJ,BBTEC",
        extra: "NVMe,Anycast",
      },
    }),
    host: {
      platform: "debian",
      platform_version: "12",
      arch: "x86_64",
      version: "1.14.2",
    },
    geoip: {
      country_code: "jp",
      ip: { ipv4_addr: "198.51.100.x", ipv6_addr: "2001:db8:10::1" },
    },
    owner: { id: 1, username: "demo-admin" },
  },
  {
    id: 2,
    name: "edge-sin-01",
    uuid: "00000000-0000-4000-8000-000000000102",
    display_index: 95,
    hide_for_guest: false,
    enable_ddns: false,
    note: "",
    public_note: JSON.stringify({
      billingDataMod: {
        endDate: "2027-02-15T00:00:00+08:00",
        autoRenewal: "1",
        cycle: "Quarter",
        amount: "USD 18.00",
      },
      planDataMod: {
        bandwidth: "1Gbps",
        trafficVol: "1TB/Month",
        trafficType: "1",
        IPv4: "1",
        IPv6: "1",
        networkRoute: "PCCW,NTT",
      },
    }),
    host: {
      platform: "ubuntu",
      platform_version: "24.04",
      arch: "aarch64",
      version: "1.14.2",
    },
    geoip: {
      country_code: "sg",
      ip: { ipv4_addr: "198.51.100.x", ipv6_addr: "2001:db8:20::1" },
    },
    owner: { id: 1, username: "demo-admin" },
  },
  {
    id: 3,
    name: "compute-fra-01",
    uuid: "00000000-0000-4000-8000-000000000103",
    display_index: 90,
    hide_for_guest: false,
    enable_ddns: true,
    note: "",
    public_note: JSON.stringify({
      billingDataMod: {
        endDate: "2026-12-01T00:00:00+01:00",
        autoRenewal: "1",
        cycle: "Month",
        amount: "EUR 9.50",
      },
      planDataMod: {
        bandwidth: "10Gbps",
        trafficVol: "20TB/Month",
        trafficType: "1",
        IPv4: "1",
        IPv6: "1",
        networkRoute: "DE-CIX",
      },
    }),
    host: {
      platform: "debian",
      platform_version: "12",
      arch: "x86_64",
      version: "1.14.2",
    },
    geoip: {
      country_code: "de",
      ip: { ipv4_addr: "203.0.113.x", ipv6_addr: "2001:db8:30::1" },
    },
    owner: { id: 1, username: "demo-admin" },
  },
  {
    id: 4,
    name: "compute-sjc-01",
    uuid: "00000000-0000-4000-8000-000000000104",
    display_index: 85,
    hide_for_guest: false,
    enable_ddns: false,
    note: "",
    public_note: JSON.stringify({
      billingDataMod: {
        endDate: "2027-08-01T00:00:00-07:00",
        autoRenewal: "1",
        cycle: "Year",
        amount: "USD 36.00",
      },
      planDataMod: {
        bandwidth: "2.5Gbps",
        trafficVol: "4TB/Month",
        trafficType: "3",
        IPv4: "1",
        IPv6: "1",
        networkRoute: "Telia,Cogent",
      },
    }),
    host: {
      platform: "Rocky",
      platform_version: "9",
      arch: "x86_64",
      version: "1.14.2",
    },
    geoip: {
      country_code: "us",
      ip: { ipv4_addr: "203.0.113.x", ipv6_addr: "2001:db8:40::1" },
    },
    owner: { id: 1, username: "demo-admin" },
  },
  {
    id: 5,
    name: "storage-ams-01",
    uuid: "00000000-0000-4000-8000-000000000105",
    display_index: 80,
    hide_for_guest: true,
    enable_ddns: false,
    note: "Backup vault",
    public_note: JSON.stringify({
      billingDataMod: {
        endDate: "2027-01-15T00:00:00+01:00",
        autoRenewal: "1",
        cycle: "Month",
        amount: "EUR 14.00",
      },
      planDataMod: {
        bandwidth: "1Gbps",
        trafficVol: "Unlimited",
        trafficType: "2",
        IPv4: "1",
        IPv6: "1",
        extra: "ZFS mirror",
      },
    }),
    host: {
      platform: "freebsd",
      platform_version: "14.1",
      arch: "x86_64",
      version: "1.14.1",
    },
    geoip: {
      country_code: "nl",
      ip: { ipv4_addr: "198.51.100.x", ipv6_addr: "2001:db8:50::1" },
    },
    owner: { id: 0 },
  },
  {
    id: 6,
    name: "relay-lon-01",
    uuid: "00000000-0000-4000-8000-000000000106",
    display_index: 75,
    hide_for_guest: false,
    enable_ddns: false,
    note: "",
    public_note: JSON.stringify({
      billingDataMod: {
        endDate: "0000-00-00T23:59:59+08:00",
        autoRenewal: "0",
        amount: "0",
      },
      planDataMod: {
        bandwidth: "500Mbps",
        trafficVol: "500GB/Month",
        trafficType: "2",
        IPv4: "1",
        IPv6: "1",
        networkRoute: "LINX",
      },
    }),
    host: {
      platform: "alpine",
      platform_version: "3.20",
      arch: "aarch64",
      version: "1.14.2",
    },
    geoip: {
      country_code: "gb",
      ip: { ipv4_addr: "203.0.113.x", ipv6_addr: "2001:db8:60::1" },
    },
    owner: { id: 1, username: "demo-admin" },
  },
];

async function waitForHttp(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status < 500) return;
    } catch {
      // Server still starting.
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function startServer(cmd, args, cwd) {
  const child = spawn(cmd, args, {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, CI: "1" },
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });
  return {
    child,
    stop() {
      if (!child.killed) child.kill("SIGTERM");
    },
    stderr: () => stderr,
  };
}

function toWebp(pngPath, webpPath) {
  for (const quality of [82, 74, 66, 56, 46]) {
    execFileSync("cwebp", [
      "-quiet",
      "-q",
      String(quality),
      pngPath,
      "-o",
      webpPath,
    ]);
    const size = statSync(webpPath).size;
    if (size <= MAX_BYTES) return { size, quality };
  }
  throw new Error(`${webpPath} exceeds ${MAX_BYTES} bytes even at q=46`);
}

async function setupFrontendMock(page) {
  await mockNezha(page, {
    allOnline: false,
    stableNode: true,
    price: "USD 12.00",
    customCode: CUSTOM_GROUP_ICONS,
  });
  await page.route("**/api/v1/server-group", (route) =>
    route.fulfill({ json: SYNTHETIC_GROUPS }),
  );
}

async function setupAdminMock(page) {
  await page.route("**/flags/*.svg", (route) => {
    const code = new URL(route.request().url()).pathname.split("/").pop();
    const svgPath = join(feDir, "public/flags", code ?? "");
    if (code && existsSync(svgPath)) {
      return route.fulfill({
        status: 200,
        contentType: "image/svg+xml",
        body: readFileSync(svgPath),
      });
    }
    return route.fulfill({ status: 404 });
  });
  await page.route("**/api/v1/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith("/profile")) {
      return route.fulfill({
        json: {
          success: true,
          data: { id: 1, username: "demo-admin", role: 0 },
        },
      });
    }
    if (pathname.endsWith("/setting")) {
      return route.fulfill({
        json: {
          success: true,
          data: {
            config: {
              site_name: "Infrastructure",
              language,
              install_host: "status.example.invalid:8008",
              tls: true,
              user_template: "user-dist",
              admin_template: "admin-dist",
              oauth2_providers: ["GitHub"],
              custom_code: CUSTOM_GROUP_ICONS,
              custom_code_dashboard: "",
            },
            version: "2.6.1",
          },
        },
      });
    }
    if (pathname.endsWith("/server-group")) {
      return route.fulfill({ json: ADMIN_GROUPS });
    }
    if (pathname.endsWith("/server")) {
      return route.fulfill({ json: { success: true, data: ADMIN_SERVERS } });
    }
    return route.fulfill({ json: { success: true, data: [] } });
  });
}

async function waitForGroupIcons(page) {
  await page.waitForFunction(() =>
    [...document.querySelectorAll("img.group-icon-img")].every((image) => image.complete),
  );
}

async function captureFrontend(browser, feUrl) {
  const shots = [
    {
      name: "home-desktop-light",
      viewport: { width: 1440, height: 900 },
      colorScheme: "light",
      path: "/",
      waitSelector: "[data-server]",
    },
    {
      name: "home-desktop-dark",
      viewport: { width: 1440, height: 900 },
      colorScheme: "dark",
      path: "/",
      waitSelector: "[data-server]",
    },
    {
      name: "home-mobile-light",
      viewport: { width: 390, height: 844 },
      colorScheme: "light",
      path: "/",
      waitSelector: "[data-server]",
    },
    {
      name: "home-mobile-dark",
      viewport: { width: 390, height: 844 },
      colorScheme: "dark",
      path: "/",
      waitSelector: "[data-server]",
    },
    {
      name: "node-detail",
      viewport: { width: 1440, height: 900 },
      colorScheme: "light",
      path: "/server/29",
      // The peak speed appears after the daily metrics finish loading.
      waitSelector: '[data-panel="network"] dd[title^="↑"]',
    },
  ];

  const results = [];
  for (const shot of shots) {
    const context = await browser.newContext({
      viewport: shot.viewport,
      deviceScaleFactor: 2,
      colorScheme: shot.colorScheme,
      ...browserLocale,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    await page.addInitScript(
      ({ mode, language }) => {
        localStorage.setItem("nkt:appearance", mode);
        localStorage.setItem("nkt:language", language);
        localStorage.setItem("nkt:sidebar-collapsed", "false");
      },
      { mode: shot.colorScheme, language },
    );
    await setupFrontendMock(page);
    await page.goto(`${feUrl}${shot.path}`, { waitUntil: "networkidle" });
    await page.locator(shot.waitSelector).first().waitFor({ state: "visible" });
    await page.locator(`html[lang="${language}"]`).waitFor();
    await page.evaluate(() => document.fonts.ready);
    await waitForGroupIcons(page);
    await page.waitForTimeout(300);
    const pngPath = join(tmpDir, `${shot.name}.png`);
    const webpPath = join(outDir, `${shot.name}.webp`);
    await page.screenshot({ path: pngPath });
    const { size, quality } = toWebp(pngPath, webpPath);
    results.push({ name: `${shot.name}.webp`, size, quality });
    await context.close();
  }
  return results;
}

async function captureAdmin(browser, adminUrl) {
  const results = [];

  // 1. Admin server list
  {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
      colorScheme: "light",
      ...browserLocale,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    await page.addInitScript((language) => {
      localStorage.setItem("language", language);
      localStorage.setItem("nkt:theme", "light");
      localStorage.setItem("vite-ui-theme", "light");
      localStorage.setItem("nkt:sidebar-collapsed", "false");
    }, language);
    await setupAdminMock(page);
    await page.goto(`${adminUrl}/dashboard/`, { waitUntil: "networkidle" });
    await page.locator("table tbody tr").nth(4).waitFor({ state: "visible" });
    await page.locator(`html[lang="${language}"]`).waitFor();
    await page.evaluate(() => document.fonts.ready);
    await waitForGroupIcons(page);
    await page.waitForTimeout(300);
    const pngPath = join(tmpDir, "admin-servers.png");
    const webpPath = join(outDir, "admin-servers.webp");
    await page.screenshot({ path: pngPath });
    const { size, quality } = toWebp(pngPath, webpPath);
    results.push({ name: "admin-servers.webp", size, quality });

    // 2. Public note editor (open Edit dialog on row 1 and scroll to public note editor)
    await page
      .getByRole("button", {
        name: languageConfig.adminEditLabel,
        exact: true,
      })
      .first()
      .click();
    const editor = page.locator("[data-public-note-editor]");
    await editor.waitFor({ state: "visible" });
    await editor.scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);
    const notePng = join(tmpDir, "admin-public-note.png");
    const noteWebp = join(outDir, "admin-public-note.webp");
    await page.screenshot({ path: notePng });
    const noteInfo = toWebp(notePng, noteWebp);
    results.push({
      name: "admin-public-note.webp",
      size: noteInfo.size,
      quality: noteInfo.quality,
    });

    await context.close();
  }

  return results;
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  mkdirSync(tmpDir, { recursive: true });

  console.log("Building admin frontend for vite preview...");
  execFileSync("pnpm", ["--filter", "nezha-kumo-admin", "build"], {
    cwd: rootDir,
    stdio: "inherit",
  });

  const feServer = startServer(
    "pnpm",
    [
      "--filter",
      "frontend",
      "exec",
      "vite",
      "--host",
      "127.0.0.1",
      "--port",
      String(FE_PORT),
      "--strictPort",
    ],
    rootDir,
  );
  const adminServer = startServer(
    "pnpm",
    [
      "--filter",
      "nezha-kumo-admin",
      "exec",
      "vite",
      "preview",
      "--host",
      "127.0.0.1",
      "--port",
      String(ADMIN_PORT),
      "--strictPort",
    ],
    rootDir,
  );

  let browser;
  try {
    const feUrl = `http://127.0.0.1:${FE_PORT}`;
    const adminUrl = `http://127.0.0.1:${ADMIN_PORT}`;
    await Promise.all([
      waitForHttp(feUrl),
      waitForHttp(`${adminUrl}/dashboard/`),
    ]);

    browser = await chromium.launch();
    const feResults = await captureFrontend(browser, feUrl);
    const adminResults = await captureAdmin(browser, adminUrl);
    for (const item of [...feResults, ...adminResults]) {
      console.log(
        `${item.name}\t${(item.size / 1024).toFixed(1)} KB (q=${item.quality})`,
      );
    }
  } finally {
    await browser?.close();
    feServer.stop();
    adminServer.stop();
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
