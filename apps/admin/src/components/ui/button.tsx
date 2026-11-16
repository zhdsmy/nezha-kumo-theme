import { cn } from "@/lib/utils"
import { Slot } from "@radix-ui/react-slot"
import { type VariantProps, cva } from "class-variance-authority"
import { ButtonHTMLAttributes, forwardRef } from "react"

const buttonVariants = cva(
    "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg text-base leading-5 font-medium transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
    {
        variants: {
            variant: {
                default: "nkt-emphasis border border-primary text-primary-foreground shadow-xs",
                destructive:
                    "nkt-emphasis nkt-emphasis-danger border border-destructive text-destructive-foreground shadow-xs",
                outline:
                    "border border-input bg-card hover:bg-accent hover:text-accent-foreground shadow-xs",
                secondary:
                    "border border-border bg-secondary text-secondary-foreground hover:bg-accent shadow-xs",
                ghost: "hover:bg-accent hover:text-accent-foreground",
                link: "text-kumo-link underline-offset-4 hover:underline",
            },
            size: {
                default: "h-9 px-3 py-2",
                sm: "h-6.5 rounded-md px-2 text-xs leading-4",
                lg: "h-10 px-4",
                icon: "size-9",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    },
)

export interface ButtonProps
    extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
    asChild?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : "button"
        return (
            <Comp
                className={cn(buttonVariants({ variant, size, className }))}
                ref={ref}
                {...props}
            />
        )
    },
)
Button.displayName = "Button"

export { Button, buttonVariants }
