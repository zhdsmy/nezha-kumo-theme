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
import { Separator } from "@/components/ui/separator"
import { useAuth } from "@/hooks/useAuth"
import useSetting from "@/hooks/useSetting"
import { zodResolver } from "@hookform/resolvers/zod"
import i18next from "i18next"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"

const formSchema = z.object({
    username: z.string().min(2, {
        message: i18next.t("Results.UsernameMin", { number: 2 }),
    }),
    password: z.string().min(1, {
        message: i18next.t("Results.PasswordRequired"),
    }),
})

function Login() {
    const { login, loginOauth2 } = useAuth()
    const { data: settingData } = useSetting()

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

    function onSubmit(values: z.infer<typeof formSchema>) {
        login(values.username, values.password)
    }

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
                                    <Input placeholder="admin" autoComplete="username" {...field} />
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
                                    <Input
                                        type="password"
                                        placeholder="admin"
                                        autoComplete="current-password"
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <Button type="submit" className="w-full">
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
