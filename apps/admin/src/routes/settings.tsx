import { updateSettings } from "@/api/settings"
import { SettingsTab } from "@/components/settings-tab"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Combobox } from "@/components/ui/combobox"
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/hooks/useAuth"
import { useNotification } from "@/hooks/useNotfication"
import useSetting from "@/hooks/useSetting"
import { useSubmitLock } from "@/hooks/useSubmitLock"
import { asOptionalField, errorMessage, safeExternalHref } from "@/lib/utils"
import { nezhaLang, normalizeNotificationLanguage, settingCoverageTypes } from "@/types"
import { zodResolver } from "@hookform/resolvers/zod"
import { Page } from "@nezha-kumo/ui"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { Navigate } from "react-router-dom"
import { toast } from "sonner"
import { z } from "zod"

const settingFormSchema = z.object({
    dns_servers: asOptionalField(z.string()),
    ignored_ip_notification: asOptionalField(z.string()),
    ip_change_notification_group_id: z.coerce.number().int().min(0),
    cover: z.coerce.number().int().min(1),
    online_stats_days: z.coerce.number().int().min(7).max(3650),
    site_name: z.string().min(1),
    language: z.string().min(2),
    user_template: z.string().min(1),
    install_host: asOptionalField(z.string()),
    dashboard_host: asOptionalField(z.string()),
    reserved_hosts: asOptionalField(z.string()),
    nat_member_domains: z.string(),
    custom_code: asOptionalField(z.string()),
    custom_code_dashboard: asOptionalField(z.string()),
    web_real_ip_header: asOptionalField(z.string()),
    agent_real_ip_header: asOptionalField(z.string()),

    tls: asOptionalField(z.boolean()),
    enable_ip_change_notification: asOptionalField(z.boolean()),
    enable_plain_ip_in_notification: asOptionalField(z.boolean()),
    enable_mcp: asOptionalField(z.boolean()),
})

export default function SettingsPage() {
    const { t } = useTranslation()
    const { data: config, mutate } = useSetting()
    const { profile, loading: authLoading } = useAuth()

    const { notifierGroup } = useNotification()
    const ngroupList = notifierGroup?.map((ng) => ({
        value: `${ng.group.id}`,
        label: ng.group.name,
    })) || [{ value: "", label: "" }]

    const isAdmin = profile?.role === 0

    // 所有 hooks 必须在条件 return 之前调用，否则违反 rules-of-hooks。
    const form = useForm({
        resolver: zodResolver(settingFormSchema) as any,
        defaultValues: config
            ? {
                  ...config.config,
                  language: normalizeNotificationLanguage(config.config?.language),
                  // 兼容尚未包含 online_stats_days 的旧后端：字段缺省时回退
                  // 默认值，避免必填校验拦截其他设置的提交
                  online_stats_days: config.config?.online_stats_days ?? 7,
                  nat_member_domains: (config.config?.nat_member_domains ?? []).join("\n"),
                  user_template:
                      config.config?.user_template ||
                      Object.keys(config.frontend_templates?.filter((t) => !t.is_admin) || {})[0] ||
                      "user-dist",
              }
            : {
                  ip_change_notification_group_id: 0,
                  cover: 1,
                  online_stats_days: 7,
                  nat_member_domains: "",
                  site_name: "",
                  language: "",
                  user_template: "user-dist",
              },
        resetOptions: {
            keepDefaultValues: false,
        },
    })

    useEffect(() => {
        if (config?.config) {
            // 与 defaultValues 同一兼容口径：旧后端缺字段时回退默认值
            form.reset({
                ...config.config,
                language: normalizeNotificationLanguage(config.config?.language),
                online_stats_days: config.config?.online_stats_days ?? 7,
                nat_member_domains: (config.config?.nat_member_domains ?? []).join("\n"),
            })
        }
    }, [config?.config, form])

    const { submitting, runSubmit } = useSubmitLock()

    if (authLoading) {
        return null
    }
    if (!isAdmin) {
        return <Navigate to="/dashboard/settings/api-tokens" replace />
    }

    const onSubmit = runSubmit(async (values: any) => {
        try {
            await updateSettings({
                ...values,
                language: normalizeNotificationLanguage(values.language),
                // Send [] when cleared: omitting the field preserves the server's previous policy.
                nat_member_domains: values.nat_member_domains
                    .split("\n")
                    .map((domain: string) => domain.trim())
                    .filter(Boolean),
            })
            form.reset()
            await mutate()
        } catch (e) {
            toast.error(t("Error"), {
                description: t("Results.ErrorFetchingResource", {
                    error: errorMessage(e, t("Results.UnExpectedError")),
                }),
            })
            return
        }
        toast.success(t("Success"))
    })

    return (
        <Page title={t("Settings")} tabs={<SettingsTab />}>
            <div>
                <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit(onSubmit)}
                        className="space-y-2 my-2 max-w-3xl"
                    >
                        <FormField
                            control={form.control}
                            name="site_name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t("SiteName")}</FormLabel>
                                    <FormControl>
                                        <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="language"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t("Language")}</FormLabel>
                                    <FormControl>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {Object.entries(nezhaLang).map(([k, v]) => (
                                                    <SelectItem key={k} value={k}>
                                                        {v}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="user_template"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t("Theme")}</FormLabel>
                                    <FormControl>
                                        <Select
                                            value={field.value}
                                            onValueChange={(value) => {
                                                const template = config?.frontend_templates?.find(
                                                    (t) => t.path === value,
                                                )
                                                if (template) {
                                                    form.setValue("user_template", template!.path!)
                                                }
                                            }}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder={t("SelectTheme")} />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {(
                                                    config?.frontend_templates?.filter(
                                                        (t) => !t.is_admin,
                                                    ) || []
                                                ).map((template) => (
                                                    <div key={template.path}>
                                                        <SelectItem
                                                            value={template.path!}
                                                            description={
                                                                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                                                                    <span>
                                                                        {t("Author")}:{" "}
                                                                        {template.author}
                                                                    </span>
                                                                    {!template.is_official ? (
                                                                        <span className="px-1.5 py-0.5 rounded-md bg-kumo-danger-tint text-kumo-danger text-xs">
                                                                            {t("Community")}
                                                                        </span>
                                                                    ) : (
                                                                        <span className="px-1.5 py-0.5 rounded-md bg-kumo-info-tint text-kumo-link text-xs">
                                                                            {t("Official")}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            }
                                                        >
                                                            {template.name}
                                                        </SelectItem>
                                                        <div className="px-8 py-1">
                                                            {safeExternalHref(
                                                                template.repository,
                                                            ) ? (
                                                                <a
                                                                    href={safeExternalHref(
                                                                        template.repository,
                                                                    )}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="break-all text-sm text-kumo-link hover:underline"
                                                                >
                                                                    {template.repository}
                                                                </a>
                                                            ) : (
                                                                <span className="break-all text-sm text-muted-foreground">
                                                                    {template.repository}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </FormControl>
                                    <FormMessage />
                                    {!config?.frontend_templates?.find(
                                        (t) => t.path === field.value,
                                    )?.is_official && (
                                        <div className="mt-2 text-sm text-kumo-warning bg-kumo-warning-tint border border-kumo-warning/40 rounded-md p-2">
                                            <div className="font-medium text-lg mb-1">
                                                {t("CommunityThemeWarning")}
                                            </div>
                                            <div className="text-kumo-warning">
                                                {t("CommunityThemeDescription")}
                                            </div>
                                        </div>
                                    )}
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="custom_code"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t("CustomCodes")}</FormLabel>
                                    <FormControl>
                                        <Textarea className="resize-y min-h-48" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="custom_code_dashboard"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t("CustomCodesDashboard")}</FormLabel>
                                    <FormControl>
                                        <Textarea className="resize-y min-h-48" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="install_host"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t("DashboardOriginalHost")}</FormLabel>
                                    <FormControl>
                                        <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="dashboard_host"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t("DashboardHost")}</FormLabel>
                                    <FormControl>
                                        <Input {...field} />
                                    </FormControl>
                                    <FormDescription>{t("DashboardHostHint")}</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="reserved_hosts"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t("ReservedHosts")}</FormLabel>
                                    <FormControl>
                                        <Input {...field} />
                                    </FormControl>
                                    <FormDescription>{t("ReservedHostsHint")}</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="nat_member_domains"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t("NATMemberDomains")}</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="tunnel.example.com" {...field} />
                                    </FormControl>
                                    <FormDescription>{t("NATMemberDomainsHint")}</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="tls"
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
                                            {t("ConfigTLS")}
                                        </FormLabel>
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="dns_servers"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>
                                        {t("CustomPublicDNSNameserversforDDNS") +
                                            " " +
                                            t("SeparateWithComma")}
                                    </FormLabel>
                                    <FormControl>
                                        <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="web_real_ip_header"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t("WebRealIPHeader")}</FormLabel>
                                    <div className="flex items-center">
                                        <FormControl>
                                            <Input
                                                disabled={field.value == "NZ::Use-Peer-IP"}
                                                className="w-1/2"
                                                placeholder="CF-Connecting-IP"
                                                {...field}
                                            />
                                        </FormControl>
                                        <Checkbox
                                            id="web_real_ip_header_direct"
                                            aria-labelledby="web_real_ip_header_direct-label"
                                            checked={field.value == "NZ::Use-Peer-IP"}
                                            className="ml-2"
                                            onCheckedChange={(checked) => {
                                                form.setValue(
                                                    "web_real_ip_header",
                                                    checked ? "NZ::Use-Peer-IP" : "",
                                                )
                                            }}
                                        />
                                        <Label
                                            id="web_real_ip_header_direct-label"
                                            htmlFor="web_real_ip_header_direct"
                                            className="font-normal ml-2 cursor-pointer"
                                        >
                                            {t("UseDirectConnectingIP")}
                                        </Label>
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="agent_real_ip_header"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t("AgentRealIPHeader")}</FormLabel>
                                    <div className="flex items-center">
                                        <FormControl>
                                            <Input
                                                disabled={field.value == "NZ::Use-Peer-IP"}
                                                className="w-1/2"
                                                placeholder="CF-Connecting-IP"
                                                {...field}
                                            />
                                        </FormControl>
                                        <Checkbox
                                            id="agent_real_ip_header_direct"
                                            aria-labelledby="agent_real_ip_header_direct-label"
                                            checked={field.value == "NZ::Use-Peer-IP"}
                                            className="ml-2"
                                            onCheckedChange={(checked) => {
                                                form.setValue(
                                                    "agent_real_ip_header",
                                                    checked ? "NZ::Use-Peer-IP" : "",
                                                )
                                            }}
                                        />
                                        <Label
                                            id="agent_real_ip_header_direct-label"
                                            htmlFor="agent_real_ip_header_direct"
                                            className="font-normal ml-2 cursor-pointer"
                                        >
                                            {t("UseDirectConnectingIP")}
                                        </Label>
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormItem>
                            <FormLabel>{t("IPChangeNotification")}</FormLabel>
                            <Card className="w-full">
                                <CardContent>
                                    <div className="flex flex-col space-y-4 mt-4">
                                        <FormField
                                            control={form.control}
                                            name="cover"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>{t("Coverage")}</FormLabel>
                                                    <Select
                                                        onValueChange={field.onChange}
                                                        value={`${field.value}`}
                                                    >
                                                        <FormControl>
                                                            <SelectTrigger>
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            {Object.entries(
                                                                settingCoverageTypes,
                                                            ).map(([k, v]) => (
                                                                <SelectItem key={k} value={k}>
                                                                    {t(v)}
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
                                            name="ignored_ip_notification"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>
                                                        {t("SpecificServers") +
                                                            " " +
                                                            t("SeparateWithComma")}
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
                                            name="ip_change_notification_group_id"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>{t("NotifierGroup")}</FormLabel>
                                                    <FormControl>
                                                        <Combobox
                                                            placeholder={t("Search")}
                                                            options={ngroupList}
                                                            onValueChange={field.onChange}
                                                            defaultValue={field.value?.toString()}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="enable_ip_change_notification"
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
                                                            {t("Enable")}
                                                        </FormLabel>
                                                    </div>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </CardContent>
                            </Card>
                        </FormItem>
                        <FormField
                            control={form.control}
                            name="enable_plain_ip_in_notification"
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
                                            {t("FullIPNotification")}
                                        </FormLabel>
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="enable_mcp"
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
                                            {t("EnableMCP")}
                                        </FormLabel>
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="online_stats_days"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t("OnlineStatsDays")}</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            min={7}
                                            max={3650}
                                            placeholder="7"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormDescription>{t("OnlineStatsDaysHint")}</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Button type="submit" loading={submitting}>
                            {t("Confirm")}
                        </Button>
                    </form>
                </Form>
            </div>
        </Page>
    )
}
