import { updateServer } from "@/api/server"
import { PrivateNoteEditor } from "@/components/private-note/editor"
import { PublicNoteEditor } from "@/components/public-note/editor"
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
import { Textarea } from "@/components/ui/textarea"
import { IconButton } from "@/components/xui/icon-button"
import { useSubmitLock } from "@/hooks/useSubmitLock"
import { withCollectionDefaults } from "@/lib/form"
import i18n from "@/lib/i18n"
import { detectNoteMode, prepareJsonNote } from "@/lib/json-note"
import { privateNoteErrors } from "@/lib/private-note"
import { preparePublicNote } from "@/lib/public-note"
import { asOptionalField, conv, errorMessage } from "@/lib/utils"
import { ModelServer } from "@/types"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRef, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { KeyedMutator } from "swr"
import { z } from "zod"

interface ServerCardProps {
    data: ModelServer
    routes?: string[]
    mutate: KeyedMutator<ModelServer[]>
}

const serverFormSchema = z.object({
    name: z.string().min(1),
    note: asOptionalField(z.string()),
    public_note: asOptionalField(z.string()),
    display_index: z.coerce.number().int(),
    hide_for_guest: asOptionalField(z.boolean()),
    enable_ddns: asOptionalField(z.boolean()),
    ddns_profiles: asOptionalField(z.array(z.number())),
    ddns_profiles_raw: asOptionalField(z.string()),
    override_ddns_domains: asOptionalField(z.record(z.string(), z.array(z.string()))),
    override_ddns_domains_raw: asOptionalField(
        z.string().refine(
            (val) => {
                try {
                    JSON.parse(val)
                    return true
                } catch {
                    return false
                }
            },
            {
                error: () => i18n.t("Validation.InvalidJSON"),
            },
        ),
    ),
})

export const ServerCard: React.FC<ServerCardProps> = ({ data, mutate, routes }) => {
    data = withCollectionDefaults(data, ["ddns_profiles"], ["override_ddns_domains"])
    const { t } = useTranslation()
    const form = useForm({
        resolver: zodResolver(serverFormSchema) as any,
        defaultValues: {
            ...data,
            ddns_profiles_raw: data.ddns_profiles ? conv.arrToStr(data.ddns_profiles) : undefined,
            override_ddns_domains_raw: data.override_ddns_domains
                ? JSON.stringify(data.override_ddns_domains)
                : undefined,
        },
        resetOptions: {
            keepDefaultValues: false,
        },
    })
    const enableDDNS = useWatch({ control: form.control, name: "enable_ddns" })

    const [open, setOpen] = useState(false)

    const [privateNoteRaw, setPrivateNoteRaw] = useState(data?.note ?? "")
    const [privateNoteMode, setPrivateNoteMode] = useState(detectNoteMode(data?.note ?? ""))
    const [privateNoteValid, setPrivateNoteValid] = useState(true)
    const formRef = useRef<HTMLFormElement>(null)
    const showNoteError = () => {
        toast.error(t("Validation.InvalidForm"), { description: t("PrivateNote.CheckErrors") })
        formRef.current
            ?.querySelector<HTMLElement>(
                '[data-private-note-editor] [aria-invalid="true"], [data-private-note-editor] input:invalid',
            )
            ?.focus()
    }

    const [publicNoteRaw, setPublicNoteRaw] = useState(data?.public_note ?? "")
    const [publicNoteMode, setPublicNoteMode] = useState(detectNoteMode(data?.public_note))

    const { submitting, runSubmit } = useSubmitLock()

    const onSubmit = runSubmit(async (values: any) => {
        if (
            privateNoteMode === "structured" &&
            (!privateNoteValid ||
                privateNoteErrors(privateNoteRaw).length ||
                formRef.current?.querySelector('[data-private-note-editor] [aria-invalid="true"]'))
        ) {
            showNoteError()
            return
        }
        try {
            values.note = prepareJsonNote(privateNoteRaw, privateNoteMode)
            values.ddns_profiles = values.ddns_profiles_raw
                ? conv.strToArr(values.ddns_profiles_raw).map(Number)
                : undefined
            values.override_ddns_domains = values.override_ddns_domains_raw
                ? JSON.parse(values.override_ddns_domains_raw)
                : undefined

            values.public_note = preparePublicNote(publicNoteRaw, publicNoteMode)

            await updateServer(data!.id!, values)
        } catch (e) {
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

    const handleOpenChange = (v: boolean) => {
        if (v) {
            form.reset({
                ...data,
                ddns_profiles_raw: data.ddns_profiles
                    ? conv.arrToStr(data.ddns_profiles)
                    : undefined,
                override_ddns_domains_raw: data.override_ddns_domains
                    ? JSON.stringify(data.override_ddns_domains)
                    : undefined,
            })
            setPrivateNoteRaw(data?.note ?? "")
            setPrivateNoteMode(detectNoteMode(data?.note ?? ""))
            setPrivateNoteValid(true)
            setPublicNoteRaw(data?.public_note ?? "")
            setPublicNoteMode(detectNoteMode(data?.public_note))
        }
        setOpen(v)
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <IconButton variant="outline" icon="edit" />
            </DialogTrigger>
            <DialogContent
                className="sm:max-w-xl"
                onInteractOutside={(e) => e.preventDefault()}
                onEscapeKeyDown={(e) => e.preventDefault()}
            >
                <div className="nkt-dialog-form">
                    <div className="items-center mx-1">
                        <DialogHeader>
                            <DialogTitle>{t("EditServer")}</DialogTitle>
                            <DialogDescription />
                        </DialogHeader>
                        <Form {...form}>
                            <form
                                ref={formRef}
                                onInvalid={(event) => {
                                    if (
                                        (event.target as HTMLElement).closest(
                                            "[data-private-note-editor]",
                                        )
                                    ) {
                                        event.preventDefault()
                                        showNoteError()
                                    }
                                }}
                                onSubmit={form.handleSubmit(onSubmit)}
                                className="space-y-2 my-2"
                            >
                                <div className="grid grid-cols-[1fr_6.5rem] items-end gap-3">
                                    <FormField
                                        control={form.control}
                                        name="name"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="block truncate">
                                                    {t("Name")}
                                                </FormLabel>
                                                <FormControl>
                                                    <Input
                                                        placeholder={t("Placeholders.ServerName")}
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="display_index"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel
                                                    className="block truncate"
                                                    title={t("Weight")}
                                                >
                                                    {t("Weight")}
                                                </FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        placeholder="0"
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <div className="flex flex-wrap gap-x-6 gap-y-2 py-1">
                                    <FormField
                                        control={form.control}
                                        name="enable_ddns"
                                        render={({ field }) => (
                                            <FormItem className="flex items-center space-y-0">
                                                <div className="flex items-center gap-2">
                                                    <FormControl>
                                                        <Checkbox
                                                            checked={field.value}
                                                            onCheckedChange={field.onChange}
                                                        />
                                                    </FormControl>
                                                    <FormLabel className="text-sm cursor-pointer">
                                                        {t("EnableDDNS")}
                                                    </FormLabel>
                                                </div>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="hide_for_guest"
                                        render={({ field }) => (
                                            <FormItem className="flex items-center space-y-0">
                                                <div className="flex items-center gap-2">
                                                    <FormControl>
                                                        <Checkbox
                                                            checked={field.value}
                                                            onCheckedChange={field.onChange}
                                                        />
                                                    </FormControl>
                                                    <FormLabel className="text-sm cursor-pointer">
                                                        {t("HideForGuest")}
                                                    </FormLabel>
                                                </div>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                {enableDDNS ? (
                                    <>
                                        <FormField
                                            control={form.control}
                                            name="ddns_profiles_raw"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>
                                                        {t("DDNSProfiles") + t("SeparateWithComma")}
                                                    </FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="1,2,3" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="override_ddns_domains_raw"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>
                                                        {t("OverrideDDNSDomains")}
                                                    </FormLabel>
                                                    <FormControl>
                                                        <Textarea className="resize-y" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </>
                                ) : (
                                    <></>
                                )}

                                <PrivateNoteEditor
                                    value={privateNoteRaw}
                                    onChange={(value, mode) => {
                                        setPrivateNoteRaw(value)
                                        if (mode) setPrivateNoteMode(mode)
                                    }}
                                    onValidityChange={setPrivateNoteValid}
                                />
                                <PublicNoteEditor
                                    value={publicNoteRaw}
                                    onChange={(value, mode) => {
                                        setPublicNoteRaw(value)
                                        if (mode) setPublicNoteMode(mode)
                                    }}
                                    routes={routes}
                                />
                                <DialogFooter className="justify-end">
                                    <DialogClose asChild>
                                        <Button type="button" className="my-2" variant="secondary">
                                            {t("Close")}
                                        </Button>
                                    </DialogClose>
                                    <Button type="submit" className="my-2" loading={submitting}>
                                        {t("Submit")}
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
