import { navigate, usePathname } from "@/app/router"
import { nodeHref, useStore, useVisibleNodes } from "@/app/store"
import type { NodeInfo } from "@/core/model"
import { regionName, stripFlag } from "@/core/region"
import { Button } from "@cloudflare/kumo/components/button"
import { CommandPalette, type HighlightRange } from "@cloudflare/kumo/components/command-palette"
import { Dialog } from "@cloudflare/kumo/components/dialog"
import { XIcon } from "@phosphor-icons/react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { RegionFlag } from "./RegionFlag"
import { Status, useScrollMore } from "./ui"

export interface SearchPaletteProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function findHighlightRanges(text: string, rawQuery: string): HighlightRange[] {
    const q = rawQuery.trim().toLowerCase()
    if (!q) return []
    const hay = text.toLowerCase()
    if (hay.length !== text.length) return []
    const ranges: HighlightRange[] = []
    let from = 0
    while (from <= hay.length - q.length) {
        const idx = hay.indexOf(q, from)
        if (idx === -1) break
        ranges.push([idx, idx + q.length - 1])
        from = idx + q.length
    }
    return ranges
}

function SearchStatus({ id }: { id: string }) {
    const snapshot = useStore((s) => s.snapshots[id])
    return <Status snapshot={snapshot} />
}

export function SearchPalette({ open, onOpenChange }: SearchPaletteProps) {
    const { t, i18n } = useTranslation()
    const [query, setQuery] = useState("")
    const nodes = useVisibleNodes()
    const showRegions = useStore((s) => s.settings.showRegions)
    const pathname = usePathname()
    const url = useMemo(() => new URL(pathname, window.location.origin), [pathname])

    useEffect(() => {
        if (!open) setQuery("")
    }, [open])

    const handleOpenChange = useCallback(
        (next: boolean) => {
            if (!next) setQuery("")
            onOpenChange(next)
        },
        [onOpenChange],
    )

    const trimmed = query.trim().toLowerCase()
    const matches = useMemo(
        () =>
            !trimmed
                ? nodes
                : nodes.filter((n) => {
                      const regionText = showRegions
                          ? `${n.region} ${regionName(n.region, i18n.language)}`
                          : ""
                      return `${n.name} ${stripFlag(n.name)} ${regionText} ${n.groups.join(" ")}`
                          .toLowerCase()
                          .includes(trimmed)
                  }),
        [nodes, trimmed, showRegions, i18n.language],
    )
    const listRef = useScrollMore<HTMLDivElement>(open, matches.length)

    const openNode = useCallback(
        (id: string, newTab = false) => {
            const href = nodeHref(id, url)
            setQuery("")
            onOpenChange(false)
            if (newTab) {
                window.open(href, "_blank", "noopener")
            } else {
                navigate(href)
            }
        },
        [url, onOpenChange],
    )

    return (
        <CommandPalette.Dialog open={open} onOpenChange={handleOpenChange}>
            <Dialog.Title className="sr-only">{t("toolbar.search")}</Dialog.Title>
            <CommandPalette.Panel
                className="nk-search-palette"
                items={matches}
                value={query}
                onValueChange={setQuery}
                itemToStringValue={(n) => stripFlag(n.name)}
                getSelectableItems={(items) => items}
                onSelect={(n, { newTab }) => openNode(n.id, newTab)}
                open={open}
            >
                <CommandPalette.Input
                    aria-label={t("toolbar.search")}
                    placeholder={t("toolbar.searchPlaceholder")}
                    trailing={
                        <Dialog.Close
                            render={(props) => (
                                <Button
                                    {...props}
                                    variant="ghost"
                                    size="sm"
                                    shape="square"
                                    className="dialog-close-btn"
                                    aria-label={t("auth.close")}
                                >
                                    <XIcon size={16} />
                                </Button>
                            )}
                        />
                    }
                />
                <CommandPalette.List ref={listRef} className="search-results">
                    <CommandPalette.Results>
                        {(n: NodeInfo) => {
                            const name = stripFlag(n.name)
                            const groupText = n.groups.join(" · ")
                            return (
                                <CommandPalette.Item
                                    key={n.id}
                                    value={n}
                                    className="search-result"
                                    onClick={(e) => openNode(n.id, e.metaKey || e.ctrlKey)}
                                >
                                    {showRegions && n.region && <RegionFlag code={n.region} />}
                                    <span className="search-result-main">
                                        <span className="search-result-name" title={name}>
                                            <CommandPalette.HighlightedText
                                                text={name}
                                                highlights={findHighlightRanges(name, query)}
                                            />
                                        </span>
                                        {groupText && (
                                            <span className="search-result-groups muted">
                                                <CommandPalette.HighlightedText
                                                    text={groupText}
                                                    highlights={findHighlightRanges(
                                                        groupText,
                                                        query,
                                                    )}
                                                />
                                            </span>
                                        )}
                                    </span>
                                    <SearchStatus id={n.id} />
                                </CommandPalette.Item>
                            )
                        }}
                    </CommandPalette.Results>
                    <CommandPalette.Empty>{t("toolbar.noResults")}</CommandPalette.Empty>
                </CommandPalette.List>
                <CommandPalette.Footer>
                    <span>{t("toolbar.searchHint")}</span>
                    <kbd className="sidebar-search-kbd">Esc</kbd>
                </CommandPalette.Footer>
            </CommandPalette.Panel>
        </CommandPalette.Dialog>
    )
}
