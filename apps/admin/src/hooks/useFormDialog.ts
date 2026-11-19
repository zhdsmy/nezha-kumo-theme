import { useState } from "react"
import { type DefaultValues, type FieldValues, type Resolver, useForm } from "react-hook-form"

export function useFormDialog<T extends FieldValues, Output = T>(
    editing: boolean,
    options: { defaultValues: DefaultValues<T>; resolver: Resolver<T, unknown, Output> },
) {
    const form = useForm<T, unknown, Output>(options)
    const [session, setSession] = useState<symbol | null>(null)
    function onOpenChange(next: boolean) {
        if (next) {
            if (editing) form.reset(options.defaultValues)
            setSession(Symbol())
        } else {
            // A pending save can finish after the user opens another session.
            setSession((current) => (current === session ? null : current))
        }
    }
    return { form, open: session !== null, onOpenChange }
}
