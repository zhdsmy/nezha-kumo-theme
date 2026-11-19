// Adapted from zool-theme/src/components/Chart.tsx (MIT, luoleiorg).
import type { chartWindow } from "@/core/summary"
import {
    type PointerEvent,
    useEffect,
    useId,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react"

import { ChartEmpty } from "./ui"

interface ChartPoint {
    t: number
    v: number | null
}

export interface ChartSeries {
    key: string
    label: string
    /** A colour from the measured chart palette. */
    color: string
    points: ChartPoint[]
    area?: boolean
}

interface Props {
    series: ChartSeries[]
    format: (v: number) => string
    formatTick?: (v: number, step: number) => string
    scale?: ChartScale
    minStep?: number
    formatTime: (t: number, index: number, ticks: readonly number[]) => string
    formatTooltipTime?: (t: number) => string
    yMax?: number
    height?: number
    label?: string
    /** Scale the y axis to the 99th percentile so a few spikes don't flatten every line; spikes clip at the top. */
    robust?: boolean
    /** Key of a series to emphasise; the others fade. */
    focus?: string | null
    /** Fixed axis span ending at the newest point; older points are dropped. */
    timeWindow: ReturnType<typeof chartWindow>
    showFailedProbes?: boolean
}

export type ChartScale = "decimal" | "binary"

export interface YTickOptions {
    scale?: ChartScale
    yMax?: number
    minStep?: number
}

export interface YAxisScale {
    max: number
    step: number
    ticks: number[]
}

// Container widths, not viewport breakpoints: reserve space for 12px axis labels.
const COMPACT_AXES_WIDTH = 400
const FOUR_TIME_LABELS_WIDTH = 210

const PAD = { l: 44, r: 6, t: 10, b: 24 }
const MOBILE_PAD = { l: 40, r: 4, t: 6, b: 18 }

const DEC_MULTS = [1, 2, 5]
const DEC_COUNTS = [2, 3]
const BIN_MULTS = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512]
const BIN_COUNTS = [2, 3]
const MAX_BIN_UNIT = 6

export function stepDigits(step: number): number {
    if (!Number.isFinite(step) || step <= 0) return 0
    for (let d = 0; d < 6; d++) {
        const scaled = step * 10 ** d
        if (Math.abs(Math.round(scaled) - scaled) < 1e-6) return d
    }
    return 6
}

export function buildYTicks(dataMax: number, opts: YTickOptions = {}): YAxisScale {
    const safeData = Number.isFinite(dataMax) && dataMax > 0 ? dataMax : 0
    const safeCap = opts.yMax && Number.isFinite(opts.yMax) && opts.yMax > 0 ? opts.yMax : 0
    const target = Math.max(safeData, safeCap)

    if (opts.scale === "binary") {
        if (target <= 0) return { max: 2, step: 1, ticks: [0, 1, 2] }
        const u0 = Math.max(
            0,
            Math.min(MAX_BIN_UNIT, Math.floor(Math.log(target) / Math.log(1024)) - 1),
        )
        let best: { max: number; step: number; count: number } | null = null
        for (let u = u0; u <= MAX_BIN_UNIT; u++) {
            const unit = 1024 ** u
            for (const m of BIN_MULTS) {
                const step = m * unit
                for (const count of BIN_COUNTS) {
                    if (u < MAX_BIN_UNIT && count * m > 1024) continue
                    const max = count * step
                    if (max < target) continue
                    if (!best || max < best.max || (max === best.max && count < best.count)) {
                        best = { max, step, count }
                    }
                }
            }
            if (best) break
        }
        if (!best) {
            const step = 2 ** Math.ceil(Math.log2(target / 2))
            best = { max: step * 2, step, count: 2 }
        }
        const { max, step, count } = best
        return { max, step, ticks: Array.from({ length: count + 1 }, (_, i) => i * step) }
    }

    const minStep =
        opts.minStep && Number.isFinite(opts.minStep) && opts.minStep > 0 ? opts.minStep : 0
    if (target <= 0) {
        const step = Math.max(1, minStep)
        return { max: step * 2, step, ticks: [0, step, step * 2] }
    }
    const expStart = Math.max(
        Math.floor(Math.log10(target)) - 1,
        minStep > 0 ? Math.floor(Math.log10(minStep)) - 1 : -Infinity,
    )
    let best: { max: number; step: number; count: number } | null = null
    for (let exp = expStart; exp <= expStart + 4; exp++) {
        const base = 10 ** exp
        for (const m of DEC_MULTS) {
            const step = Number((m * base).toPrecision(12))
            if (step < minStep) continue
            for (const count of DEC_COUNTS) {
                const max = Number((count * step).toPrecision(12))
                if (max < target) continue
                if (!best || max < best.max || (max === best.max && count < best.count)) {
                    best = { max, step, count }
                }
            }
        }
    }
    if (!best) {
        const step = Math.max(minStep, 10 ** Math.ceil(Math.log10(target)))
        best = { max: step * 2, step, count: 2 }
    }
    const { max, step, count } = best
    return {
        max,
        step,
        ticks: Array.from({ length: count + 1 }, (_, i) => Number((i * step).toPrecision(12))),
    }
}

let measureCtx: CanvasRenderingContext2D | null | undefined
function estimateLabelWidth(text: string): number {
    const tabular = text.replace(/\d/g, "0")
    if (typeof document !== "undefined" && measureCtx === undefined) {
        try {
            measureCtx = document.createElement("canvas").getContext("2d")
        } catch {
            measureCtx = null
        }
    }
    if (measureCtx) {
        measureCtx.font = '12px "Inter Variable", ui-sans-serif, system-ui, sans-serif'
        const w = measureCtx.measureText(tabular).width
        if (w > 0) return w
    }
    let est = 0
    for (const ch of tabular) {
        est += /[\u3000-\u9fff]/.test(ch) ? 12 : /[0-9A-Za-z]/.test(ch) ? 7.2 : 3.8
    }
    return est
}

const MIN_X_LABEL_GAP = 6

function xLabelsFit(
    plotW: number,
    labels: readonly string[],
    measure: (text: string) => number,
): boolean {
    const n = labels.length
    if (n < 2) return true
    let prevRight = -Infinity
    for (let i = 0; i < n; i++) {
        const w = measure(labels[i])
        const cx = (plotW * i) / (n - 1)
        const left = i === 0 ? 0 : i === n - 1 ? plotW - w : cx - w / 2
        const right = left + w
        if (left < -0.5 || right > plotW + 0.5) return false
        if (i > 0 && left - prevRight < MIN_X_LABEL_GAP) return false
        prevRight = right
    }
    return true
}

export function buildXTicks(
    t0: number,
    t1: number,
    plotW: number,
    formatTime: Props["formatTime"],
    measure: (text: string) => number = estimateLabelWidth,
): { ticks: number[]; labels: string[] } {
    if (!(plotW > 0)) return { ticks: [], labels: [] }
    const span = t1 - t0 || 1
    const candidates = plotW < FOUR_TIME_LABELS_WIDTH ? [3, 2] : [4, 3, 2]
    for (const count of candidates) {
        const ticks = Array.from({ length: count }, (_, i) => t0 + (span * i) / (count - 1))
        const labels = ticks.map((t, i) => formatTime(t, i, ticks))
        if (count === 2 || xLabelsFit(plotW, labels, measure)) {
            return { ticks, labels }
        }
    }
    return { ticks: [], labels: [] }
}

/** Averages points into at most `buckets` buckets so long ranges stay light. */
function downsample(points: ChartPoint[], buckets: number): ChartPoint[] {
    if (points.length <= buckets) return points
    const size = points.length / buckets
    const out: ChartPoint[] = []
    for (let b = 0; b < buckets; b++) {
        const slice = points.slice(Math.floor(b * size), Math.floor((b + 1) * size))
        const vals = slice.map((p) => p.v).filter((v): v is number => v !== null)
        out.push({
            t: slice[Math.floor(slice.length / 2)].t,
            v: vals.length ? vals.reduce((a, c) => a + c, 0) / vals.length : null,
        })
    }
    return out
}

function medianStep(points: ChartPoint[]) {
    if (points.length < 3) return Infinity
    const diffs = points
        .slice(1)
        .map((p, i) => p.t - points[i].t)
        .sort((a, b) => a - b)
    return diffs[Math.floor(diffs.length / 2)]
}

function nearest(points: ChartPoint[], t: number) {
    let lo = 0
    let hi = points.length - 1
    while (hi - lo > 1) {
        const mid = (lo + hi) >> 1
        if (points[mid].t < t) lo = mid
        else hi = mid
    }
    return Math.abs(points[lo].t - t) <= Math.abs(points[hi].t - t) ? lo : hi
}

/**
 * A small, dependency-free SVG time-series chart: hairline grid, 2px lines,
 * a soft area under the first series, and a crosshair tooltip.
 */
export function Chart({
    series,
    format,
    formatTick,
    scale = "decimal",
    minStep,
    formatTime,
    formatTooltipTime,
    yMax,
    height = 150,
    label,
    robust,
    focus,
    timeWindow: { start: t0, end: t1 },
    showFailedProbes,
}: Props) {
    const tooltipTime = formatTooltipTime ?? ((t: number) => formatTime(t, 0, [t]))
    const box = useRef<HTMLDivElement>(null)
    const yTicksRef = useRef<SVGGElement>(null)
    const tipRef = useRef<HTMLDivElement>(null)
    const [width, setWidth] = useState(0)
    const [domPad, setDomPad] = useState<{ key: string; l: number } | null>(null)
    const [tipW, setTipW] = useState(180)
    // Choose padding from the plot container, which can be narrower than the viewport.
    const isMobile = width < COMPACT_AXES_WIDTH
    const [hoverT, setHoverT] = useState<number | null>(null)
    const uid = useId().replace(/:/g, "")

    useLayoutEffect(() => {
        const el = box.current
        if (!el) return
        setWidth(el.clientWidth)
        const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
        ro.observe(el)
        return () => ro.disconnect()
    }, [])

    const basePad = isMobile ? MOBILE_PAD : PAD
    const gap = isMobile ? 6 : 8
    const sampleBuckets = Math.max(40, Math.floor(Math.max(0, width - basePad.l - basePad.r) / 2))

    const prepared = useMemo(
        () =>
            series.map((s) => {
                const first = s.points.findIndex((p) => p.t >= t0)
                const visible = first < 0 ? [] : downsample(s.points.slice(first), sampleBuckets)
                // Only the stroke needs a predecessor. Keep it out of the first bucket.
                const points = first > 0 ? [s.points[first - 1], ...visible] : visible
                return { ...s, points, visible }
            }),
        [series, sampleBuckets, t0],
    )

    const visible = prepared.flatMap((s) => s.visible)
    const span = t1 - t0 || 1
    const vals = visible.flatMap((p) => (p.v === null ? [] : [p.v]))
    const empty = showFailedProbes ? !visible.length : !vals.length
    let dataMax = vals.reduce((max, v) => Math.max(max, v), 0)
    if (robust && vals.length > 20) {
        vals.sort((a, b) => a - b)
        dataMax = Math.min(dataMax, vals[Math.floor((vals.length - 1) * 0.99)] * 1.25)
    }
    const { max, step, ticks: yTicks } = buildYTicks(dataMax, { scale, yMax, minStep })
    const yLabels = yTicks.map((v) => (formatTick ? formatTick(v, step) : format(v)))
    const labelKey = `${isMobile ? 1 : 0}:${yLabels.join("\n")}`
    const estPadL = Math.ceil(Math.max(0, ...yLabels.map(estimateLabelWidth))) + gap + 4
    const padL = Math.max(basePad.l, estPadL, domPad?.key === labelKey ? domPad.l : 0)
    const pad = { ...basePad, l: padL }
    const plotW = Math.max(0, width - pad.l - pad.r)
    const plotH = height - pad.t - pad.b

    useLayoutEffect(() => {
        if (width <= 0 || !yTicksRef.current) return
        const texts = yTicksRef.current.querySelectorAll("text")
        let maxLen = 0
        texts.forEach((el) => {
            const len =
                typeof el.getComputedTextLength === "function" ? el.getComputedTextLength() : 0
            if (len > maxLen) maxLen = len
        })
        const needed = Math.ceil(maxLen) + gap + 2
        if (needed > padL) setDomPad({ key: labelKey, l: needed })
    }, [width, labelKey, gap, padL])

    const x = (t: number) => pad.l + ((t - t0) / span) * plotW
    const y = (v: number) => pad.t + plotH - (Math.min(v, max) / max) * plotH

    const paths = prepared.map((s) => {
        // Live mixes 2 s frames with 30 s history fill; once frames are the majority a 2 s median
        // would cut every history step, so a gap only breaks the line past 90 s.
        const gapStep = Math.max(medianStep(s.points) * 4, 90_000)
        let line = ""
        let area = ""
        let segStart: number | null = null
        let prevT = -Infinity
        let lastX = 0
        for (const p of s.points) {
            if (p.v === null || p.t - prevT > gapStep) {
                if (segStart !== null)
                    area += `L${lastX},${pad.t + plotH}L${segStart},${pad.t + plotH}Z`
                segStart = null
            }
            if (p.v !== null) {
                const px = x(p.t)
                const py = y(p.v)
                if (segStart === null) {
                    line += `M${px},${py}`
                    area += `M${px},${py}`
                    segStart = px
                } else {
                    line += `L${px},${py}`
                    area += `L${px},${py}`
                }
                lastX = px
            }
            prevT = p.t
        }
        if (segStart !== null) area += `L${lastX},${pad.t + plotH}L${segStart},${pad.t + plotH}Z`
        return { key: s.key, color: s.color, line, area: s.area ? area : "" }
    })

    const xAxis =
        width > 0 && !empty ? buildXTicks(t0, t1, plotW, formatTime) : { ticks: [], labels: [] }
    const tickTextClass = "chart-axis"

    const hover =
        hoverT === null || empty
            ? null
            : prepared.map((s) => {
                  const p = s.visible.length ? s.visible[nearest(s.visible, hoverT)] : null
                  return { s, p }
              })
    const hasHover = Boolean(hover && hover.some((h) => h.p))
    const twoCol = (hover?.length ?? 0) > 8 && width >= 360
    const maxItems = twoCol ? 20 : 10
    const shown = hover && hover.length > maxItems ? hover.slice(0, maxItems - 1) : hover
    const rest = (hover?.length ?? 0) - (shown?.length ?? 0)
    const hoverX = hoverT === null ? 0 : x(hover?.find((h) => h.p)?.p?.t ?? hoverT)

    useLayoutEffect(() => {
        if (!hasHover || !tipRef.current) return
        const nextW = tipRef.current.offsetWidth
        if (nextW > 0 && nextW !== tipW) setTipW(nextW)
    })

    const clampedTipW = Math.min(tipW, width)
    const flipLeft = hoverX > pad.l + plotW / 2
    const desiredTipLeft = flipLeft ? hoverX - 12 - clampedTipW : hoverX + 12
    const tipLeft = Math.max(0, Math.min(Math.max(0, width - clampedTipW), desiredTipLeft))

    const tapRef = useRef<{ startX: number; moved: boolean; sameSpot: boolean } | null>(null)

    useEffect(() => {
        if (!hasHover) return
        const onDocDown = (e: globalThis.PointerEvent) => {
            if (e.pointerType === "mouse") return
            if (box.current && e.target instanceof Node && !box.current.contains(e.target)) {
                setHoverT(null)
            }
        }
        document.addEventListener("pointerdown", onDocDown, true)
        return () => document.removeEventListener("pointerdown", onDocDown, true)
    }, [hasHover])

    const toHoverT = (clientX: number, el: SVGSVGElement) => {
        const rect = el.getBoundingClientRect()
        const px = clientX - rect.left
        if (px < pad.l || px > width - pad.r || plotW <= 0 || empty) return null
        return t0 + (Math.min(plotW, px - pad.l) / plotW) * span
    }

    const onDown = (e: PointerEvent<SVGSVGElement>) => {
        if (e.pointerType === "mouse") return
        const nextT = toHoverT(e.clientX, e.currentTarget)
        if (nextT === null) {
            tapRef.current = null
            setHoverT(null)
            return
        }
        const sameSpot = hoverT !== null && Math.abs(x(nextT) - x(hoverT)) < 14
        tapRef.current = { startX: e.clientX, moved: false, sameSpot }
        if (!sameSpot) setHoverT(nextT)
    }

    const onMove = (e: PointerEvent<SVGSVGElement>) => {
        if (tapRef.current && Math.abs(e.clientX - tapRef.current.startX) > 4) {
            tapRef.current.moved = true
        }
        setHoverT(toHoverT(e.clientX, e.currentTarget))
    }

    const onUp = (e: PointerEvent<SVGSVGElement>) => {
        if (e.pointerType === "mouse") return
        if (tapRef.current && !tapRef.current.moved && tapRef.current.sameSpot) {
            setHoverT(null)
        }
        tapRef.current = null
    }

    return (
        <div
            ref={box}
            className="chart relative select-none"
            style={{ height }}
            role="img"
            aria-label={label}
        >
            {width > 0 && !empty && (
                <svg
                    width={width}
                    height={height}
                    className="block touch-pan-y overflow-visible"
                    onPointerDown={onDown}
                    onPointerMove={onMove}
                    onPointerUp={onUp}
                    onPointerCancel={() => {
                        tapRef.current = null
                        setHoverT(null)
                    }}
                    onPointerLeave={(e) => {
                        if (e.pointerType === "mouse") setHoverT(null)
                    }}
                >
                    <defs>
                        <clipPath id={`${uid}-plot`}>
                            <rect x={pad.l - 1} y={0} width={plotW + pad.r + 1} height={height} />
                        </clipPath>
                        {prepared.map((s) => (
                            <linearGradient
                                key={s.key}
                                id={`${uid}-${s.key}`}
                                x1="0"
                                x2="0"
                                y1="0"
                                y2="1"
                            >
                                <stop
                                    offset="0%"
                                    style={{ stopColor: s.color, stopOpacity: 0.4 }}
                                />
                                <stop
                                    offset="100%"
                                    style={{ stopColor: s.color, stopOpacity: 0 }}
                                />
                            </linearGradient>
                        ))}
                    </defs>
                    <g ref={yTicksRef}>
                        {yTicks.map((v, i) => (
                            <g key={i}>
                                <line
                                    x1={pad.l}
                                    x2={width - pad.r}
                                    y1={y(v)}
                                    y2={y(v)}
                                    style={{ stroke: "var(--color-kumo-line)" }}
                                    strokeDasharray={i === 0 ? undefined : "2 4"}
                                />
                                <text
                                    x={pad.l - gap}
                                    y={y(v)}
                                    dy="0.32em"
                                    textAnchor="end"
                                    className={tickTextClass}
                                >
                                    {yLabels[i]}
                                </text>
                            </g>
                        ))}
                    </g>
                    {xAxis.ticks.map((t, i) => (
                        <text
                            key={i}
                            x={x(t)}
                            y={height - (isMobile ? 3 : 6)}
                            textAnchor={
                                i === 0 ? "start" : i === xAxis.ticks.length - 1 ? "end" : "middle"
                            }
                            className={tickTextClass}
                        >
                            {xAxis.labels[i]}
                        </text>
                    ))}
                    <g clipPath={`url(#${uid}-plot)`}>
                        {paths.map(
                            (p) =>
                                p.area && (
                                    <path
                                        key={`a-${p.key}`}
                                        d={p.area}
                                        style={{ fill: `url(#${uid}-${p.key})` }}
                                    />
                                ),
                        )}
                        {(focus
                            ? [
                                  ...paths.filter((p) => p.key !== focus),
                                  ...paths.filter((p) => p.key === focus),
                              ]
                            : paths
                        ).map((p) => (
                            <path
                                key={p.key}
                                d={p.line}
                                fill="none"
                                style={{
                                    stroke: p.color,
                                    opacity: focus && p.key !== focus ? 0.18 : 1,
                                    transition: "opacity 150ms",
                                }}
                                strokeWidth={2}
                                strokeLinejoin="round"
                                strokeLinecap="round"
                                vectorEffect="non-scaling-stroke"
                            />
                        ))}
                    </g>
                    {hover && (
                        <g>
                            <line
                                x1={hoverX}
                                x2={hoverX}
                                y1={pad.t}
                                y2={pad.t + plotH}
                                style={{ stroke: "var(--color-kumo-fill)" }}
                            />
                            {hover.map(({ s, p }) =>
                                p && p.v !== null ? (
                                    <circle
                                        key={s.key}
                                        cx={x(p.t)}
                                        cy={y(p.v)}
                                        r={3.5}
                                        style={{ fill: "var(--color-kumo-base)", stroke: s.color }}
                                        strokeWidth={1.5}
                                    />
                                ) : null,
                            )}
                        </g>
                    )}
                </svg>
            )}
            {empty && <ChartEmpty />}
            {hover && shown && hasHover && (
                <div
                    ref={tipRef}
                    className="chart-tooltip pointer-events-none absolute top-1 z-10 px-3 py-2 text-[12px]"
                    style={{
                        left: tipLeft,
                        maxWidth: width,
                    }}
                >
                    <p className="num mb-1 text-kumo-subtle">
                        {tooltipTime(hover.find((h) => h.p)!.p!.t)}
                    </p>
                    <div className="chart-tooltip-rows" data-cols={twoCol ? "2" : undefined}>
                        {shown.map(({ s, p }) => (
                            <p
                                key={s.key}
                                className="chart-tooltip-row flex min-w-0 items-center gap-2"
                            >
                                <span
                                    className="h-[2px] w-3 shrink-0 rounded-full"
                                    style={{ background: s.color }}
                                />
                                <span
                                    className="chart-series-label text-kumo-subtle"
                                    title={s.label}
                                >
                                    {s.label}
                                </span>
                                <span className="num ml-auto shrink-0 pl-2">
                                    {p && p.v !== null ? format(p.v) : "—"}
                                </span>
                            </p>
                        ))}
                        {rest > 0 && <p className="chart-tooltip-row muted num">+{rest}</p>}
                    </div>
                </div>
            )}
        </div>
    )
}
