import { cn } from "@/lib/utils"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import {
    ComponentPropsWithoutRef,
    ComponentRef,
    forwardRef,
    useLayoutEffect,
    useRef,
} from "react"

const Tabs = TabsPrimitive.Root

const TabsList = forwardRef<
    ComponentRef<typeof TabsPrimitive.List>,
    ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => {
    const innerRef = useRef<HTMLDivElement | null>(null)
    const lastSigRef = useRef("")

    useLayoutEffect(() => {
        const list = innerRef.current
        if (!list) return
        const syncScroll = () => {
            const active = list.querySelector<HTMLElement>('[data-state="active"]')
            const index = active ? Array.from(list.children).indexOf(active) : -1
            const sig = `${index}:${list.scrollWidth}:${list.clientWidth}`
            if (lastSigRef.current === sig) return
            lastSigRef.current = sig
            if (!active || list.scrollWidth <= list.clientWidth) return
            const pad = 4
            const start = active.offsetLeft
            const end = start + active.offsetWidth
            if (start - pad < list.scrollLeft) {
                list.scrollLeft = Math.max(0, start - pad)
            } else if (end + pad > list.scrollLeft + list.clientWidth) {
                list.scrollLeft = end + pad - list.clientWidth
            }
        }
        syncScroll()
        let ro: ResizeObserver | undefined
        const observeChildren = () => {
            if (!ro) return
            ro.disconnect()
            ro.observe(list)
            for (const child of Array.from(list.children)) {
                ro.observe(child)
            }
        }
        if (typeof ResizeObserver !== "undefined") {
            ro = new ResizeObserver(syncScroll)
            observeChildren()
        }
        const observer = new MutationObserver(() => {
            observeChildren()
            syncScroll()
        })
        observer.observe(list, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true,
            attributeFilter: ["data-state"],
        })
        void document.fonts?.ready?.then(syncScroll)
        return () => {
            observer.disconnect()
            ro?.disconnect()
        }
    }, [])

    return (
        <TabsPrimitive.List
            ref={(node) => {
                innerRef.current = node
                if (typeof ref === "function") ref(node)
                else if (ref) ref.current = node
            }}
            className={cn(
                "no-scrollbar relative inline-flex h-9 max-w-full items-center justify-start overflow-x-auto rounded-lg border border-border bg-muted px-0.5 text-muted-foreground",
                className,
            )}
            {...props}
        />
    )
})
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = forwardRef<
    ComponentRef<typeof TabsPrimitive.Trigger>,
    ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
    <TabsPrimitive.Trigger
        ref={ref}
        className={cn(
            "inline-flex h-7.5 shrink-0 items-center justify-center whitespace-nowrap rounded-md px-2.5 py-1 text-base font-medium ring-offset-background transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-kumo-contrast data-[state=active]:font-semibold data-[state=active]:text-kumo-inverse data-[state=active]:shadow-xs",
            className,
        )}
        {...props}
    />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = forwardRef<
    ComponentRef<typeof TabsPrimitive.Content>,
    ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
    <TabsPrimitive.Content
        ref={ref}
        className={cn(
            "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            className,
        )}
        {...props}
    />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
