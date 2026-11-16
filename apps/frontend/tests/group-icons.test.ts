import { afterEach, describe, expect, it, vi } from "vitest"

import {
    classifyGroupIcon,
    parseGroupIcons,
    serializeGroupIconsBlock,
    updateGroupIconsInCustomCode,
} from "../../../packages/shared/group-icons"
import { type NezhaGroup, mapGroupIcons } from "../src/adapters/nezha"

afterEach(() => {
    vi.unstubAllGlobals()
})

describe("group-icons shared format", () => {
    it("inserts and clears the script block when custom_code is empty", () => {
        const written = updateGroupIconsInCustomCode("", {
            "3": "☁️",
            "1": "https://example.com/tencent.svg",
        })
        expect(written).toBe(
            '<script type="application/json" id="nezha-kumo-group-icons">{"1":"https://example.com/tencent.svg","3":"☁️"}</script>',
        )
        expect(parseGroupIcons(written)).toEqual({
            "1": "https://example.com/tencent.svg",
            "3": "☁️",
        })
        expect(updateGroupIconsInCustomCode(written, {})).toBe("")
        expect(updateGroupIconsInCustomCode(undefined, {})).toBe("")
    })

    it("preserves existing custom_code byte-for-byte when originally without a block", () => {
        const original =
            '<script>window.CustomDesc = {"1": "keep   spaces\\t&\\r\\nlines"};</script>\r\n<style>.hero{color:#09f}</style>'
        expect(updateGroupIconsInCustomCode(original, {})).toBe(original)

        const withIcons = updateGroupIconsInCustomCode(original, { "2": "🔥" })
        expect(withIcons.startsWith(`${original}\n`)).toBe(true)
        expect(parseGroupIcons(withIcons)).toEqual({ "2": "🔥" })

        const cleared = updateGroupIconsInCustomCode(withIcons, {})
        expect(cleared).toBe(original)
    })

    it("replaces only the JSON block when a block already exists, including in the middle", () => {
        const prefix = '<script>window.CustomDesc = "before  \\t  bytes";</script>\r\n'
        const suffix = '\r\n<script>console.log("after $& $1 $$ bytes")</script>\n'
        const initial =
            prefix +
            '<script type="application/json" id="nezha-kumo-group-icons">{"1":"☁️"}</script>' +
            suffix

        // Unchanged logical icons return the exact same string without touching anything.
        expect(updateGroupIconsInCustomCode(initial, { "1": "☁️" })).toBe(initial)

        // Updating icons (even with JS replace special tokens like $1 / $$) preserves prefix & suffix byte-for-byte.
        const updated = updateGroupIconsInCustomCode(initial, {
            "1": "$",
            "8": "https://cdn.example.com/$1$$.png",
        })
        expect(updated.startsWith(prefix)).toBe(true)
        expect(updated.endsWith(suffix)).toBe(true)
        const middle = updated.slice(prefix.length, updated.length - suffix.length)
        expect(middle).toBe(
            '<script type="application/json" id="nezha-kumo-group-icons">{"1":"$","8":"https://cdn.example.com/$1$$.png"}</script>',
        )
        expect(parseGroupIcons(updated)).toEqual({
            "1": "$",
            "8": "https://cdn.example.com/$1$$.png",
        })

        // Removing all icons from the middle keeps both surrounding scripts intact.
        const removed = updateGroupIconsInCustomCode(updated, {})
        expect(removed).toBe(`${prefix}<script>console.log("after $& $1 $$ bytes")</script>\n`)
    })

    it("escapes </ on serialization so inner content cannot close </script> prematurely", () => {
        const trickyUrl = "https://example.com/icon.svg?tag=</script>&upper=</SCRIPT>"
        const trickyText = "<"
        const block = serializeGroupIconsBlock({
            "1": trickyUrl,
            "2": trickyText,
        })
        // Strip the outer <script ...> and </script> wrapper; inner JSON must not contain raw `</`.
        const inner = block.replace(/^<script[^>]*>/, "").replace(/<\/script>$/, "")
        expect(inner).not.toContain("</")
        expect(inner).toContain("<\\/script>")
        expect(inner).toContain("<\\/SCRIPT>")

        const wrapped = `<script>window.Before = 1</script>\n${block}\n<script>window.After = 2</script>`
        expect(parseGroupIcons(wrapped)).toEqual({
            "1": trickyUrl,
            "2": trickyText,
        })
    })

    it("accepts emoji/a single grapheme and https:// URLs while rejecting other protocols", () => {
        expect(classifyGroupIcon("☁️")).toEqual({ kind: "text", value: "☁️" })
        expect(classifyGroupIcon("🏳️‍🌈")).toEqual({ kind: "text", value: "🏳️‍🌈" })
        expect(classifyGroupIcon("A")).toEqual({ kind: "text", value: "A" })
        expect(classifyGroupIcon("US")).toBeNull()
        expect(classifyGroupIcon("   ")).toBeNull()

        expect(classifyGroupIcon("https://example.com/a.svg")).toEqual({
            kind: "image",
            value: "https://example.com/a.svg",
        })
        expect(classifyGroupIcon("http://example.com/a.svg")).toBeNull()
        expect(classifyGroupIcon("http://a")).toBeNull()
        expect(classifyGroupIcon("javascript:alert(1)")).toBeNull()
        expect(classifyGroupIcon("data:image/svg+xml,<svg/>")).toBeNull()
        expect(classifyGroupIcon("//example.com/a.svg")).toBeNull()
        expect(classifyGroupIcon("https://")).toBeNull()

        const mixed =
            '<script type="application/json" id="nezha-kumo-group-icons">{"1":"https://ok.example/a.png","2":"http://bad.example/b.png","3":"javascript:1","4":"☁️","5":"123456789"}</script>'
        expect(parseGroupIcons(mixed)).toEqual({
            "1": "https://ok.example/a.png",
            "4": "☁️",
        })
        expect(
            parseGroupIcons(
                '<script type="application/json" id="nezha-kumo-group-icons">{broken</script>',
            ),
        ).toEqual({})
    })
})

describe("nezha adapter groupIcons mapping", () => {
    it("maps group IDs to group names and ignores non-https icons", () => {
        const groups: NezhaGroup[] = [
            { group: { id: 1, name: "Tencent" }, servers: [6] },
            { group: { id: 2, name: "HomeLab" }, servers: [8] },
            { group: { id: 3, name: "Insecure" }, servers: [4] },
        ]
        const customCode =
            '<script type="application/json" id="nezha-kumo-group-icons">{"1":"https://example.com/tencent.svg","2":"🏠","3":"http://example.com/plain.png","99":"❓"}</script>'
        expect(mapGroupIcons(groups, customCode)).toEqual({
            Tencent: "https://example.com/tencent.svg",
            HomeLab: "🏠",
        })
    })

    it("reuses the single /api/v1/server-group and /api/v1/setting requests during startup", async () => {
        vi.resetModules()
        const calls: string[] = []
        vi.stubGlobal("window", {
            location: {
                origin: "https://status.example.test",
                protocol: "https:",
                host: "status.example.test",
            },
        })
        vi.stubGlobal(
            "fetch",
            vi.fn(async (input: string) => {
                calls.push(String(input))
                if (String(input).endsWith("/api/v1/setting")) {
                    return new Response(
                        JSON.stringify({
                            success: true,
                            data: {
                                config: {
                                    site_name: "Demo",
                                    custom_code:
                                        '<script type="application/json" id="nezha-kumo-group-icons">{"1":"☁️"}</script>',
                                },
                                tsdb_enabled: false,
                            },
                        }),
                    )
                }
                if (String(input).endsWith("/api/v1/server-group")) {
                    return new Response(
                        JSON.stringify({
                            success: true,
                            data: [{ group: { id: 1, name: "Cloud" }, servers: [1] }],
                        }),
                    )
                }
                return new Response(JSON.stringify({ success: true, data: [] }))
            }),
        )
        class FakeWebSocket {
            static OPEN = 1
            readyState = 1
            onopen: (() => void) | null = null
            onmessage: ((e: { data: string }) => void) | null = null
            onclose: (() => void) | null = null
            constructor() {
                setTimeout(() => {
                    this.onopen?.()
                    this.onmessage?.({
                        data: JSON.stringify({
                            now: Date.now(),
                            servers: [
                                {
                                    id: 1,
                                    name: "Node 1",
                                    last_active: new Date().toISOString(),
                                },
                            ],
                        }),
                    })
                }, 0)
            }
            send() {}
            close() {}
        }
        vi.stubGlobal("WebSocket", FakeWebSocket)

        const { nezha } = await import("../src/adapters/nezha")
        const [site, nodes] = await Promise.all([nezha.loadSite(false), nezha.loadNodes()])
        nezha.reset()
        expect(site.groupIcons).toEqual({ Cloud: "☁️" })
        expect(nodes[0]?.groups).toEqual(["Cloud"])
        expect(calls.filter((u) => u.endsWith("/api/v1/setting"))).toHaveLength(1)
        expect(calls.filter((u) => u.endsWith("/api/v1/server-group"))).toHaveLength(1)
    })
})
