import { ButtonProps, buttonVariants } from "@/components/ui/button"
import { useMediaQuery } from "@/hooks/useMediaQuery"
import { cn } from "@/lib/utils"
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react"
import { ComponentProps, forwardRef, useLayoutEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

// Full 5-page + Previous/Next text bar fits from 556 px content width
// (880 px viewport minus 260 px expanded sidebar minus 64 px page gutter).
const PAGINATION_FULL_WIDTH = 556

const Pagination = ({ className, ...props }: ComponentProps<"nav">) => (
    <nav
        role="navigation"
        aria-label="pagination"
        className={cn("mx-auto flex w-full justify-center", className)}
        {...props}
    />
)
Pagination.displayName = "Pagination"

const PaginationContent = forwardRef<HTMLUListElement, ComponentProps<"ul">>(
    ({ className, ...props }, ref) => (
        <ul ref={ref} className={cn("flex flex-row items-center gap-1", className)} {...props} />
    ),
)
PaginationContent.displayName = "PaginationContent"

const PaginationItem = forwardRef<HTMLLIElement, ComponentProps<"li">>(
    ({ className, ...props }, ref) => <li ref={ref} className={cn("", className)} {...props} />,
)
PaginationItem.displayName = "PaginationItem"

type PaginationLinkProps = {
    isActive?: boolean
} & Pick<ButtonProps, "size"> &
    ComponentProps<"a">

const PaginationLink = ({ className, isActive, size = "icon", ...props }: PaginationLinkProps) => (
    <a
        aria-current={isActive ? "page" : undefined}
        className={cn(
            buttonVariants({
                variant: isActive ? "outline" : "ghost",
                size,
            }),
            size === "icon" && "w-auto min-w-9 px-2 tabular-nums",
            className,
        )}
        {...props}
    />
)
PaginationLink.displayName = "PaginationLink"

const PaginationPrevious = ({ className, ...props }: ComponentProps<typeof PaginationLink>) => {
    const { t } = useTranslation()
    const label = t("MCPOAuthManager.Previous")
    return (
        <PaginationLink
            aria-label={label}
            size="default"
            className={cn("gap-1 px-2.5", className)}
            {...props}
        >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline group-data-[compact]/pagination:hidden">{label}</span>
        </PaginationLink>
    )
}
PaginationPrevious.displayName = "PaginationPrevious"

const PaginationNext = ({ className, ...props }: ComponentProps<typeof PaginationLink>) => {
    const { t } = useTranslation()
    const label = t("MCPOAuthManager.Next")
    return (
        <PaginationLink
            aria-label={label}
            size="default"
            className={cn("gap-1 px-2.5", className)}
            {...props}
        >
            <span className="hidden sm:inline group-data-[compact]/pagination:hidden">{label}</span>
            <ChevronRight className="h-4 w-4" />
        </PaginationLink>
    )
}
PaginationNext.displayName = "PaginationNext"

const PaginationEllipsis = ({ className, ...props }: ComponentProps<"span">) => (
    <span
        aria-hidden
        className={cn(
            "flex h-9 w-7 items-center justify-center sm:w-9 group-data-[compact]/pagination:w-7",
            className,
        )}
        {...props}
    >
        <MoreHorizontal className="h-4 w-4" />
        <span className="sr-only">More pages</span>
    </span>
)
PaginationEllipsis.displayName = "PaginationEllipsis"

function getPageNumbers(page: number, totalPages: number, compact: boolean) {
    const maxVisiblePages = compact ? 3 : 5
    if (totalPages <= maxVisiblePages) {
        return Array.from({ length: totalPages }, (_, i) => i + 1)
    }

    const pages: number[] = [1]
    const neighbors = compact ? 0 : 1
    let startPage = Math.max(2, page - neighbors)
    let endPage = Math.min(totalPages - 1, page + neighbors)

    if (compact) {
        if (page <= 2) {
            startPage = 2
            endPage = Math.min(2, totalPages - 1)
        } else if (page >= totalPages - 1) {
            startPage = Math.max(2, totalPages - 1)
            endPage = totalPages - 1
        }
    } else if (page <= 3) {
        endPage = Math.min(maxVisiblePages - 1, totalPages - 1)
    } else if (page >= totalPages - 2) {
        startPage = Math.max(2, totalPages - (maxVisiblePages - 2))
    }

    if (startPage > 2) pages.push(-1)
    for (let i = startPage; i <= endPage; i++) pages.push(i)
    if (endPage < totalPages - 1) pages.push(-1)
    if (totalPages > 1) pages.push(totalPages)

    return pages
}

type TablePaginationProps = {
    page: number
    pageSize: number
    total: number
    onPageChange: (page: number) => void
}

const TablePagination = ({ page, pageSize, total, onPageChange }: TablePaginationProps) => {
    const { t } = useTranslation()
    const box = useRef<HTMLDivElement>(null)
    const sm = useMediaQuery("(min-width: 640px)")
    const [narrowContainer, setNarrowContainer] = useState(false)
    const totalPages = Math.ceil(total / pageSize)

    useLayoutEffect(() => {
        const el = box.current
        if (!el) return
        const update = (w: number) => setNarrowContainer(w > 0 && w < PAGINATION_FULL_WIDTH)
        update(el.clientWidth)
        if (typeof ResizeObserver === "undefined") return
        const observer = new ResizeObserver(([entry]) => update(entry.contentRect.width))
        observer.observe(el)
        return () => observer.disconnect()
    }, [])

    const compact = !sm || narrowContainer

    const handlePageChange = (newPage: number) => {
        if (newPage < 1 || newPage > totalPages) return
        onPageChange(newPage)
    }

    return (
        <div
            ref={box}
            className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-2 py-4"
        >
            <div className="shrink-0 whitespace-nowrap text-sm text-muted-foreground tabular-nums">
                {t("Total")}: {total}
            </div>
            <Pagination
                data-compact={compact || undefined}
                className="group/pagination mx-0 ml-auto w-auto"
            >
                <PaginationContent>
                    <PaginationItem>
                        <PaginationPrevious
                            onClick={() => handlePageChange(page - 1)}
                            aria-disabled={page <= 1 || undefined}
                            className={
                                page <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"
                            }
                        />
                    </PaginationItem>

                    {getPageNumbers(page, totalPages, compact).map((pageNum, idx) =>
                        pageNum === -1 ? (
                            <PaginationItem key={`ellipsis-${idx}`}>
                                <PaginationEllipsis />
                            </PaginationItem>
                        ) : (
                            <PaginationItem key={pageNum}>
                                <PaginationLink
                                    onClick={() => handlePageChange(pageNum)}
                                    isActive={pageNum === page}
                                    className="cursor-pointer"
                                >
                                    {pageNum}
                                </PaginationLink>
                            </PaginationItem>
                        ),
                    )}

                    <PaginationItem>
                        <PaginationNext
                            onClick={() => handlePageChange(page + 1)}
                            aria-disabled={page >= totalPages || undefined}
                            className={
                                page >= totalPages
                                    ? "pointer-events-none opacity-50"
                                    : "cursor-pointer"
                            }
                        />
                    </PaginationItem>
                </PaginationContent>
            </Pagination>
        </div>
    )
}
TablePagination.displayName = "TablePagination"

export {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
    TablePagination,
}
