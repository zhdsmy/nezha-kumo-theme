import {
    ApiTokenCreateResponse,
    ApiTokenView,
    SCOPE_OPTIONS,
    createApiToken,
    deleteApiToken,
    listApiTokens,
    parseExpiresInDaysInput,
    parseServerIDsInput,
} from "@/api/api-tokens"
import { ConfirmActionDialog } from "@/components/action-button-group"
import { SettingsTab } from "@/components/settings-tab"
import { Badge } from "@/components/ui/badge"
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
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    TableStateRow,
} from "@/components/ui/table"
import { useAuth } from "@/hooks/useAuth"
import { useSubmitLock } from "@/hooks/useSubmitLock"
import { copyToClipboard, errorMessage, formatDateTime, isTimestampExpired } from "@/lib/utils"
import { Page } from "@nezha-kumo/ui"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import useSWR from "swr"

export default function ApiTokensPage() {
    const { t, i18n } = useTranslation()
    const { profile } = useAuth()
    const isAdmin = profile?.role === 0

    const { data, mutate, isLoading, error } = useSWR<ApiTokenView[]>(
        "/api/v1/api-tokens",
        listApiTokens,
    )

    useEffect(() => {
        if (!error) return
        toast.error(t("Error"), {
            description: t("Results.ErrorFetchingResource", {
                error: (error as Error)?.message ?? String(error),
            }),
        })
    }, [error, t])

    const [createOpen, setCreateOpen] = useState(false)
    const [revealed, setRevealed] = useState<ApiTokenCreateResponse | null>(null)

    const handleDelete = async (id: number) => {
        try {
            await deleteApiToken(id)
            toast.success(t("ApiTokenRevoked"))
            await mutate()
        } catch (e: any) {
            toast.error(t("Error"), { description: e.message })
        }
    }

    return (
        <Page
            title={t("ApiTokens")}
            tabs={<SettingsTab />}
            actions={<Button onClick={() => setCreateOpen(true)}>{t("CreateApiToken")}</Button>}
        >
            <Table
                columnPriority={[
                    ["scopes", 170],
                    ["servers", 100],
                    ["expires", 150],
                    ["lastUsed", 150],
                ]}
            >
                <TableHeader>
                    <TableRow>
                        <TableHead data-col="name">{t("Name")}</TableHead>
                        <TableHead data-col="scopes">{t("Scopes")}</TableHead>
                        <TableHead data-col="servers">{t("ApiTokenServers")}</TableHead>
                        <TableHead data-col="expires">{t("ApiTokenExpiresAt")}</TableHead>
                        <TableHead data-col="lastUsed">{t("ApiTokenLastUsed")}</TableHead>
                        <TableHead data-col="actions">{t("Actions")}</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    <TableStateRow
                        rowCount={data?.length ?? 0}
                        colSpan={6}
                        isLoading={isLoading}
                        error={error}
                        onRetry={mutate}
                    />
                    {data?.map((tok) => (
                        <TableRow key={tok.id}>
                            <TableCell data-col="name">{tok.name}</TableCell>
                            <TableCell data-col="scopes" data-multiline>
                                <div className="flex flex-wrap gap-1">
                                    {(tok.scopes ?? []).map((s) => (
                                        <span
                                            key={s}
                                            className="rounded bg-secondary px-1.5 py-0.5 text-xs"
                                        >
                                            {s}
                                        </span>
                                    ))}
                                </div>
                            </TableCell>
                            <TableCell data-col="servers" className="text-xs">
                                {tok.server_ids?.length
                                    ? tok.server_ids.join(", ")
                                    : t("ApiTokenAllServers")}
                            </TableCell>
                            <TableCell
                                data-col="expires"
                                data-multiline
                                className="whitespace-normal text-xs"
                            >
                                <div className="flex flex-wrap items-center gap-1.5 tabular-nums">
                                    <span className="whitespace-nowrap">
                                        {formatDateTime(
                                            tok.expires_at,
                                            i18n?.language,
                                            t("ApiTokenNever"),
                                        )}
                                    </span>
                                    {isTimestampExpired(tok.expires_at) ? (
                                        <Badge variant="destructive">{t("Expired")}</Badge>
                                    ) : null}
                                </div>
                            </TableCell>
                            <TableCell
                                data-col="lastUsed"
                                data-multiline
                                className="whitespace-normal text-xs tabular-nums"
                            >
                                {(() => {
                                    const formatted = formatDateTime(
                                        tok.last_used_at,
                                        i18n?.language,
                                        "",
                                    )
                                    return formatted ? (
                                        <div>
                                            <div className="whitespace-nowrap">{formatted}</div>
                                            <div className="text-muted-foreground">
                                                {tok.last_used_ip ?? "?"}
                                            </div>
                                        </div>
                                    ) : (
                                        t("Never")
                                    )
                                })()}
                            </TableCell>
                            <TableCell data-col="actions">
                                <ConfirmActionDialog
                                    trigger={
                                        <Button variant="outline" size="sm">
                                            {t("Revoke")}
                                        </Button>
                                    }
                                    title={t("Revoke")}
                                    description={t("ConfirmDeleteApiToken", {
                                        name: tok.name,
                                    })}
                                    onConfirm={() => handleDelete(tok.id)}
                                />
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>

            <CreateApiTokenDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                isAdmin={isAdmin}
                onCreated={(res) => {
                    setRevealed(res)
                    mutate()
                }}
            />

            <RevealedTokenDialog token={revealed} onClose={() => setRevealed(null)} />
        </Page>
    )
}

function CreateApiTokenDialog({
    open,
    onOpenChange,
    isAdmin,
    onCreated,
}: {
    open: boolean
    onOpenChange: (v: boolean) => void
    isAdmin: boolean
    onCreated: (res: ApiTokenCreateResponse) => void
}) {
    const { t } = useTranslation()
    const [name, setName] = useState("")
    const [scopes, setScopes] = useState<string[]>([])
    const [serverIDs, setServerIDs] = useState("")
    const [expiresInDays, setExpiresInDays] = useState<string>("90")
    const { submitting, runSubmit } = useSubmitLock()

    const toggleScope = (s: string) => {
        setScopes((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]))
    }

    const submit = runSubmit(async () => {
        if (!name.trim()) {
            toast.error(t("Error"), { description: t("NameRequired") })
            return
        }
        if (scopes.length === 0) {
            toast.error(t("Error"), { description: t("ApiTokenScopeRequired") })
            return
        }
        const parsedRes = parseServerIDsInput(serverIDs)
        if (!parsedRes.ok) {
            toast.error(t("Error"), { description: t("ApiTokenServersInvalid") })
            return
        }
        const parsedServers = parsedRes.value
        const expRes = parseExpiresInDaysInput(expiresInDays)
        if (!expRes.ok) {
            toast.error(t("Error"), { description: t("ApiTokenExpiryInvalid") })
            return
        }
        const expDays = expRes.value
        try {
            const res = await createApiToken({
                name: name.trim(),
                scopes,
                server_ids: parsedServers,
                expires_in_days: expDays,
            })
            onCreated(res)
            onOpenChange(false)
            setName("")
            setScopes([])
            setServerIDs("")
            setExpiresInDays("90")
        } catch (e: unknown) {
            toast.error(t("Error"), { description: errorMessage(e, t("Results.UnExpectedError")) })
        }
    })

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{t("CreateApiToken")}</DialogTitle>
                    <DialogDescription>{t("CreateApiTokenDescription")}</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-2">
                    <div className="grid gap-2">
                        <Label id="api-token-name-label" htmlFor="name">
                            {t("Name")}
                        </Label>
                        <Input
                            id="name"
                            aria-labelledby="api-token-name-label"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label>{t("Scopes")}</Label>
                        <div className="max-h-72 space-y-2 overflow-y-auto pr-2">
                            {SCOPE_OPTIONS.map((s) => {
                                const adminOnly =
                                    s.value === "nezha:*" || s.value === "nezha:admin:*"
                                const disabled = adminOnly && !isAdmin
                                return (
                                    <label
                                        key={s.value}
                                        className={`flex items-start gap-2 text-sm ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
                                    >
                                        <Checkbox
                                            aria-label={s.value}
                                            checked={scopes.includes(s.value)}
                                            onCheckedChange={() =>
                                                !disabled && toggleScope(s.value)
                                            }
                                            disabled={disabled}
                                        />
                                        <div className="flex flex-col">
                                            <span className="font-mono text-xs">{s.value}</span>
                                            <span className="text-xs text-muted-foreground">
                                                {t(s.descKey)}
                                            </span>
                                        </div>
                                    </label>
                                )
                            })}
                        </div>
                    </div>
                    <div className="grid gap-2">
                        <Label id="api-token-server-ids-label" htmlFor="server-ids">
                            {t("ApiTokenServerIDs")}
                        </Label>
                        <Input
                            id="server-ids"
                            aria-labelledby="api-token-server-ids-label"
                            placeholder={t("ApiTokenServerIDsPlaceholder")}
                            value={serverIDs}
                            onChange={(e) => setServerIDs(e.target.value)}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label id="api-token-expires-label" htmlFor="expires">
                            {t("ApiTokenExpiresInDays")}
                        </Label>
                        <Input
                            id="expires"
                            aria-labelledby="api-token-expires-label"
                            type="number"
                            min={0}
                            max={3650}
                            value={expiresInDays}
                            onChange={(e) => setExpiresInDays(e.target.value)}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">{t("Cancel")}</Button>
                    </DialogClose>
                    <Button onClick={submit} loading={submitting}>
                        {t("CreateApiToken")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export function RevealedTokenDialog({
    token,
    onClose,
}: {
    token: ApiTokenCreateResponse | null
    onClose: () => void
}) {
    const { t } = useTranslation()
    return (
        <Dialog open={!!token}>
            <DialogContent
                className="sm:max-w-md"
                hideCloseButton
                onEscapeKeyDown={(e) => e.preventDefault()}
                onPointerDownOutside={(e) => e.preventDefault()}
                onInteractOutside={(e) => e.preventDefault()}
            >
                <DialogHeader>
                    <DialogTitle>{t("ApiTokenCreated")}</DialogTitle>
                    <DialogDescription>{t("ApiTokenRevealOnce")}</DialogDescription>
                </DialogHeader>
                {token && (
                    <div className="space-y-3">
                        <div className="rounded border border-kumo-warning/40 bg-kumo-warning-tint text-kumo-warning p-3 text-sm">
                            {t("ApiTokenStoreSafely")}
                        </div>
                        <code className="block break-all rounded bg-muted p-3 font-mono text-xs">
                            {token.token}
                        </code>
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={async () => {
                                try {
                                    await copyToClipboard(token.token)
                                    toast.success(t("Copied"))
                                } catch {
                                    toast.error(t("Error"), {
                                        description: t("ClipboardWriteFailed"),
                                    })
                                }
                            }}
                        >
                            {t("Copy")}
                        </Button>
                    </div>
                )}
                <DialogFooter>
                    <Button type="button" onClick={onClose}>
                        {t("Done")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
