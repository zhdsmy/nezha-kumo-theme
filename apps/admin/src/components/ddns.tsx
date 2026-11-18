import { createDDNSProfile, updateDDNSProfile } from "@/api/ddns"
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { IconButton } from "@/components/xui/icon-button"
import { useFormDialog } from "@/hooks/useFormDialog"
import { useSubmitLock } from "@/hooks/useSubmitLock"
import { asOptionalField, conv, errorMessage } from "@/lib/utils"
import { ModelDDNSProfile } from "@/types"
import { ddnsRequestTypes, ddnsTypes } from "@/types"
import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslation } from "react-i18next"
import { KeyedMutator } from "swr"
import { z } from "zod"

import { Textarea } from "./ui/textarea"

interface DDNSCardProps {
    data?: ModelDDNSProfile
    providers: string[]
    mutate: KeyedMutator<ModelDDNSProfile[]>
}

const providerSchema = z.object({
    max_retries: z.coerce.number().int().min(1),
    enable_ipv4: asOptionalField(z.boolean()),
    enable_ipv6: asOptionalField(z.boolean()),
    name: z.string().min(1),
    provider: z.string(),
    domains: z.array(z.string()),
    domains_raw: z.string(),
    access_id: asOptionalField(z.string()),
    access_secret: asOptionalField(z.string()),
})

const ddnsFormSchema = providerSchema.extend({
    webhook_url: asOptionalField(z.string().url()),
    webhook_method: asOptionalField(z.coerce.number().int().min(1).max(255)),
    webhook_request_type: asOptionalField(z.coerce.number().int().min(1).max(255)),
    webhook_request_body: asOptionalField(z.string()),
    webhook_headers: asOptionalField(z.string()),
})

type DDNSFormInput = z.input<typeof ddnsFormSchema>
type DDNSFormData = z.output<typeof ddnsFormSchema>

export const DDNSCard: React.FC<DDNSCardProps> = ({ data, providers, mutate }) => {
    const { t } = useTranslation()
    const storedWebhook = {
        webhook_url: data?.webhook_url,
        webhook_method: data?.webhook_method,
        webhook_request_type: data?.webhook_request_type,
        webhook_headers: data?.webhook_headers,
        webhook_request_body: data?.webhook_request_body,
    }
    const { form, open, onOpenChange } = useFormDialog<DDNSFormInput, DDNSFormData>(!!data, {
        resolver: (values, context, options) =>
            zodResolver(values.provider === "webhook" ? ddnsFormSchema : providerSchema)(values, context, options),
        defaultValues: {
            ...storedWebhook,
            max_retries: data?.max_retries ?? 3,
            enable_ipv4: data?.enable_ipv4 ?? false,
            enable_ipv6: data?.enable_ipv6 ?? false,
            name: data?.name ?? "",
            provider: data?.provider ?? "dummy",
            domains: data?.domains ?? [],
            domains_raw: conv.arrToStr(data?.domains),
            access_id: data?.access_id ?? "",
            access_secret: data?.access_secret ?? "",
            webhook_url: storedWebhook.webhook_url ?? "",
            webhook_headers: storedWebhook.webhook_headers ?? "",
            webhook_request_body: storedWebhook.webhook_request_body ?? "",
        },
    })

    const { submitting, runSubmit, showError, dismissError } = useSubmitLock()

    const onSubmit = runSubmit(async (values: DDNSFormData) => {
        try {
            values.domains = conv.strToArr(values.domains_raw)
            if (data?.id) {
                // The backend replaces every field on PATCH, including dormant Webhook settings.
                await updateDDNSProfile(data.id, { ...storedWebhook, ...values })
            } else {
                await createDDNSProfile(values)
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

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogTrigger asChild>
                {data ? <IconButton variant="outline" icon="edit" /> : <IconButton icon="plus" />}
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
                <div className="nkt-dialog-form">
                    <div className="items-center mx-1">
                        <DialogHeader>
                            <DialogTitle>{data ? t("EditDDNS") : t("CreateDDNS")}</DialogTitle>
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
                                                <Input placeholder={t("Placeholders.DDNSName")} {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="provider"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t("Provider")}</FormLabel>
                                            <Select
                                                onValueChange={field.onChange}
                                                value={field.value == null ? "" : String(field.value)}
                                            >
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder={t("Placeholders.SelectServiceType")} />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {providers.map((v, i) => (
                                                        <SelectItem key={i} value={v}>
                                                            {v}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="domains_raw"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>
                                                {t("Domains") + t("SeparateWithComma")}
                                            </FormLabel>
                                            <FormControl>
                                                <Input placeholder="www.example.com" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="access_id"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t("Credential")} 1</FormLabel>
                                            <FormControl>
                                                <Input placeholder={t("Placeholders.TokenID")} {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="access_secret"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t("Credential")} 2</FormLabel>
                                            <FormControl>
                                                <PasswordInput
                                                    autoComplete="off"
                                                    placeholder={t("Placeholders.TokenSecret")}
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="max_retries"
                                    render={({ field }) => {
                                        const { value, ...fieldProps } = field
                                        return (
                                            <FormItem>
                                                <FormLabel>{t("MaximumRetryAttempts")}</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        placeholder="3"
                                                        value={String(value ?? "")}
                                                        {...fieldProps}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )
                                    }}
                                />
                                {form.watch("provider") === "webhook" && (
                                    <>
                                        <FormField
                                            control={form.control}
                                            name="webhook_url"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Webhook URL</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            placeholder="https://ddns.example.com/?record=#record#"
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="webhook_method"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Webhook {t("RequestMethod")}</FormLabel>
                                                    <Select
                                                        onValueChange={field.onChange}
                                                        value={field.value == null ? "" : String(field.value)}
                                                    >
                                                        <FormControl>
                                                            <SelectTrigger>
                                                                <SelectValue placeholder={`Webhook ${t("RequestMethod")}`} />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            {Object.entries(ddnsTypes).map(([k, v]) => (
                                                                <SelectItem key={k} value={k}>
                                                                    {v}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="webhook_request_type"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Webhook {t("RequestType")}</FormLabel>
                                                    <Select
                                                        onValueChange={field.onChange}
                                                        value={field.value == null ? "" : String(field.value)}
                                                    >
                                                        <FormControl>
                                                            <SelectTrigger>
                                                                <SelectValue placeholder={`Webhook ${t("RequestType")}`} />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            {Object.entries(ddnsRequestTypes).map(
                                                                ([k, v]) => (
                                                                    <SelectItem key={k} value={k}>
                                                                        {v}
                                                                    </SelectItem>
                                                                ),
                                                            )}
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="webhook_headers"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Webhook {t("RequestHeader")}</FormLabel>
                                                    <FormControl>
                                                        <Textarea
                                                            className="resize-y"
                                                            placeholder='{"User-Agent":"Nezha-Agent"}'
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="webhook_request_body"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Webhook {t("RequestBody")}</FormLabel>
                                                    <FormControl>
                                                        <Textarea
                                                            className="resize-y"
                                                            placeholder='{&#13;&#10; "ip": #ip#,&#13;&#10; "domain": "#domain#"&#13;&#10;}'
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </>
                                )}
                                <FormField
                                    control={form.control}
                                    name="enable_ipv4"
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
                                                    {t("Enable")} IPv4
                                                </FormLabel>
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="enable_ipv6"
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
                                                    {t("Enable")} IPv6
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
