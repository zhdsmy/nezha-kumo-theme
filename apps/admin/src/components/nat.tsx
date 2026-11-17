import { createNAT, updateNAT } from "@/api/nat"
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
import { useSubmitLock } from "@/hooks/useSubmitLock"
import { errorMessage } from "@/lib/utils"
import { ModelNAT } from "@/types"
import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { KeyedMutator } from "swr"
import { z } from "zod"

import { Checkbox } from "./ui/checkbox"

interface NATCardProps {
    data?: ModelNAT
    mutate: KeyedMutator<ModelNAT[]>
}

const natFormSchema = z.object({
    name: z.string().min(1),
    enabled: z.boolean(),
    server_id: z.coerce.number().int(),
    host: z.string(),
    domain: z.string(),
})

type NatFormInput = z.input<typeof natFormSchema>
type NatFormData = z.output<typeof natFormSchema>

export const NATCard: React.FC<NATCardProps> = ({ data, mutate }) => {
    const { t } = useTranslation()
    const form = useForm<NatFormInput, unknown, NatFormData>({
        resolver: zodResolver(natFormSchema),
        defaultValues: data
            ? {
                  name: data.name ?? "",
                  enabled: data.enabled ?? false,
                  server_id: data.server_id ?? 0,
                  host: data.host ?? "",
                  domain: data.domain ?? "",
              }
            : {
                  name: "",
                  enabled: false,
                  server_id: 0,
                  host: "",
                  domain: "",
              },
        resetOptions: {
            keepDefaultValues: false,
        },
    })

    const [open, setOpen] = useState(false)
    const { submitting, runSubmit } = useSubmitLock()

    const onSubmit = runSubmit(async (values: NatFormData) => {
        try {
            if (data?.id) {
                await updateNAT(data.id, values)
            } else {
                await createNAT(values)
            }
        } catch (e: unknown) {
            console.error(e)
            toast.error(t("Error"), {
                description: errorMessage(e, t("Results.UnExpectedError")),
            })
            return
        }
        setOpen(false)
        await mutate()
        form.reset()
    })

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {data ? <IconButton variant="outline" icon="edit" /> : <IconButton icon="plus" />}
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
                <div className="nkt-dialog-form">
                    <div className="items-center mx-1">
                        <DialogHeader>
                            <DialogTitle>{data ? t("EditNAT") : t("CreateNAT")}</DialogTitle>
                            <DialogDescription />
                        </DialogHeader>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2 my-2">
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t("Name")}</FormLabel>
                                            <FormControl>
                                                <Input placeholder={t("Placeholders.NATName")} {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="server_id"
                                    render={({ field }) => {
                                        const { value, ...fieldProps } = field
                                        return (
                                            <FormItem>
                                                <FormLabel>{t("Server")} ID</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        placeholder="1"
                                                        value={String(value ?? "")}
                                                        {...fieldProps}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )
                                    }}
                                />
                                <FormField
                                    control={form.control}
                                    name="host"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t("LocalService")}</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder={t("Placeholders.LocalService")}
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="domain"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t("BindHostname")}</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="router.app.yourdomain.com"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="enabled"
                                    render={({ field }) => (
                                        <FormItem className="flex items-center space-x-2">
                                            <div className="flex items-center gap-2">
                                                <FormControl>
                                                    <Checkbox
                                                        checked={field.value === true}
                                                        onCheckedChange={field.onChange}
                                                    />
                                                </FormControl>
                                                <FormLabel className="text-sm cursor-pointer">
                                                    {t("Enable")}
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
