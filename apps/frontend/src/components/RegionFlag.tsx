// Adapted from zool-theme/src/components/bits.tsx (MIT, luoleiorg).
import { useStore } from "@/app/store"
import { regionFlagCode, regionName } from "@/core/region"
import { GlobeIcon } from "@phosphor-icons/react"
import { useTranslation } from "react-i18next"

export function RegionFlag({ code, className }: { code: string; className?: string }) {
    const loggedIn = useStore((s) => s.session.loggedIn)
    const { i18n } = useTranslation()
    if (!code) return null
    const cc = regionFlagCode(code, loggedIn)
    const label = regionName(code, i18n.language)
    const cls = className ? `region-flag ${className}` : "region-flag"
    if (!cc) {
        return <GlobeIcon width={16} height={12} role="img" aria-label={label} className={cls} />
    }
    return (
        <img
            className={cls}
            src={`/flags/${cc}.svg`}
            alt={label}
            width={16}
            height={12}
            loading="lazy"
            decoding="async"
        />
    )
}
