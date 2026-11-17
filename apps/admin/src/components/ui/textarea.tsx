import { cn } from "@/lib/utils"
import { InputArea, type InputAreaProps as KumoInputAreaProps } from "@cloudflare/kumo"
import { ComponentProps, forwardRef } from "react"

export type TextareaProps = Omit<ComponentProps<"textarea">, "size"> & {
    size?: KumoInputAreaProps["size"]
    label?: KumoInputAreaProps["label"]
    labelTooltip?: KumoInputAreaProps["labelTooltip"]
    description?: KumoInputAreaProps["description"]
    error?: KumoInputAreaProps["error"]
    autoResize?: boolean
    minRows?: number
    maxRows?: number
    onValueChange?: (value: string) => void
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
    return (
        <InputArea
            ref={ref}
            className={cn(
                "flex min-h-[80px] w-full min-w-0 aria-invalid:ring-kumo-danger aria-invalid:focus:ring-kumo-danger/50 disabled:cursor-not-allowed disabled:opacity-50",
                className,
            )}
            {...props}
        />
    )
})
Textarea.displayName = "Textarea"

export { Textarea }
