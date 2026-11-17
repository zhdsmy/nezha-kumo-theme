import { Input, InputProps } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { Eye, EyeOff } from "lucide-react"
import { forwardRef, useState } from "react"
import { useTranslation } from "react-i18next"

export type PasswordInputProps = Omit<InputProps, "type">

const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
    ({ className, disabled, ...props }, ref) => {
        const { t } = useTranslation()
        const [visible, setVisible] = useState(false)
        const label = visible ? t("HidePassword") : t("ShowPassword")

        return (
            <div className="relative w-full">
                <Input
                    ref={ref}
                    type={visible ? "text" : "password"}
                    disabled={disabled}
                    className={cn("pr-9", className)}
                    {...props}
                />
                <button
                    type="button"
                    disabled={disabled}
                    aria-label={label}
                    title={label}
                    onClick={() => setVisible((v) => !v)}
                    className="absolute inset-y-1 right-1 inline-flex w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                >
                    {visible ? (
                        <EyeOff className="size-4" aria-hidden="true" />
                    ) : (
                        <Eye className="size-4" aria-hidden="true" />
                    )}
                </button>
            </div>
        )
    },
)
PasswordInput.displayName = "PasswordInput"

export { PasswordInput }
