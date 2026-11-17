import { Badge as KumoBadge, type BadgeVariant as KumoBadgeVariant } from "@cloudflare/kumo"
import { type VariantProps, cva } from "class-variance-authority"
import { HTMLAttributes } from "react"

const badgeVariants = cva(
    "inline-flex w-fit flex-none shrink-0 items-center justify-self-start gap-1 rounded-full px-2 py-0.5 text-xs/4 font-medium whitespace-nowrap",
    {
    variants: {
        variant: {
            default: "bg-kumo-badge-inverted text-kumo-badge-inverted",
            secondary: "bg-kumo-fill text-kumo-badge-neutral-subtle",
            destructive: "bg-kumo-danger-tint text-kumo-danger",
            outline: "border border-kumo-fill bg-kumo-base text-kumo-default",
        },
    },
    defaultVariants: {
        variant: "default",
    },
})

type AdminBadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>

const KUMO_VARIANT_MAP: Record<AdminBadgeVariant, KumoBadgeVariant> = {
    default: "primary",
    secondary: "secondary",
    destructive: "error",
    outline: "outline",
}

export interface BadgeProps
    extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, children, ...props }: BadgeProps) {
    const kumoVariant = KUMO_VARIANT_MAP[variant ?? "default"]
    const badge = (
        <KumoBadge variant={kumoVariant} className={className}>
            {children}
        </KumoBadge>
    )
    if (Object.keys(props).length === 0) {
        return badge
    }
    return (
        <span className="inline-flex" {...props}>
            {badge}
        </span>
    )
}

export { Badge, badgeVariants }
