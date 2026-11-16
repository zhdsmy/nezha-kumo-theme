import { cn } from "@/lib/utils"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { ComponentPropsWithoutRef, ComponentRef, forwardRef } from "react"

const Tabs = TabsPrimitive.Root

const TabsList = forwardRef<
    ComponentRef<typeof TabsPrimitive.List>,
    ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
    <TabsPrimitive.List
        ref={ref}
        className={cn(
            "inline-flex h-9 max-w-full items-center justify-start overflow-x-auto rounded-lg bg-muted px-0.5 text-muted-foreground",
            className,
        )}
        {...props}
    />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = forwardRef<
    ComponentRef<typeof TabsPrimitive.Trigger>,
    ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
    <TabsPrimitive.Trigger
        ref={ref}
        className={cn(
            "inline-flex h-8 shrink-0 items-center justify-center whitespace-nowrap rounded-md px-2.5 py-1 text-base font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm",
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
