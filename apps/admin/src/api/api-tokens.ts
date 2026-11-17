import { FetcherMethod, fetcher } from "./api"

export interface ApiTokenView {
    id: number
    name: string
    scopes: string[]
    server_ids?: number[]
    expires_at?: string
    last_used_at?: string
    last_used_ip?: string
    created_at: string
}

export interface ApiTokenCreateRequest {
    name: string
    scopes: string[]
    server_ids?: number[]
    expires_in_days?: number
}

export interface ApiTokenCreateResponse {
    id: number
    name: string
    token: string
    scopes: string[]
    server_ids?: number[]
    expires_at?: string
}

export const listApiTokens = async (): Promise<ApiTokenView[]> => {
    const tokens = await fetcher<ApiTokenView[]>(FetcherMethod.GET, "/api/v1/api-tokens", null)
    // Go encodes an empty scope slice as JSON null; coerce so callers can map() safely.
    return (tokens ?? []).map((tok) => ({
        ...tok,
        scopes: Array.isArray(tok.scopes) ? tok.scopes : [],
    }))
}

export const createApiToken = async (
    data: ApiTokenCreateRequest,
): Promise<ApiTokenCreateResponse> => {
    return fetcher<ApiTokenCreateResponse>(FetcherMethod.POST, "/api/v1/api-tokens", data)
}

export const deleteApiToken = async (id: number): Promise<void> => {
    return fetcher<void>(FetcherMethod.DELETE, `/api/v1/api-tokens/${id}`, null)
}

export const SCOPE_OPTIONS = [
    { value: "nezha:inventory:read", descKey: "ApiTokenScopeDesc.inventoryRead" },
    { value: "nezha:inventory:delete", descKey: "ApiTokenScopeDesc.inventoryDelete" },
    { value: "nezha:inventory:*", descKey: "ApiTokenScopeDesc.inventoryAll" },
    { value: "nezha:server:read", descKey: "ApiTokenScopeDesc.serverRead" },
    { value: "nezha:server:write", descKey: "ApiTokenScopeDesc.serverWrite" },
    { value: "nezha:server:delete", descKey: "ApiTokenScopeDesc.serverDelete" },
    { value: "nezha:server:exec", descKey: "ApiTokenScopeDesc.serverExec" },
    { value: "nezha:server:*", descKey: "ApiTokenScopeDesc.serverAll" },
    { value: "nezha:service:read", descKey: "ApiTokenScopeDesc.serviceRead" },
    { value: "nezha:service:write", descKey: "ApiTokenScopeDesc.serviceWrite" },
    { value: "nezha:service:delete", descKey: "ApiTokenScopeDesc.serviceDelete" },
    { value: "nezha:service:*", descKey: "ApiTokenScopeDesc.serviceAll" },
    { value: "nezha:alertrule:read", descKey: "ApiTokenScopeDesc.alertRuleRead" },
    { value: "nezha:alertrule:write", descKey: "ApiTokenScopeDesc.alertRuleWrite" },
    { value: "nezha:alertrule:delete", descKey: "ApiTokenScopeDesc.alertRuleDelete" },
    { value: "nezha:alertrule:*", descKey: "ApiTokenScopeDesc.alertRuleAll" },
    { value: "nezha:cron:read", descKey: "ApiTokenScopeDesc.cronRead" },
    { value: "nezha:cron:write", descKey: "ApiTokenScopeDesc.cronWrite" },
    { value: "nezha:cron:delete", descKey: "ApiTokenScopeDesc.cronDelete" },
    { value: "nezha:cron:exec", descKey: "ApiTokenScopeDesc.cronExec" },
    { value: "nezha:cron:*", descKey: "ApiTokenScopeDesc.cronAll" },
    { value: "nezha:notification:read", descKey: "ApiTokenScopeDesc.notificationRead" },
    { value: "nezha:notification:write", descKey: "ApiTokenScopeDesc.notificationWrite" },
    { value: "nezha:notification:delete", descKey: "ApiTokenScopeDesc.notificationDelete" },
    { value: "nezha:notification:*", descKey: "ApiTokenScopeDesc.notificationAll" },
    {
        value: "nezha:notification-group:read",
        descKey: "ApiTokenScopeDesc.notificationGroupRead",
    },
    {
        value: "nezha:notification-group:write",
        descKey: "ApiTokenScopeDesc.notificationGroupWrite",
    },
    {
        value: "nezha:notification-group:delete",
        descKey: "ApiTokenScopeDesc.notificationGroupDelete",
    },
    {
        value: "nezha:notification-group:*",
        descKey: "ApiTokenScopeDesc.notificationGroupAll",
    },
    { value: "nezha:ddns:read", descKey: "ApiTokenScopeDesc.ddnsRead" },
    { value: "nezha:ddns:write", descKey: "ApiTokenScopeDesc.ddnsWrite" },
    { value: "nezha:ddns:delete", descKey: "ApiTokenScopeDesc.ddnsDelete" },
    { value: "nezha:ddns:*", descKey: "ApiTokenScopeDesc.ddnsAll" },
    { value: "nezha:nat:read", descKey: "ApiTokenScopeDesc.natRead" },
    { value: "nezha:nat:write", descKey: "ApiTokenScopeDesc.natWrite" },
    { value: "nezha:nat:delete", descKey: "ApiTokenScopeDesc.natDelete" },
    { value: "nezha:nat:*", descKey: "ApiTokenScopeDesc.natAll" },
    { value: "nezha:transfer:read", descKey: "ApiTokenScopeDesc.transferRead" },
    { value: "nezha:transfer:write", descKey: "ApiTokenScopeDesc.transferWrite" },
    { value: "nezha:transfer:delete", descKey: "ApiTokenScopeDesc.transferDelete" },
    { value: "nezha:transfer:*", descKey: "ApiTokenScopeDesc.transferAll" },
    { value: "nezha:admin:*", descKey: "ApiTokenScopeDesc.adminAll" },
    { value: "nezha:*", descKey: "ApiTokenScopeDesc.everything" },
] as const

export type Scope = (typeof SCOPE_OPTIONS)[number]["value"]

export type ParseServerIDsResult =
    { ok: true; value: number[] | undefined } | { ok: false; error: string }

export type ParseExpiresInDaysResult =
    { ok: true; value: number | undefined } | { ok: false; error: string }

// Validates the "expires in days" field before it is sent to the backend.
// The backend model field is `ExpiresInDays int`, so a fractional value would
// fail JSON binding; reject it locally. Blank and 0 both mean "never expires"
// (undefined), matching the create handler's `expires_in_days == 0` semantics.
export function parseExpiresInDaysInput(raw: string): ParseExpiresInDaysResult {
    const trimmed = raw.trim()
    if (trimmed === "") return { ok: true, value: undefined }
    if (!/^\d+$/.test(trimmed)) return { ok: false, error: `invalid expiry: ${raw}` }
    const n = Number(trimmed)
    if (!Number.isInteger(n) || n < 0 || n > 3650) {
        return { ok: false, error: `invalid expiry: ${raw}` }
    }
    return { ok: true, value: n > 0 ? n : undefined }
}

export function parseServerIDsInput(raw: string): ParseServerIDsResult {
    const trimmed = raw.trim()
    if (trimmed === "") return { ok: true, value: undefined }
    const parts = trimmed.split(",").map((s) => s.trim())
    const out: number[] = []
    const seen = new Set<number>()
    for (const p of parts) {
        if (p === "") return { ok: false, error: "empty server id" }
        if (!/^\d+$/.test(p)) return { ok: false, error: `invalid server id: ${p}` }
        const n = Number(p)
        // Server IDs are uint64 on the backend; reject values that lose
        // precision as a JS number, otherwise the PAT could bind to a
        // different server than the operator typed.
        if (!Number.isSafeInteger(n) || n <= 0)
            return { ok: false, error: `invalid server id: ${p}` }
        if (seen.has(n)) continue
        seen.add(n)
        out.push(n)
    }
    return { ok: true, value: out }
}
