import { cn } from "@/lib/utils"
import { ComponentProps, forwardRef } from "react"

const Textarea = forwardRef<HTMLTextAreaElement, ComponentProps<"textarea">>(
    ({ className, ...props }, ref) => {
        return (
            <textarea
                className={cn(
                    "flex min-h-[80px] w-full rounded-lg border border-input bg-kumo-control px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 aria-invalid:border-destructive disabled:cursor-not-allowed disabled:opacity-50",
                    className,
                )}
                ref={ref}
                {...props}
            />
        )
    },
)
Textarea.displayName = "Textarea"

export { Textarea }
