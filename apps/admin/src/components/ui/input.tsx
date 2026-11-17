import { cn } from "@/lib/utils"
import { Input as KumoInput, type InputProps as KumoInputProps } from "@cloudflare/kumo"
import { InputHTMLAttributes, forwardRef } from "react"

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
    size?: KumoInputProps["size"]
    label?: KumoInputProps["label"]
    labelTooltip?: KumoInputProps["labelTooltip"]
    description?: KumoInputProps["description"]
    error?: KumoInputProps["error"]
    passwordManagerIgnore?: boolean
}

const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ className, type, label, "aria-label": ariaLabel, "aria-labelledby": ariaLabelledBy, ...props }, ref) => {
        const inferredLabelledBy =
            !label &&
            !ariaLabel &&
            !ariaLabelledBy &&
            typeof props.id === "string" &&
            props.id.endsWith("-form-item")
                ? `${props.id}-label`
                : ariaLabelledBy

        return (
            <KumoInput
                ref={ref}
                type={type}
                label={label}
                aria-label={ariaLabel}
                aria-labelledby={inferredLabelledBy}
                className={cn(
                    "w-full min-w-0 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground aria-invalid:ring-kumo-danger aria-invalid:focus:ring-kumo-danger/50 disabled:cursor-not-allowed disabled:opacity-50",
                    className,
                )}
                {...props}
            />
        )
    },
)
Input.displayName = "Input"

export { Input }
