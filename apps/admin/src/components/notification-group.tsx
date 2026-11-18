import { createNotificationGroup, updateNotificationGroup } from "@/api/notification-group"
import { Button } from "@/components/ui/button"
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
import { IconButton } from "@/components/xui/icon-button"
import { MultiSelect } from "@/components/xui/multi-select"
import { useNotification } from "@/hooks/useNotfication"
import { useFormDialog } from "@/hooks/useFormDialog"
import { useSubmitLock } from "@/hooks/useSubmitLock"
import { withCollectionDefaults } from "@/lib/form"
import { errorMessage } from "@/lib/utils"
import { ModelNotificationGroupResponseItem } from "@/types"
import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslation } from "react-i18next"
import { KeyedMutator } from "swr"
import { z } from "zod"

interface NotificationGroupCardProps {
    data?: ModelNotificationGroupResponseItem
    mutate: KeyedMutator<ModelNotificationGroupResponseItem[]>
}

const notificationGroupFormSchema = z.object({
    name: z.string().min(1),
    notifications: z.array(z.number()),
})

export const NotificationGroupCard: React.FC<NotificationGroupCardProps> = ({ data, mutate }) => {
    data = data && withCollectionDefaults(data, ["notifications"])
    const { t } = useTranslation()
    const { form, open, onOpenChange } = useFormDialog<z.infer<typeof notificationGroupFormSchema>>(!!data, {
        resolver: zodResolver(notificationGroupFormSchema),
        defaultValues: data
            ? {
                  name: data.group.name,
                  notifications: data.notifications,
              }
            : {
                  name: "",
                  notifications: [],
              },
    })

    const { submitting, runSubmit, showError, dismissError } = useSubmitLock()

    const onSubmit = runSubmit(async (values: z.infer<typeof notificationGroupFormSchema>) => {
        try {
            if (data?.group.id) {
                await updateNotificationGroup(data.group.id, values)
            } else {
                await createNotificationGroup(values)
            }
        } catch (e) {
            console.error(e)
            showError(t("Error"), {
                description: errorMessage(e, t("Results.UnExpectedError")),
            })
            return
        }
        await mutate()
        if (!data) form.reset()
        onOpenChange(false)
    })

    const { notifiers } = useNotification()
    const notifierList = notifiers?.map((n) => ({
        value: `${n.id}`,
        label: n.name,
    })) || [{ value: "", label: "" }]

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogTrigger asChild>
                {data ? <IconButton variant="outline" icon="edit" /> : <IconButton icon="plus" />}
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
                <div className="nkt-dialog-form">
                    <div className="items-center mx-1">
                        <DialogHeader>
                            <DialogTitle>
                                {data ? t("EditNotifierGroup") : t("CreateNotifierGroup")}
                            </DialogTitle>
                            <DialogDescription />
                        </DialogHeader>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit, dismissError)} className="space-y-2 my-2">
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t("Name")}</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder={t("Placeholders.GroupName")}
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="notifications"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t("Notification")}</FormLabel>
                                            <MultiSelect
                                                options={notifierList}
                                                onValueChange={(e) => {
                                                    const arr = e.map(Number)
                                                    field.onChange(arr)
                                                }}
                                                defaultValue={field.value?.map(String)}
                                            />
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
