import { adapter, refresh, useStore } from "@/app/store"
import { Banner, Button, Dialog, Input, Loader } from "@cloudflare/kumo"
import { XIcon } from "@phosphor-icons/react"
import { type FormEvent, useState } from "react"
import { useTranslation } from "react-i18next"

import { useScrollMore } from "./ui"

export interface LoginDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

// Login behavior adapted from zool-theme/src/components/LoginDialog.tsx (MIT, luoleiorg).
function LoginForm({ close }: { close: () => void }) {
    const { t } = useTranslation()
    const site = useStore((s) => s.site)
    const [username, setUsername] = useState("")
    const [password, setPassword] = useState("")
    const [busy, setBusy] = useState(false)
    const [message, setMessage] = useState("")
    const submit = async (e: FormEvent) => {
        e.preventDefault()
        if (busy) return
        setBusy(true)
        setMessage("")
        const result = await adapter.login(username.trim(), password)
        if (result.ok) {
            await refresh()
            close()
        } else setMessage(t(`auth.${result.reason}`))
        setBusy(false)
    }
    const oauth = async (provider: string) => {
        if (busy || !site) return
        setBusy(true)
        setMessage("")
        try {
            const url = await adapter.oauthUrl(site, provider)
            if (!url) throw new Error("Unavailable")
            window.location.assign(url)
        } catch {
            setMessage(t("auth.network"))
        } finally {
            setBusy(false)
        }
    }
    return (
        <>
            <Dialog.Title className="dialog-title">{t("auth.title")}</Dialog.Title>
            <Dialog.Description className="dialog-description muted mb-6">
                {t("auth.subtitle", { site: site?.name })}
            </Dialog.Description>
            <form onSubmit={submit} className="login-form">
                <Input
                    autoFocus
                    label={t("auth.username")}
                    autoComplete="username"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                />
                <Input
                    label={t("auth.password")}
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />
                <Button
                    variant="primary"
                    type="submit"
                    disabled={busy}
                    icon={busy ? <Loader size={14} aria-label={t("auth.submitting")} /> : undefined}
                    aria-label={busy ? t("auth.submitting") : undefined}
                >
                    {t("auth.submit")}
                </Button>
            </form>
            {site?.oauth && (
                <div className="oauth-actions">
                    {site.oauthProviders?.map((p) => (
                        <Button key={p} disabled={busy} onClick={() => void oauth(p)}>
                            {t("auth.oauth", { provider: p })}
                        </Button>
                    ))}
                </div>
            )}
            {message && (
                <Banner variant="error" size="sm" role="alert" className="mt-4">
                    {message}
                </Banner>
            )}
            <p className="login-waf-hint muted mt-5 text-xs">{t("auth.wafHint")}</p>
        </>
    )
}

export function LoginDialog({ open, onOpenChange }: LoginDialogProps) {
    const { t } = useTranslation()
    const scrollRef = useScrollMore<HTMLDivElement>(open)
    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <Dialog className="login-dialog p-0">
                <Dialog.Close
                    render={(props) => (
                        <Button
                            {...props}
                            className="dialog-close"
                            size="sm"
                            variant="ghost"
                            shape="square"
                            aria-label={t("auth.close")}
                        >
                            <XIcon size={16} />
                        </Button>
                    )}
                />
                {open && (
                    <div ref={scrollRef} className="login-scroll">
                        <LoginForm close={() => onOpenChange(false)} />
                    </div>
                )}
            </Dialog>
        </Dialog.Root>
    )
}
