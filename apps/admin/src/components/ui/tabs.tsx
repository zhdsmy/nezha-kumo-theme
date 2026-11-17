import { cn } from "@/lib/utils"
import { Tabs as KumoTabs, type TabsItem, type TabsProps as KumoTabsProps } from "@cloudflare/kumo"
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
        }, [activeValue, items.length])

        const isSegmented = variant === "segmented"

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
                        scrollStart: labels?.scrollStart ?? t("ScrollTabsLeft"),
                        scrollEnd: labels?.scrollEnd ?? t("ScrollTabsRight"),
                    }}
                />
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
