import { Switch as KumoSwitch } from "@cloudflare/kumo"
import { ButtonHTMLAttributes, ComponentPropsWithoutRef, forwardRef, useState } from "react"

type KumoSwitchProps = ComponentPropsWithoutRef<typeof KumoSwitch>

export interface SwitchProps
    extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
    checked?: boolean
    defaultChecked?: boolean
    onCheckedChange?: (checked: boolean) => void
    disabled?: boolean
    required?: boolean
    size?: KumoSwitchProps["size"]
    variant?: KumoSwitchProps["variant"]
    label?: KumoSwitchProps["label"]
    labelTooltip?: KumoSwitchProps["labelTooltip"]
    controlFirst?: boolean
    transitioning?: boolean
}

const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
    (
        {
            checked,
            defaultChecked,
            onCheckedChange,
            variant = "neutral",
            ...props
        },
        ref,
    ) => {
        const [uncontrolledChecked, setUncontrolledChecked] = useState(defaultChecked ?? false)
        const isControlled = checked !== undefined
        const effectiveChecked = isControlled ? checked : uncontrolledChecked

        return (
            <KumoSwitch
                ref={ref}
                variant={variant}
                checked={effectiveChecked}
                onCheckedChange={(next) => {
                    if (!isControlled) {
                        setUncontrolledChecked(next)
                    }
                    onCheckedChange?.(next)
                }}
                {...props}
            />
        )
    },
)
Switch.displayName = "Switch"

export { Switch }
