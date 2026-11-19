import { useServerNames } from "@/hooks/useEntityNames"
import {
    listMCPOAuthClients,
    listMCPOAuthGrants,
    revokeMCPOAuthGrant,
    setMCPOAuthClientDisabled,
} from "@/api/mcp-oauth"
import { ConfirmActionDialog } from "@/components/action-button-group"
import { Button } from "@/components/ui/button"
import { TablePagination } from "@/components/ui/pagination"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    TableStateRow,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/hooks/useAuth"
import { formatDateTime } from "@/lib/utils"
import { Page } from "@nezha-kumo/ui"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import useSWR, { useSWRConfig } from "swr"

function displayTime(value?: string, locale?: string) {
    return formatDateTime(value, locale, "—")
}

function errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error)
}

function OAuthGrants({ all, userID }: { all: boolean; userID: number }) {
    const { t, i18n } = useTranslation()
    const serverName = useServerNames()
    const [page, setPage] = useState(1)
    const [busy, setBusy] = useState(false)
    const [actionError, setActionError] = useState("")
    // Include the signed-in identity in cache keys to avoid showing the previous
    // user's authorization metadata after an account switch in the same browser.
    const { data, error, isLoading, mutate } = useSWR(["mcp-oauth-grants", userID, all, page], () =>
        listMCPOAuthGrants(all, page),
    )
    async function revoke(id: string) {
        if (busy) return
        setBusy(true)
        setActionError("")
        try {
            await revokeMCPOAuthGrant(id)
            await mutate()
        } catch (error) {
            setActionError(errorMessage(error))
        } finally {
            setBusy(false)
        }
    }
    return (
        <>
            {actionError && (
                <p role="alert" className="text-destructive">
                    {actionError}
                </p>
            )}
            <Table
                fillColumn="servers"
                columnPriority={[
                    ["user", 120],
                    ["permissions", 180],
                    ["servers", 144],
                    ["lifetime", 216],
                    ["lastUsed", 168],
                ]}
            >
                <TableHeader>
                    <TableRow>
                        <TableHead data-col="name">{t("MCPOAuthManager.Application")}</TableHead>
                        {all && <TableHead data-col="user">{t("User")}</TableHead>}
                        <TableHead data-col="permissions">{t("MCPOAuth.Permissions")}</TableHead>
                        <TableHead data-col="servers">{t("MCPOAuth.Servers")}</TableHead>
                        <TableHead data-col="lifetime">{t("MCPOAuthManager.Lifetime")}</TableHead>
                        <TableHead data-col="lastUsed">{t("ApiTokenLastUsed")}</TableHead>
                        <TableHead data-col="actions">{t("Actions")}</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    <TableStateRow
                        rowCount={data?.items?.length ?? 0}
                        colSpan={all ? 7 : 6}
                        isLoading={isLoading}
                        error={error}
                        onRetry={mutate}
                    />
                    {data?.items?.map((grant) => {
                        const grantName = grant.client_name || grant.client_id
                        return (
                            <TableRow key={grant.id}>
                                <TableCell
                                    data-col="name"
                                    data-multiline
                                    className="max-w-64 break-all whitespace-normal"
                                >
                                    <p>{grantName}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {grant.client_id}
                                    </p>
                                    <p>{t(`MCPOAuthManager.Status.${grant.status}`)}</p>
                                </TableCell>
                                {all && (
                                    <TableCell data-col="user">
                                        {grant.username} (#{grant.user_id})
                                    </TableCell>
                                )}
                                <TableCell
                                    data-col="permissions"
                                    data-multiline
                                    className="whitespace-normal"
                                >
                                    {grant.scopes.map((scope) => (
                                        <div key={scope} className="text-xs">
                                            {scope}
                                        </div>
                                    ))}
                                </TableCell>
                                <TableCell
                                    data-col="servers"
                                    className="break-words whitespace-normal"
                                >
                                    {grant.server_ids.length
                                        ? grant.server_ids.map(serverName).join(", ")
                                        : t("MCPOAuth.AllServers")}
                                </TableCell>
                                <TableCell
                                    data-col="lifetime"
                                    data-multiline
                                    className="whitespace-normal text-xs leading-relaxed"
                                >
                                    <p>
                                        {t("MCPOAuthManager.AuthorizedAt")}:{" "}
                                        {displayTime(grant.created_at, i18n?.language)}
                                    </p>
                                    <p>
                                        {t("ApiTokenExpiresAt")}:{" "}
                                        {displayTime(grant.expires_at, i18n?.language)}
                                    </p>
                                </TableCell>
                                <TableCell
                                    data-col="lastUsed"
                                    data-multiline
                                    className="whitespace-normal text-xs leading-relaxed"
                                >
                                    <p>{displayTime(grant.last_used_at, i18n?.language)}</p>
                                    <p>{grant.last_used_ip}</p>
                                </TableCell>
                                <TableCell data-col="actions">
                                    <ConfirmActionDialog
                                        trigger={
                                            <Button variant="outline" disabled={busy}>
                                                {t("Revoke")}
                                            </Button>
                                        }
                                        title={t("Revoke")}
                                        description={t("MCPOAuthManager.ConfirmRevoke", {
                                            name: grantName,
                                        })}
                                        onConfirm={() => revoke(grant.id)}
                                    />
                                </TableCell>
                            </TableRow>
                        )
                    })}
                </TableBody>
            </Table>
            <TablePagination
                page={page}
                pageSize={20}
                total={data?.total}
                disabled={busy || isLoading}
                onPageChange={setPage}
            />
        </>
    )
}

function OAuthClients({ userID }: { userID: number }) {
    const { t, i18n } = useTranslation()
    const [page, setPage] = useState(1)
    const [busy, setBusy] = useState(false)
    const [actionError, setActionError] = useState("")
    const { mutate: mutateCache } = useSWRConfig()
    const { data, error, isLoading, mutate } = useSWR(["mcp-oauth-clients", userID, page], () =>
        listMCPOAuthClients(page),
    )
    async function changeClient(id: string, disabled: boolean) {
        if (busy) return
        setBusy(true)
        setActionError("")
        try {
            await setMCPOAuthClientDisabled(id, disabled)
            await mutate()
            await mutateCache(
                (key) => Array.isArray(key) && key[0] === "mcp-oauth-grants",
                undefined,
            )
        } catch (error) {
            setActionError(errorMessage(error))
        } finally {
            setBusy(false)
        }
    }
    return (
        <>
            <p className="mb-4 text-sm text-muted-foreground">
                {t("MCPOAuthManager.ClientPolicy")}
            </p>
            {actionError && (
                <p role="alert" className="text-destructive">
                    {actionError}
                </p>
            )}
            <Table
                columnPriority={[
                    ["callback", 260],
                    ["grants", 104],
                    ["lastUsed", 176],
                ]}
            >
                <TableHeader>
                    <TableRow>
                        <TableHead data-col="name">{t("MCPOAuthManager.Application")}</TableHead>
                        <TableHead data-col="callback">{t("MCPOAuth.Callback")}</TableHead>
                        <TableHead data-col="grants">{t("MCPOAuthManager.GrantCount")}</TableHead>
                        <TableHead data-col="lastUsed">{t("ApiTokenLastUsed")}</TableHead>
                        <TableHead data-col="actions">{t("Actions")}</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    <TableStateRow
                        rowCount={data?.items?.length ?? 0}
                        colSpan={5}
                        isLoading={isLoading}
                        error={error}
                        onRetry={mutate}
                    />
                    {data?.items?.map((client) => {
                        const actionLabel = t(
                            client.disabled
                                ? "MCPOAuthManager.Enable"
                                : "MCPOAuthManager.Disable",
                        )
                        const confirmationKey = client.disabled
                            ? "MCPOAuthManager.ConfirmEnable"
                            : "MCPOAuthManager.ConfirmDisable"
                        return (
                            <TableRow key={client.id}>
                                <TableCell
                                    data-col="name"
                                    data-multiline
                                    className="max-w-64 break-all whitespace-normal"
                                >
                                    <p>{client.name}</p>
                                    <p className="text-xs text-muted-foreground">{client.id}</p>
                                    <p>
                                        {t(
                                            client.disabled
                                                ? "MCPOAuthManager.Disabled"
                                                : "MCPOAuthManager.Enabled",
                                        )}
                                    </p>
                                </TableCell>
                                <TableCell
                                    data-col="callback"
                                    data-multiline
                                    className="max-w-96 break-all whitespace-normal"
                                >
                                    {client.redirect_uris.map((uri) => (
                                        <div key={uri} className="text-xs">
                                            {uri}
                                        </div>
                                    ))}
                                </TableCell>
                                <TableCell data-col="grants">{client.grant_count}</TableCell>
                                <TableCell data-col="lastUsed" data-multiline>
                                    {displayTime(client.last_used_at, i18n?.language)}
                                </TableCell>
                                <TableCell data-col="actions">
                                    <ConfirmActionDialog
                                        trigger={
                                            <Button variant="outline" disabled={busy}>
                                                {actionLabel}
                                            </Button>
                                        }
                                        title={actionLabel}
                                        description={t(confirmationKey, { name: client.name })}
                                        confirmVariant={
                                            client.disabled ? "default" : "destructive"
                                        }
                                        onConfirm={() => changeClient(client.id, !client.disabled)}
                                    />
                                </TableCell>
                            </TableRow>
                        )
                    })}
                </TableBody>
            </Table>
            <TablePagination
                page={page}
                pageSize={20}
                total={data?.total}
                disabled={busy || isLoading}
                onPageChange={setPage}
            />
        </>
    )
}

export default function MCPOAuthManagementPage() {
    const { t } = useTranslation()
    const { profile, loading } = useAuth()
    const [view, setView] = useState("mine")
    const isAdmin = profile?.role === 0
    const selected = isAdmin ? view : "mine"
    return (
        <Page
            title={t("MCPOAuthManager.Title")}
            description={t("MCPOAuthManager.Description")}
        >
            {loading || !profile ? (
                <p role="status">{t("Loading")}</p>
            ) : (
                <>
                    <Tabs value={selected} onValueChange={setView} className="nkt-mcp-tabs mb-4">
                        <TabsList>
                            <TabsTrigger value="mine">{t("MCPOAuthManager.Mine")}</TabsTrigger>
                            {isAdmin && (
                                <TabsTrigger value="all">{t("MCPOAuthManager.All")}</TabsTrigger>
                            )}
                            {isAdmin && (
                                <TabsTrigger value="clients">
                                    {t("MCPOAuthManager.Clients")}
                                </TabsTrigger>
                            )}
                        </TabsList>
                    </Tabs>
                    {selected === "clients" && isAdmin ? (
                        <OAuthClients key={`clients-${profile.id}`} userID={profile.id} />
                    ) : (
                        <OAuthGrants
                            key={`${profile.id}-${selected}`}
                            userID={profile.id}
                            all={selected === "all"}
                        />
                    )}
                </>
            )}
        </Page>
    )
}
