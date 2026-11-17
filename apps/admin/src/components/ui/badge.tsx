import { cn } from "@/lib/utils"
import { type VariantProps, cva } from "class-variance-authority"
import { HTMLAttributes } from "react"

const badgeVariants = cva(
    "inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs leading-4 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
    {
        variants: {
            variant: {
                default: "border-border bg-card text-foreground",
                secondary: "border-border bg-muted text-secondary-foreground",
                destructive: "border-kumo-danger/20 bg-kumo-danger-tint text-kumo-danger",
                outline: "text-foreground",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    },
)

export interface BadgeProps
    extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
    return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
