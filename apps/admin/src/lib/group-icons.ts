import { getSettings, updateSettings } from "@/api/settings"

import {
    type GroupIcons,
    classifyGroupIcon,
    parseGroupIcons,
    updateGroupIconsInCustomCode,
} from "../../../../packages/shared/group-icons"

export async function syncGroupIcons(mutateIcons: (icons: GroupIcons) => void): Promise<boolean> {
    const latest = await getSettings()
    const config = structuredClone(latest.config)
    const prevCustomCode = config.custom_code ?? ""
    const icons = parseGroupIcons(prevCustomCode)
    mutateIcons(icons)
    const nextCustomCode = updateGroupIconsInCustomCode(prevCustomCode, icons)
    if (nextCustomCode === prevCustomCode) {
        return false
    }
    await updateSettings({
        ...config,
        custom_code: nextCustomCode,
    })
    return true
}

export async function saveServerGroupIcon(groupId: number, rawIcon: string): Promise<boolean> {
    const parsed = classifyGroupIcon(rawIcon)
    return syncGroupIcons((icons) => {
        const key = String(groupId)
        if (parsed) {
            icons[key] = parsed.value
        } else {
            delete icons[key]
        }
    })
}

export async function removeServerGroupIcons(groupIds: readonly number[]): Promise<boolean> {
    if (!groupIds.length) return false
    return syncGroupIcons((icons) => {
        for (const id of groupIds) {
            delete icons[String(id)]
        }
    })
}

export async function loadVpsIcons() {
    return (await import("./vps-icons.json")).default
}

export async function isValidGroupIcon(raw: string): Promise<boolean> {
    if (!raw.trim()) return true
    const parsed = classifyGroupIcon(raw)
    if (parsed?.kind !== "vps") return parsed !== null
    return (await loadVpsIcons()).some((icon) => icon.slug === parsed.slug)
}
