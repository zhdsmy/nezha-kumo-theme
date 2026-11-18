import { getProfile, updateProfile } from "@/api/user"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { useMainStore } from "@/hooks/useMainStore"
import { useSubmitLock } from "@/hooks/useSubmitLock"
import { asOptionalField, errorMessage } from "@/lib/utils"
import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { z } from "zod"

const profileFormSchema = z.object({
    original_password: z.string().min(5).max(72),
    new_password: z.string().min(8).max(72),
    new_username: z.string().min(1).max(32),
    reject_password: asOptionalField(z.boolean()),
})

export const ProfileCard = ({ className }: { className: string }) => {
    const { t } = useTranslation()
    const { profile, setProfile } = useMainStore()

    const form = useForm({
        resolver: zodResolver(profileFormSchema) as any,
        defaultValues: {
            original_password: "",
            new_password: "",
            new_username: profile?.username,
            reject_password: profile?.reject_password,
        },
        resetOptions: {
            keepDefaultValues: false,
        },
    })

    const [open, setOpen] = useState(false)
    const { submitting, runSubmit, showError, dismissError } = useSubmitLock()

    const onSubmit = runSubmit(async (values: any) => {
        try {
            await updateProfile(values)
            const nextProfile = await getProfile()
            setProfile(nextProfile)
        } catch (e) {
            console.error(e)
            showError(t("Error"), {
                description: errorMessage(e, t("Results.UnExpectedError")),
            })
            return
        }
        setOpen(false)
        form.reset()
    })

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className={className}>
                    {t("UpdateProfile")}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
                <div className="nkt-dialog-form">
                    <div className="items-center mx-1">
                        <DialogHeader>
                            <DialogTitle>{t("UpdateProfile")}</DialogTitle>
                            <DialogDescription />
                        </DialogHeader>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit, dismissError)} className="space-y-2 my-2">
                                <FormField
                                    control={form.control}
                                    name="new_username"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t("NewUsername")}</FormLabel>
                                            <FormControl>
                                                <Input autoComplete="username" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="original_password"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t("OriginalPassword")}</FormLabel>
                                            <FormControl>
                                                <PasswordInput
                                                    autoComplete="current-password"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="new_password"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t("NewPassword")}</FormLabel>
                                            <FormControl>
                                                <PasswordInput
                                                    autoComplete="new-password"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="reject_password"
                                    render={({ field }) => (
                                        <FormItem className="flex items-center space-x-2">
                                            <div className="flex items-center gap-2">
                                                <FormControl>
                                                    <Checkbox
                                                        checked={field.value}
                                                        onCheckedChange={field.onChange}
                                                    />
                                                </FormControl>
                                                <FormLabel className="text-sm cursor-pointer">
                                                    {t("RejectPassword")}
                                                </FormLabel>
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <DialogFooter className="justify-end">
                                    <DialogClose asChild>
                                        <Button type="button" className="my-2" variant="secondary">
                                            {t("Close")}
                                        </Button>
                                    </DialogClose>
                                    <Button type="submit" className="my-2" loading={submitting}>
                                        {t("Confirm")}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
