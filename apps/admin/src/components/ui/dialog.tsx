import { FormErrors } from "@/components/ui/form"
import { useMediaQuery } from "@/hooks/useMediaQuery"
import { cn } from "@/lib/utils"
import { BREAKPOINTS } from "@nezha-kumo/ui"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { ComponentPropsWithoutRef, ComponentRef, HTMLAttributes, forwardRef } from "react"
import { useTranslation } from "react-i18next"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = forwardRef<
    ComponentRef<typeof DialogPrimitive.Overlay>,
    ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Overlay
        ref={ref}
        className={cn(
            "fixed inset-0 z-50 bg-kumo-overlay/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            className,
        )}
        {...props}
    />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

type DialogContentProps = ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    hideCloseButton?: boolean
}

const DialogContent = forwardRef<ComponentRef<typeof DialogPrimitive.Content>, DialogContentProps>(
    ({ className, children, hideCloseButton = false, ...props }, ref) => {
        const sheet = !useMediaQuery(`(min-width: ${BREAKPOINTS.gutter}px)`)
        const { t } = useTranslation()
        return (
            <DialogPortal>
                <DialogOverlay />
                <DialogPrimitive.Content
                    ref={ref}
                    data-layout={sheet ? "sheet" : "dialog"}
                    className={cn(
                        "nkt-dialog max-w-lg fixed z-50 flex flex-col gap-4 border bg-card p-6 shadow-lg duration-150 motion-reduce:animate-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
                        className,
                    )}
                    {...props}
                >
                    {children}
                    {!hideCloseButton && (
                        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
                            <X className="h-4 w-4" />
                            <span className="sr-only">{t("Close")}</span>
                        </DialogPrimitive.Close>
                    )}
                </DialogPrimitive.Content>
            </DialogPortal>
        )
    },
)
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
    <div className={cn("flex flex-col space-y-1.5 pr-8 text-left", className)} {...props} />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) => (
    <div
        className={cn(
            "nkt-dialog-footer sticky z-10 mt-auto flex shrink-0 flex-row flex-wrap justify-end gap-2 border-t bg-card pt-3",
            className,
        )}
        {...props}
    >
        <FormErrors />
        {children}
    </div>
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = forwardRef<
    ComponentRef<typeof DialogPrimitive.Title>,
    ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Title
        ref={ref}
        className={cn("text-lg font-semibold leading-6 tracking-tight", className)}
        {...props}
    />
))
DialogTitle.displayName = "DialogTitle"

const DialogDescription = forwardRef<
    ComponentRef<typeof DialogPrimitive.Description>,
    ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Description
        ref={ref}
        className={cn("text-sm text-muted-foreground", className)}
        {...props}
    />
))
DialogDescription.displayName = "DialogDescription"

export {
    Dialog,
    DialogPortal,
    DialogOverlay,
    DialogClose,
    DialogTrigger,
    DialogContent,
    DialogHeader,
    DialogFooter,
    DialogTitle,
    DialogDescription,
}
