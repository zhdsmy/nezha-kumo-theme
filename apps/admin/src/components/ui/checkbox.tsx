import {
    Checkbox as KumoCheckbox,
    type CheckboxProps as KumoCheckboxProps,
} from "@cloudflare/kumo"
import { ButtonHTMLAttributes, forwardRef } from "react"

export type CheckboxCheckedState = boolean | "indeterminate"

export type CheckboxProps = Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    "checked" | "defaultChecked" | "onChange"
> &
    Omit<KumoCheckboxProps, "checked" | "onCheckedChange"> & {
        checked?: CheckboxCheckedState
        defaultChecked?: CheckboxCheckedState
        onCheckedChange?: (checked: boolean) => void
    }

const Checkbox = forwardRef<HTMLButtonElement, CheckboxProps>(
    (
        {
            className,
            checked,
            defaultChecked,
            indeterminate,
            onCheckedChange,
            label,
            "aria-label": ariaLabel,
            "aria-labelledby": ariaLabelledBy,
            ...props
        },
        ref,
    ) => {
        const inferredLabelledBy =
            !label &&
            !ariaLabel &&
            !ariaLabelledBy &&
            typeof props.id === "string" &&
            props.id.endsWith("-form-item")
                ? `${props.id}-label`
                : ariaLabelledBy

        const resolvedIndeterminate =
            indeterminate ?? (checked === "indeterminate" || defaultChecked === "indeterminate")
        const resolvedChecked = checked === "indeterminate" ? false : checked
        const resolvedDefaultChecked =
            defaultChecked === "indeterminate" ? false : defaultChecked

        const extraProps: Record<string, unknown> = { ...props }
        if (resolvedDefaultChecked !== undefined) {
            extraProps.defaultChecked = resolvedDefaultChecked
        }

        return (
            <KumoCheckbox
                ref={ref}
                label={label}
                aria-label={ariaLabel}
                aria-labelledby={inferredLabelledBy}
                checked={resolvedChecked}
                indeterminate={resolvedIndeterminate}
                onCheckedChange={
                    onCheckedChange ? (next) => onCheckedChange(Boolean(next)) : undefined
                }
                className={className}
                {...(extraProps as Partial<KumoCheckboxProps>)}
            />
        )
    },
)
Checkbox.displayName = "Checkbox"

export { Checkbox }
