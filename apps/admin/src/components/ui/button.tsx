import { cn } from "@/lib/utils"
import {
    Button as KumoButton,
    type ButtonProps as KumoButtonProps,
    Tooltip,
    buttonVariants as kumoButtonVariants,
} from "@cloudflare/kumo"
import { Slot } from "@radix-ui/react-slot"
import { ButtonHTMLAttributes, forwardRef } from "react"

export type ButtonVariant = "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
export type ButtonSize = "default" | "sm" | "lg" | "icon"

const LINK_CLASSES =
    "h-auto p-0 shadow-none bg-transparent hover:bg-transparent !text-kumo-link underline-offset-4 hover:underline"

const SVG_CLASSES =
    "justify-center [&_svg]:pointer-events-none [&_svg:not([role='status'])]:size-4 [&_svg]:shrink-0"

function resolveKumoVariant(variant: ButtonVariant = "default"): NonNullable<KumoButtonProps["variant"]> {
    switch (variant) {
        case "default":
            return "primary"
        case "destructive":
            return "destructive"
        case "outline":
        case "secondary":
            return "secondary"
        case "ghost":
        case "link":
            return "ghost"
    }
}

function resolveKumoSizeAndShape(size: ButtonSize = "default"): {
    size: NonNullable<KumoButtonProps["size"]>
    shape: NonNullable<KumoButtonProps["shape"]>
} {
    switch (size) {
        case "sm":
            return { size: "sm", shape: "base" }
        case "lg":
            return { size: "lg", shape: "base" }
        case "icon":
            return { size: "base", shape: "square" }
        case "default":
        default:
            return { size: "base", shape: "base" }
    }
}

function buttonVariants({
    variant = "default",
    size = "default",
    className,
}: {
    variant?: ButtonVariant | null
    size?: ButtonSize | null
    className?: string
} = {}) {
    const resolvedVariant = variant ?? "default"
    const resolvedSize = size ?? "default"
    const kumoVariant = resolveKumoVariant(resolvedVariant)
    const { size: kumoSize, shape: kumoShape } = resolveKumoSizeAndShape(resolvedSize)

    return cn(
        kumoButtonVariants({
            variant: kumoVariant,
            size: kumoSize,
            shape: kumoShape,
        }),
        SVG_CLASSES,
        resolvedVariant === "default" && "nkt-emphasis ring-primary/80",
        resolvedVariant === "destructive" && "nkt-emphasis nkt-emphasis-danger ring-destructive/80",
        resolvedVariant === "link" && LINK_CLASSES,
        className,
    )
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant | null
    size?: ButtonSize | null
    asChild?: boolean
    loading?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    (
        {
            className,
            variant = "default",
            size = "default",
            asChild = false,
            loading = false,
            disabled,
            title,
            children,
            ...props
        },
        ref,
    ) => {
        const resolvedVariant = variant ?? "default"
        const resolvedSize = size ?? "default"
        const isInert = Boolean(className?.includes("pointer-events-none"))
        const resolvedTitle =
            title ??
            (resolvedSize === "icon" && !("data-day" in props) && !isInert
                ? props["aria-label"]
                : undefined)

        if (asChild) {
            const slot = (
                <Slot
                    ref={ref}
                    aria-busy={loading || undefined}
                    className={buttonVariants({
                        variant: resolvedVariant,
                        size: resolvedSize,
                        className,
                    })}
                    {...props}
                >
                    {children}
                </Slot>
            )
            if (resolvedTitle) {
                return (
                    <Tooltip content={resolvedTitle} asChild>
                        {slot}
                    </Tooltip>
                )
            }
            return slot
        }

        const kumoVariant = resolveKumoVariant(resolvedVariant)
        const { size: kumoSize, shape: kumoShape } = resolveKumoSizeAndShape(resolvedSize)
        const mergedClassName = cn(
            SVG_CLASSES,
            resolvedVariant === "link" && LINK_CLASSES,
            className,
        )

        if (kumoShape === "square") {
            return (
                <KumoButton
                    {...props}
                    ref={ref}
                    variant={kumoVariant}
                    size={kumoSize}
                    shape="square"
                    loading={loading}
                    disabled={disabled}
                    title={resolvedTitle}
                    aria-label={props["aria-label"] ?? resolvedTitle ?? ""}
                    className={mergedClassName}
                >
                    {children}
                </KumoButton>
            )
        }

        return (
            <KumoButton
                ref={ref}
                variant={kumoVariant}
                size={kumoSize}
                shape="base"
                loading={loading}
                disabled={disabled}
                title={resolvedTitle}
                className={mergedClassName}
                {...props}
            >
                {children}
            </KumoButton>
        )
    },
)
Button.displayName = "Button"

export { Button, buttonVariants }
