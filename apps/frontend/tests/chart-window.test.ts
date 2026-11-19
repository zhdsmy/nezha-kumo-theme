// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

import { LoadCharts, PingChart } from "../src/components/NodeCharts"
import { Spark } from "../src/components/ui"
import type { NodeInfo, PingData } from "../src/core/model"
import { emptySnapshot } from "./snapshot"

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key, i18n: { language: "en" } }),
}))

const end = Date.UTC(2026, 10, 19, 4)
const start = end - 900_000
let el: HTMLDivElement
let root: ReturnType<typeof createRoot>

beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
    vi.stubGlobal(
        "ResizeObserver",
        class {
            observe() {}
            disconnect() {}
        },
    )
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(300)
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null)
    el = document.createElement("div")
    document.body.append(el)
    root = createRoot(el)
})
afterEach(() => {
    act(() => root.unmount())
    el.remove()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

const ping = (data: PingData, hours = 0.25) =>
    createElement(PingChart, {
        data,
        hours,
        height: 150,
        shave: false,
        onShaveChange: () => {},
    })
const task = (id: number) => ({ id, name: "route " + id, avg: 10, min: 10, max: 10 })

it("excludes the predecessor from the scale and empty state but draws it to the left edge", () => {
    const samples = [start - 10_000, ...Array.from({ length: 451 }, (_, i) => start + i * 2000)]
    const load = (cpu: number) =>
        createElement(LoadCharts, {
            node: {} as NodeInfo,
            hours: 0.25,
            memTotal: 0,
            diskTotal: 0,
            height: 150,
            points: samples.map((at, i) => ({ ...emptySnapshot(true), at, cpu: i ? cpu : 9000 })),
        })
    act(() => root.render(load(10)))
    const chart = el.querySelector(".chart")!
    const ticks = [...chart.querySelectorAll("svg > g:first-of-type text")].map((t) =>
        parseFloat(t.textContent!),
    )
    expect(Math.max(...ticks)).toBe(100)
    const path = chart.querySelector('path[fill="none"]')!.getAttribute("d")!
    expect(Number(/^M([^,]+)/.exec(path)![1])).toBeLessThan(
        Number(chart.querySelector("g line")!.getAttribute("x1")),
    )
    act(() => root.render(load(NaN)))
    expect(chart.querySelector(".chart-empty")).toBeTruthy()
})

it("keeps failed probe times hoverable and clears the tooltip for an empty route", () => {
    const tasks = [task(1), task(2), task(3)]
    const points = [
        { at: start - 1, task: 3, value: 100 },
        { at: start + 60_000, task: 1, value: -1 },
        { at: end, task: 1, value: -1 },
        { at: end, task: 2, value: 5 },
    ]
    act(() => root.render(ping({ tasks, points })))
    const [failed, , empty] = el.querySelectorAll<HTMLButtonElement>(".node-ping-row")
    act(() => failed.click())
    const chart = el.querySelector(".chart")!
    expect(chart.querySelector(".chart-empty")).toBeNull()
    const svg = chart.querySelector("svg")!
    for (const [x, at] of [
        [80, start + 60_000],
        [290, end],
    ]) {
        act(() => svg.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientX: x })))
        const time = new Date(at).toLocaleTimeString("en", { hour12: false })
        expect(chart.querySelector(".chart-tooltip")?.textContent).toContain(time)
        expect(chart.querySelector(".chart-tooltip")?.textContent).toContain("—")
    }
    act(() => {
        empty.click()
        failed.click()
    })
    expect(chart.querySelector(".chart-empty")).toBeTruthy()
    expect(chart.querySelector(".chart-tooltip")).toBeNull()
})

it("renders 172800 raw latency points without exhausting the argument stack", () => {
    const tasks = Array.from({ length: 8 }, (_, i) => task(i))
    const points = Array.from({ length: 21600 }, (_, i) =>
        tasks.map(({ id }) => ({
            at: end - (21599 - i) * 120_000,
            task: id,
            value: 10,
        })),
    ).flat()
    expect(() => renderToStaticMarkup(ping({ tasks, points }, 720))).not.toThrow()
})

it("draws one measured spark bucket at its actual position, including zero", () => {
    const render = (values: (number | null)[]) =>
        renderToStaticMarkup(
            createElement(Spark, { buckets: values.map((value, at) => ({ at, value })) }),
        )
    expect(render([null, null, null])).toContain("chart-empty")
    expect(render([null, 0, null])).toMatch(/<circle[^>]*cx="150"[^>]*cy="45"/)
    expect(render([null, null, 42])).toMatch(/<circle[^>]*cx="300"[^>]*cy="8"/)
})
