import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import * as LabelPrimitive from "@radix-ui/react-label"
import { Slot } from "@radix-ui/react-slot"
import {
    ComponentPropsWithoutRef,
    ComponentRef,
    HTMLAttributes,
    createContext,
    forwardRef,
    useContext,
    useEffect,
    useId,
    useRef,
} from "react"
import {
    Controller,
    ControllerProps,
    FieldPath,
    FieldValues,
    FormProvider,
    useFormContext,
} from "react-hook-form"

import { toast } from "sonner"

const Form = FormProvider

export function scrollFieldIntoContainer(container: HTMLElement, control: HTMLElement) {
    if (control === container || !container.contains(control)) return
    const item = control.closest<HTMLElement>("[data-form-item]")
    const field = control.getBoundingClientRect()
    const itemRect = item?.getBoundingClientRect()
    const topEdge = itemRect ? Math.min(itemRect.top, field.top) : field.top
    const bottomEdge = itemRect ? Math.max(itemRect.bottom, field.bottom) : field.bottom
    const bounds = container.getBoundingClientRect()
    const pad = 16
    // The dialog's pinned action bar covers the bottom of the scroller.
    const footer = container.querySelector<HTMLElement>(".nkt-dialog-footer")
    const bottom =
        footer && !footer.contains(control)
            ? Math.min(bounds.bottom, footer.getBoundingClientRect().top)
            : bounds.bottom
    if (topEdge < bounds.top + pad) {
        container.scrollTop += topEdge - bounds.top - pad
    } else if (bottomEdge > bottom - pad) {
        const delta = Math.min(
            bottomEdge - bottom + pad,
            Math.max(0, topEdge - (bounds.top + pad)),
        )
        container.scrollTop += delta
    }
}

function FormErrors() {
    const context = useFormContext()
    const errors = context?.formState.errors
    const submitCount = context?.formState.submitCount
    const summary = useRef<HTMLParagraphElement>(null)
    const hasErrors = !!errors && Object.keys(errors).length > 0
    useEffect(() => {
        if (!submitCount || !hasErrors || !summary.current) return
        toast.dismiss?.()
        const dialog = summary.current.closest<HTMLElement>('[role="dialog"]')
        const scope = dialog ?? summary.current.closest("form") ?? document
        const invalidControl = scope.querySelector<HTMLElement>('[aria-invalid="true"]')
        if (invalidControl) {
            if (document.activeElement !== invalidControl) {
                invalidControl.focus()
            }
            if (dialog) {
                requestAnimationFrame(() => scrollFieldIntoContainer(dialog, invalidControl))
            }
            return
        }
        summary.current.focus()
    }, [submitCount, hasErrors])
    if (!hasErrors) return null
    const messages = (value: object): string[] =>
        Object.entries(value).flatMap(([key, error]) => {
            if (key === "ref" || !error || typeof error !== "object") return []
            return typeof error.message === "string" ? [error.message] : messages(error)
        })
    return (
        <p ref={summary} tabIndex={-1} role="alert" className="basis-full text-sm text-destructive">
            {[...new Set(messages(errors))].join("; ")}
        </p>
    )
}

type FormFieldContextValue<
    TFieldValues extends FieldValues = FieldValues,
    TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = {
    name: TName
}

const FormFieldContext = createContext<FormFieldContextValue>({} as FormFieldContextValue)

const FormField = <
    TFieldValues extends FieldValues = FieldValues,
    TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
    ...props
}: ControllerProps<TFieldValues, TName>) => {
    return (
        <FormFieldContext.Provider value={{ name: props.name }}>
            <Controller {...props} />
        </FormFieldContext.Provider>
    )
}

const useFormField = () => {
    const fieldContext = useContext(FormFieldContext)
    const itemContext = useContext(FormItemContext)
    const { getFieldState, formState } = useFormContext()

    const fieldState = getFieldState(fieldContext.name, formState)

    if (!fieldContext) {
        throw new Error("useFormField should be used within <FormField>")
    }

    const { id } = itemContext

    return {
        id,
        name: fieldContext.name,
        formItemId: `${id}-form-item`,
        formDescriptionId: `${id}-form-item-description`,
        formMessageId: `${id}-form-item-message`,
        ...fieldState,
    }
}

type FormItemContextValue = {
    id: string
}

const FormItemContext = createContext<FormItemContextValue>({} as FormItemContextValue)

const FormItem = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => {
        const id = useId()

        return (
            <FormItemContext.Provider value={{ id }}>
                <div
                    ref={ref}
                    data-form-item=""
                    className={cn("space-y-2", className)}
                    {...props}
                />
            </FormItemContext.Provider>
        )
    },
)
FormItem.displayName = "FormItem"

const FormLabel = forwardRef<
    ComponentRef<typeof LabelPrimitive.Root>,
    ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, id, ...props }, ref) => {
    const { error, formItemId } = useFormField()

    return (
        <Label
            ref={ref}
            id={id ?? `${formItemId}-label`}
            className={cn(error && "text-destructive", className)}
            htmlFor={formItemId}
            {...props}
        />
    )
})
FormLabel.displayName = "FormLabel"

const FormControl = forwardRef<ComponentRef<typeof Slot>, ComponentPropsWithoutRef<typeof Slot>>(
    ({ ...props }, ref) => {
        const { error, formItemId, formDescriptionId, formMessageId } = useFormField()

        return (
            <Slot
                ref={ref}
                id={formItemId}
                aria-describedby={
                    !error ? `${formDescriptionId}` : `${formDescriptionId} ${formMessageId}`
                }
                aria-invalid={!!error}
                {...props}
            />
        )
    },
)
FormControl.displayName = "FormControl"

const FormDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
    ({ className, ...props }, ref) => {
        const { formDescriptionId } = useFormField()

        return (
            <p
                ref={ref}
                id={formDescriptionId}
                className={cn("text-sm text-muted-foreground", className)}
                {...props}
            />
        )
    },
)
FormDescription.displayName = "FormDescription"

const FormMessage = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
    ({ className, children, ...props }, ref) => {
        const { error, formMessageId } = useFormField()
        const body = error ? String(error?.message) : children

        if (!body) {
            return null
        }

        return (
            <p
                ref={ref}
                id={formMessageId}
                className={cn("text-sm font-medium text-destructive", className)}
                {...props}
            >
                {body}
            </p>
        )
    },
)
FormMessage.displayName = "FormMessage"

export {
    useFormField,
    Form,
    FormErrors,
    FormItem,
    FormLabel,
    FormControl,
    FormDescription,
    FormMessage,
    FormField,
}
