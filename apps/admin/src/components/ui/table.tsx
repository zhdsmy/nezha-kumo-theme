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

const TableContext = createContext<{ primaryColumn: string; layout: string } | null>(null)
const RowContext = createContext({ open: false, toggle: () => {} })

const Table = forwardRef<
    HTMLTableElement,
    HTMLAttributes<HTMLTableElement> & { primaryColumn?: string }
>(({ className, primaryColumn = "name", ...props }, ref) => {
    const box = useRef<HTMLDivElement>(null)
    const tableWidth = useMediaQuery(`(min-width: ${BREAKPOINTS.gutter}px)`)
    const wide = useMediaQuery(`(min-width: ${BREAKPOINTS.wide}px)`)
    const layout = wide ? "wide" : tableWidth ? "compact" : "cards"
    useLayoutEffect(() => {
        const heads = box.current?.querySelectorAll("thead th") ?? []
        box.current?.querySelectorAll("tbody tr").forEach((tr) =>
            Array.from(tr.children).forEach((td, i) => {
                const label = heads[i]?.textContent?.trim()
                if (label) td.setAttribute("data-label", label)
                const value = td.querySelector<HTMLElement>(".nkt-cell-value")
                if (value?.textContent) value.title = value.textContent.trim()
            }),
        )
        heads.forEach((head) => {
            if (head.textContent?.trim()) head.setAttribute("title", head.textContent.trim())
        })
        const actions = box.current?.querySelectorAll<HTMLElement>(".nkt-table-actions") ?? []
        const width = Math.max(0, ...Array.from(actions, (el) => el.scrollWidth))
        box.current?.style.setProperty("--nkt-actions-width", `${width + 32}px`)
    })
    return (
        <TableContext.Provider value={{ primaryColumn, layout }}>
            <div
                ref={box}
                data-layout={layout}
                className="nkt-table relative w-full min-w-0 rounded-lg border bg-card"
            >
                <table
                    ref={ref}
                    className={cn("w-full caption-bottom text-base", className)}
                    {...props}
                />
            </div>
        </TableContext.Provider>
    )
})
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
>(({ className, ...props }, ref) => {
    const table = useContext(TableContext)
    return (
        <th
            ref={ref}
            data-primary={props["data-col"] === table?.primaryColumn || undefined}
            className={cn(
                "h-11 px-4 py-2 text-left align-middle text-sm font-medium text-muted-foreground",
                className,
            )}
            {...props}
        />
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
