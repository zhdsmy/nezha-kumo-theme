import { cn } from "@/lib/utils"
import { Tabs as KumoTabs, type TabsItem, type TabsProps as KumoTabsProps } from "@cloudflare/kumo"
import { ChevronLeft, ChevronRight } from "lucide-react"
import {
    ButtonHTMLAttributes,
    Children,
    Fragment,
    HTMLAttributes,
    KeyboardEvent,
    ReactElement,
    ReactNode,
    cloneElement,
    forwardRef,
    isValidElement,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from "react"
import { useTranslation } from "react-i18next"

export interface TabsProps extends Omit<HTMLAttributes<HTMLDivElement>, "defaultValue"> {
    value?: string
    defaultValue?: string
    onValueChange?: (value: string) => void
    variant?: KumoTabsProps["variant"]
    size?: KumoTabsProps["size"]
    activateOnFocus?: boolean
    labels?: KumoTabsProps["labels"]
}

export type TabsListProps = HTMLAttributes<HTMLDivElement>

export interface TabsTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    value: string
    asChild?: boolean
}

export interface TabsContentProps extends HTMLAttributes<HTMLDivElement> {
    value: string
    forceMount?: true
}

function flattenElements(nodes: ReactNode): ReactElement[] {
    const out: ReactElement[] = []
    Children.forEach(nodes, (node) => {
        if (!isValidElement(node)) return
        if (node.type === Fragment) {
            out.push(...flattenElements((node.props as { children?: ReactNode }).children))
            return
        }
        out.push(node)
    })
    return out
}

const TabsList = forwardRef<HTMLDivElement, TabsListProps>(() => null)
TabsList.displayName = "TabsList"

const TabsTrigger = forwardRef<HTMLButtonElement, TabsTriggerProps>(() => null)
TabsTrigger.displayName = "TabsTrigger"

const TabsContent = forwardRef<HTMLDivElement, TabsContentProps>(
    ({ className, value: _value, forceMount: _forceMount, ...props }, ref) => (
        <div
            ref={ref}
            role="tabpanel"
            tabIndex={0}
            className={cn(
                "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                className,
            )}
            {...props}
        />
    ),
)
TabsContent.displayName = "TabsContent"

const Tabs = forwardRef<HTMLDivElement, TabsProps>(
    (
        {
            value,
            defaultValue,
            onValueChange,
            variant = "segmented",
            size,
            activateOnFocus,
            labels,
            className,
            children,
            ...props
        },
        ref,
    ) => {
        const { t } = useTranslation()
        const rootRef = useRef<HTMLDivElement | null>(null)
        const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue)
        const [overflowState, setOverflowState] = useState({ start: false, end: false })

        const topElements = flattenElements(children)
        const listElement = topElements.find((el) => el.type === TabsList) as
            | ReactElement<TabsListProps>
            | undefined
        const contentElements = topElements.filter((el) => el.type === TabsContent) as Array<
            ReactElement<TabsContentProps>
        >
        const triggerElements = listElement
            ? (flattenElements(listElement.props.children).filter(
                  (el) => el.type === TabsTrigger,
              ) as Array<ReactElement<TabsTriggerProps>>)
            : []

        const activeValue =
            value !== undefined ? value : (uncontrolledValue ?? triggerElements[0]?.props.value)

        const items: TabsItem[] = triggerElements.map((triggerEl) => {
            const {
                value: itemValue,
                asChild,
                disabled,
                className: triggerClassName,
                children: triggerChildren,
            } = triggerEl.props
            const isActive = itemValue === activeValue

            if (asChild && isValidElement(triggerChildren)) {
                const child = triggerChildren as ReactElement<Record<string, unknown>>
                const isButtonChild = typeof child.type === "string" && child.type === "button"
                const childClassName =
                    typeof child.props.className === "string" ? child.props.className : undefined
                const childOnKeyDown = child.props.onKeyDown as
                    | ((e: KeyboardEvent<HTMLElement>) => void)
                    | undefined

                return {
                    value: itemValue,
                    label: child.props.children as ReactNode,
                    className: triggerClassName,
                    nativeButton: isButtonChild,
                    render: cloneElement(child, {
                        "aria-current":
                            (child.props["aria-current"] as "page" | undefined) ??
                            (isActive ? "page" : undefined),
                        className: cn(!isButtonChild && "no-underline", childClassName),
                        onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
                            childOnKeyDown?.(e)
                            if (
                                !e.defaultPrevented &&
                                !isButtonChild &&
                                e.key === "Enter" &&
                                !e.metaKey &&
                                !e.ctrlKey &&
                                !e.shiftKey &&
                                !e.altKey
                            ) {
                                e.preventDefault()
                                e.currentTarget.click()
                            }
                        },
                    }),
                }
            }

            return {
                value: itemValue,
                label: triggerChildren,
                className: triggerClassName,
                render: disabled ? <button type="button" disabled /> : undefined,
            }
        })

        const itemsKey = items.map((item) => item.value).join("|")

        useLayoutEffect(() => {
            const list = rootRef.current?.querySelector<HTMLElement>('[role="tablist"]')
            const active = list?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')
            if (!list || !active || list.scrollWidth <= list.clientWidth) return
            const pad = 4
            const start = active.offsetLeft
            const end = start + active.offsetWidth
            if (start - pad < list.scrollLeft) {
                list.scrollLeft = Math.max(0, start - pad)
            } else if (end + pad > list.scrollLeft + list.clientWidth) {
                list.scrollLeft = end + pad - list.clientWidth
            }
        }, [activeValue, itemsKey])

        useEffect(() => {
            if (variant !== "underline") return
            const list = rootRef.current?.querySelector<HTMLElement>('[role="tablist"]')
            if (!list) return
            const update = () => {
                const start = list.scrollLeft > 1
                const end = list.scrollLeft + list.clientWidth < list.scrollWidth - 1
                setOverflowState((prev) =>
                    prev.start === start && prev.end === end ? prev : { start, end },
                )
            }
            update()
            list.addEventListener("scroll", update, { passive: true })
            const ro =
                typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : undefined
            ro?.observe(list)
            for (const tab of list.querySelectorAll('[role="tab"]')) ro?.observe(tab)
            return () => {
                list.removeEventListener("scroll", update)
                ro?.disconnect()
            }
        }, [variant, itemsKey])

        const isSegmented = variant === "segmented"
        const isUnderline = variant === "underline"
        const scrollStartLabel = labels?.scrollStart ?? t("ScrollTabsLeft")
        const scrollEndLabel = labels?.scrollEnd ?? t("ScrollTabsRight")

        const scrollTabs = (direction: "start" | "end") => {
            const list = rootRef.current?.querySelector<HTMLElement>('[role="tablist"]')
            if (!list) return
            const distance = Math.max(120, Math.round(list.clientWidth * 0.65))
            const next =
                direction === "start"
                    ? Math.max(0, list.scrollLeft - distance)
                    : Math.min(list.scrollWidth - list.clientWidth, list.scrollLeft + distance)
            const reduced =
                typeof window !== "undefined" &&
                window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
            if (!reduced && typeof list.scrollTo === "function") {
                list.scrollTo({ left: next, behavior: "smooth" })
            } else {
                list.scrollLeft = next
            }
        }

        const tabsNode = (
            <KumoTabs
                tabs={items}
                value={activeValue}
                onValueChange={(next) => {
                    if (value === undefined) setUncontrolledValue(next)
                    onValueChange?.(next)
                }}
                variant={variant}
                size={size}
                activateOnFocus={activateOnFocus}
                listClassName={listElement?.props.className}
                labels={{
                    scrollStart: scrollStartLabel,
                    scrollEnd: scrollEndLabel,
                }}
            />
        )

        return (
            <div
                ref={(node) => {
                    rootRef.current = node
                    if (typeof ref === "function") ref(node)
                    else if (ref) ref.current = node
                }}
                className={cn(isSegmented ? "w-fit max-w-full" : "w-full min-w-0", className)}
                {...props}
            >
                {isUnderline ? (
                    <div className="relative min-w-0">
                        {tabsNode}
                        {(overflowState.start || overflowState.end) && (
                            <>
                                <button
                                    type="button"
                                    data-kumo-component="Tabs"
                                    data-kumo-part="overflow-control"
                                    data-side="start"
                                    aria-label={scrollStartLabel}
                                    aria-hidden={!overflowState.start}
                                    tabIndex={overflowState.start ? 0 : -1}
                                    onClick={() => scrollTabs("start")}
                                    className={cn(
                                        "absolute inset-y-0 left-0 z-10 flex w-8 items-center justify-start border-0 bg-linear-to-r from-kumo-canvas via-kumo-canvas/95 to-transparent p-0 transition-opacity duration-150 focus:outline-hidden focus-visible:[&>span]:ring-2 focus-visible:[&>span]:ring-kumo-brand",
                                        overflowState.start
                                            ? "pointer-events-auto opacity-100"
                                            : "pointer-events-none opacity-0",
                                    )}
                                >
                                    <span className="ml-0.5 flex size-6 items-center justify-center rounded text-kumo-subtle transition-colors hover:text-kumo-default">
                                        <ChevronLeft className="size-4" aria-hidden="true" />
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    data-kumo-component="Tabs"
                                    data-kumo-part="overflow-control"
                                    data-side="end"
                                    aria-label={scrollEndLabel}
                                    aria-hidden={!overflowState.end}
                                    tabIndex={overflowState.end ? 0 : -1}
                                    onClick={() => scrollTabs("end")}
                                    className={cn(
                                        "absolute inset-y-0 right-0 z-10 flex w-8 items-center justify-end border-0 bg-linear-to-l from-kumo-canvas via-kumo-canvas/95 to-transparent p-0 transition-opacity duration-150 focus:outline-hidden focus-visible:[&>span]:ring-2 focus-visible:[&>span]:ring-kumo-brand",
                                        overflowState.end
                                            ? "pointer-events-auto opacity-100"
                                            : "pointer-events-none opacity-0",
                                    )}
                                >
                                    <span className="mr-0.5 flex size-6 items-center justify-center rounded text-kumo-subtle transition-colors hover:text-kumo-default">
                                        <ChevronRight className="size-4" aria-hidden="true" />
                                    </span>
                                </button>
                            </>
                        )}
                    </div>
                ) : (
                    tabsNode
                )}
                {contentElements.map((contentEl) => {
                    if (!contentEl.props.forceMount && contentEl.props.value !== activeValue) {
                        return null
                    }
                    return cloneElement(contentEl, {
                        key: contentEl.key ?? contentEl.props.value,
                    })
                })}
            </div>
        )
    },
)
Tabs.displayName = "Tabs"

export { Tabs, TabsList, TabsTrigger, TabsContent }
