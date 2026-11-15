import { cn } from "@/lib/utils"
import * as SwitchPrimitives from "@radix-ui/react-switch"
import { ComponentPropsWithoutRef, ComponentRef, forwardRef } from "react"

const Switch = forwardRef<
    ComponentRef<typeof SwitchPrimitives.Root>,
    ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
    <SwitchPrimitives.Root
        className={cn(
            "peer inline-flex h-4.5 w-9 shrink-0 cursor-pointer items-center rounded-[5px] supports-[corner-shape:squircle]:rounded-[10px] [corner-shape:squircle] ring-1 ring-border transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-kumo-fill",
            className,
        )}
        {...props}
        ref={ref}
    >
        <SwitchPrimitives.Thumb
            className={cn(
                "pointer-events-none block size-4.5 rounded-[5px] supports-[corner-shape:squircle]:rounded-[10px] [corner-shape:squircle] bg-kumo-base shadow-xs ring-0 transition-transform duration-150 motion-reduce:transition-none data-[state=checked]:translate-x-4.5 data-[state=unchecked]:translate-x-0",
            )}
        />
    </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
