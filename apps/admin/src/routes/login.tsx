import { Oauth2RequestType, getOauth2RedirectURL } from "@/api/oauth2"
import { Button } from "@/components/ui/button"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { OAuthProviderIcon } from "@/components/ui/icon"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { Separator } from "@/components/ui/separator"
import { useAuth } from "@/hooks/useAuth"
import useSetting from "@/hooks/useSetting"
import { useSubmitLock } from "@/hooks/useSubmitLock"
import i18n from "@/lib/i18n"
import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"

const formSchema = z.object({
    username: z.string().min(2, {
        error: () => i18n.t("Results.UsernameMin", { number: 2 }),
    }),
    password: z.string().min(1, {
        error: () => i18n.t("Results.PasswordRequired"),
    }),
})

function Login() {
    const { login, loginOauth2 } = useAuth()
    const { data: settingData } = useSetting()
    const [loginError, setLoginError] = useState<string | null>(null)
    const { submitting, runSubmit } = useSubmitLock()

    useEffect(() => {
        const oauth2 = new URLSearchParams(window.location.search).get("oauth2")
        if (oauth2) {
            loginOauth2()
        }
    }, [loginOauth2])

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            username: "",
            password: "",
        },
    })

    const onSubmit = runSubmit(async (values: z.infer<typeof formSchema>) => {
        setLoginError(null)
        const err = await login(values.username, values.password)
        if (typeof err === "string" && err) {
            setLoginError(err)
        }
    })

    async function loginWith(provider: string) {
        try {
            const redirectUrl = await getOauth2RedirectURL(provider, Oauth2RequestType.LOGIN)
            window.location.assign(redirectUrl.redirect!)
        } catch (error: any) {
            toast.error(error.message)
        }
    }

    const { t } = useTranslation()

    return (
        <div className="mx-auto my-12 w-[calc(100%-2rem)] max-w-sm rounded-xl border bg-card p-6 shadow-xs">
            <div className="mb-6 space-y-2">
                <h1 className="text-xl leading-6 font-semibold">{t("Login")}</h1>
                <p
                    className="truncate text-base text-muted-foreground"
                    title={settingData?.config?.site_name}
                >
                    {settingData?.config?.site_name || t("nezha")}
                </p>
            </div>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                        control={form.control}
                        name="username"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t("Username")}</FormLabel>
                                <FormControl>
                                    <Input
                                        placeholder="admin"
                                        autoComplete="username"
                                        {...field}
                                        onChange={(e) => {
                                            setLoginError(null)
                                            field.onChange(e)
                                        }}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t("Password")}</FormLabel>
                                <FormControl>
                                    <PasswordInput
                                        placeholder="admin"
                                        autoComplete="current-password"
                                        {...field}
                                        onChange={(e) => {
                                            setLoginError(null)
                                            field.onChange(e)
                                        }}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    {loginError && (
                        <p
                            role="alert"
                            className="rounded-lg border border-kumo-danger/40 bg-kumo-danger/10 px-3 py-2 text-sm font-medium text-destructive break-words"
                        >
                            {loginError}
                        </p>
                    )}
                    <Button type="submit" className="w-full" loading={submitting} disabled={submitting}>
                        {t("Login")}
                    </Button>
                </form>
                {settingData?.config?.oauth2_providers &&
                    settingData?.config?.oauth2_providers.length > 0 && (
                        <section className="flex items-center my-3 w-full">
                            <Separator className="flex-1" />
                            <div className="flex justify-center text-xs text-muted-foreground w-full max-w-[100px]">
                                OAuth2
                            </div>
                            <Separator className="flex-1" />
                        </section>
                    )}
            </Form>
            <div className="mt-3 flex flex-col gap-3">
                {settingData?.config?.oauth2_providers?.map((p: string) => (
                    <Button
                        key={p}
                        variant="secondary"
                        className="w-full"
                        onClick={() => loginWith(p)}
                    >
                        <OAuthProviderIcon provider={p} className="size-4" />
                        {p}
                    </Button>
                ))}
            </div>
        </div>
    )
}

export default Login
