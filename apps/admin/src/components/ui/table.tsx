import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useMediaQuery } from "@/hooks/useMediaQuery"
import { cn } from "@/lib/utils"
import { BREAKPOINTS } from "@nezha-kumo/ui"
import { ChevronDown, MoreHorizontal } from "lucide-react"
import {
    HTMLAttributes,
    TdHTMLAttributes,
    ThHTMLAttributes,
    createContext,
    forwardRef,
    useContext,
    useLayoutEffect,
    useRef,
    useState,
} from "react"
import { useTranslation } from "react-i18next"

const TableContext = createContext<{
    primaryColumn: string
    layout: string
    hiddenColumns: string[]
    selectedCount: number
} | null>(null)
const RowContext = createContext({ open: false, toggle: () => {} })
const defaultPriority: [string, number][] = []

const Table = forwardRef<
    HTMLTableElement,
    HTMLAttributes<HTMLTableElement> & {
        primaryColumn?: string
        columnPriority?: [string, number][]
    }
>(
    (
        { className, primaryColumn = "name", columnPriority = defaultPriority, children, ...props },
        ref,
    ) => {
        const box = useRef<HTMLDivElement>(null)
        const tableWidth = useMediaQuery(`(min-width: ${BREAKPOINTS.gutter}px)`)
        const [hiddenColumns, setHiddenColumns] = useState<string[]>([])
        const [selectedCount, setSelectedCount] = useState(0)
        const selectedCountRef = useRef(0)
        const layout = !tableWidth ? "cards" : hiddenColumns.length ? "compact" : "wide"
        useLayoutEffect(() => {
            const container = box.current
            if (!container) return
            const heads = Array.from(container.querySelectorAll<HTMLElement>("thead th"))
            container.querySelectorAll("tbody tr").forEach((tr) =>
                Array.from(tr.children).forEach((td, i) => {
                    const head = heads[i]
                    const label = head?.dataset.col === "select" ? "" : head?.textContent?.trim()
                    if (label) td.setAttribute("data-label", label)
                    const value = td.querySelector<HTMLElement>(".nkt-cell-value")
                    if (value?.textContent) value.title = value.textContent.trim()
                }),
            )
            heads.forEach((head) => {
                if (head.dataset.col !== "select" && head.textContent?.trim()) {
                    head.setAttribute("title", head.textContent.trim())
                }
            })
            const syncSelectedCount = () => {
                const next = container.querySelectorAll(
                    'tbody [data-col="select"] [aria-checked="true"], tbody [data-col="select"] input:checked',
                ).length
                if (selectedCountRef.current !== next) {
                    selectedCountRef.current = next
                    setSelectedCount(next)
                }
            }
            let selectionObserver: MutationObserver | undefined
            if (!tableWidth) {
                syncSelectedCount()
                const tbody = container.querySelector("tbody")
                if (tbody) {
                    selectionObserver = new MutationObserver(syncSelectedCount)
                    selectionObserver.observe(tbody, {
                        attributes: true,
                        attributeFilter: ["aria-checked", "checked"],
                        childList: true,
                        subtree: true,
                    })
                }
            }
            const actions = container.querySelectorAll<HTMLElement>(".nkt-table-actions")
            const actionWidth = Math.max(80, ...Array.from(actions, (el) => el.scrollWidth)) + 32
            const columns = heads.map((head) => head.dataset.col).filter((id): id is string => !!id)
            const sizes = new Map(columnPriority)
            sizes.set("select", 48)
            sizes.set("actions", actionWidth)
            if (!sizes.has(primaryColumn)) sizes.set(primaryColumn, 180)
            const size = (id: string) => sizes.get(id) ?? 120
            const update = (width: number) => {
                const visible = new Set(
                    columns.filter((id) => ["select", "actions", primaryColumn].includes(id)),
                )
                let remaining = width - Array.from(visible).reduce((sum, id) => sum + size(id), 0)
                // Priority decides which fields survive; DOM order still decides their position.
                const ordered = [...new Set([...sizes.keys(), ...columns])]
                for (const id of ordered) {
                    if (!columns.includes(id) || visible.has(id) || size(id) > remaining) continue
                    visible.add(id)
                    remaining -= size(id)
                }
                const hidden = columns.filter((id) => !visible.has(id))
                setHiddenColumns((previous) =>
                    previous.join("\0") === hidden.join("\0") ? previous : hidden,
                )
                container.style.setProperty(
                    "--nkt-table-columns",
                    columns
                        .filter((id) => visible.has(id))
                        .map((id) => (id === primaryColumn ? "minmax(0, 1fr)" : `${size(id)}px`))
                        .join(" "),
                )
            }
            update(container.clientWidth)
            const observer = new ResizeObserver(([entry]) => update(entry.contentRect.width))
            observer.observe(container)
            return () => {
                observer.disconnect()
                selectionObserver?.disconnect()
            }
        }, [children, columnPriority, primaryColumn, tableWidth])
        return (
            <TableContext.Provider value={{ primaryColumn, layout, hiddenColumns, selectedCount }}>
                <div
                    ref={box}
                    data-layout={layout}
                    className="nkt-table relative w-full min-w-0 rounded-lg border bg-card"
                >
                    <table
                        ref={ref}
                        className={cn("w-full caption-bottom text-base", className)}
                        {...props}
                    >
                        {children}
                    </table>
                </div>
            </TableContext.Provider>
        )
    },
)
Table.displayName = "Table"

const TableHeader = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
    ({ className, ...props }, ref) => (
        <thead ref={ref} className={cn("bg-background [&_tr]:border-b", className)} {...props} />
    ),
)
TableHeader.displayName = "TableHeader"

const TableBody = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
    ({ className, ...props }, ref) => (
        <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />
    ),
)
TableBody.displayName = "TableBody"

const TableFooter = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
    ({ className, ...props }, ref) => (
        <tfoot
            ref={ref}
            className={cn("border-t bg-muted/50 font-medium [&>tr]:last:border-b-0", className)}
            {...props}
        />
    ),
)
TableFooter.displayName = "TableFooter"

const TableRow = forwardRef<HTMLTableRowElement, HTMLAttributes<HTMLTableRowElement>>(
    ({ className, onClick, ...props }, ref) => {
        const table = useContext(TableContext)
        const [open, setOpen] = useState(false)
        const toggle = () => setOpen((value) => !value)
        return (
            <RowContext.Provider value={{ open, toggle }}>
                <tr
                    ref={ref}
                    className={cn("border-b", className)}
                    data-open={open || undefined}
                    onClick={(e) => {
                        onClick?.(e)
                        const target = e.target as HTMLElement
                        if (
                            e.defaultPrevented ||
                            !table ||
                            table.layout === "wide" ||
                            !e.currentTarget.contains(target)
                        )
                            return
                        if (e.currentTarget.parentElement?.tagName !== "TBODY") return
                        if (
                            target.closest(
                                "button, a, input, label, select, textarea, [role=checkbox]",
                            )
                        )
                            return
                        toggle()
                    }}
                    {...props}
                />
            </RowContext.Provider>
        )
    },
)
TableRow.displayName = "TableRow"

type ColumnAttribute = { "data-col"?: string }
const TableHead = forwardRef<
    HTMLTableCellElement,
    ThHTMLAttributes<HTMLTableCellElement> & ColumnAttribute
>(({ className, children, ...props }, ref) => {
    const table = useContext(TableContext)
    const { t } = useTranslation()
    return (
        <th
            ref={ref}
            data-primary={props["data-col"] === table?.primaryColumn || undefined}
            data-hidden={table?.hiddenColumns.includes(props["data-col"] ?? "") || undefined}
            className={cn(
                "h-11 px-4 py-2 text-left align-middle text-sm font-medium text-muted-foreground",
                className,
            )}
            {...props}
        >
            {props["data-col"] === "select" ? (
                table?.layout === "cards" ? (
                    <div
                        className="nkt-cards-select-all"
                        onClick={(e) => {
                            const target = e.target as HTMLElement
                            if (target.closest('button, input, label, [role="checkbox"]')) return
                            e.currentTarget
                                .querySelector<HTMLElement>(
                                    '[role="checkbox"], input[type="checkbox"]',
                                )
                                ?.click()
                        }}
                    >
                        {children}
                        <span
                            className={cn(
                                "nkt-cards-select-label",
                                table.selectedCount > 0 && "text-foreground",
                            )}
                        >
                            {table.selectedCount > 0
                                ? t("SelectedCount", { count: table.selectedCount })
                                : t("SelectAll")}
                        </span>
                    </div>
                ) : (
                    children
                )
            ) : (
                <div className="nkt-cell-value">{children}</div>
            )}
        </th>
    )
})
TableHead.displayName = "TableHead"

const TableCell = forwardRef<
    HTMLTableCellElement,
    TdHTMLAttributes<HTMLTableCellElement> & ColumnAttribute
>(({ className, children, ...props }, ref) => {
    const table = useContext(TableContext)
    const row = useContext(RowContext)
    const { t } = useTranslation()
    const primary = props["data-col"] === table?.primaryColumn && !!table
    const actions = props["data-col"] === "actions" && !!table
    return (
        <td
            ref={ref}
            data-primary={primary || undefined}
            data-hidden={table?.hiddenColumns.includes(props["data-col"] ?? "") || undefined}
            className={cn("h-12 px-4 py-2 align-middle", className)}
            {...props}
        >
            {actions ? (
                table.layout === "cards" ? (
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label={t("Actions")}
                            >
                                <MoreHorizontal />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent
                            align="end"
                            className="nkt-row-actions w-auto p-2"
                            aria-label={t("Actions")}
                        >
                            {children}
                        </PopoverContent>
                    </Popover>
                ) : (
                    <div className="nkt-table-actions">{children}</div>
                )
            ) : primary ? (
                <div className="flex min-w-0 items-center gap-2">
                    <div className="nkt-cell-value min-w-0 flex-1">{children}</div>
                    {table.layout !== "wide" && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="shrink-0"
                            aria-label={t("TableDetails")}
                            aria-expanded={row.open}
                            onClick={row.toggle}
                        >
                            <ChevronDown className={cn(row.open && "rotate-180")} />
                        </Button>
                    )}
                </div>
            ) : props["data-col"] && props["data-col"] !== "select" ? (
                <div className="nkt-cell-value">{children}</div>
            ) : (
                children
            )}
        </td>
    )
})
TableCell.displayName = "TableCell"

const TableCaption = forwardRef<HTMLTableCaptionElement, HTMLAttributes<HTMLTableCaptionElement>>(
    ({ className, ...props }, ref) => (
        <caption
            ref={ref}
            className={cn("mt-4 text-sm text-muted-foreground", className)}
            {...props}
        />
    ),
)
TableCaption.displayName = "TableCaption"

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption }
