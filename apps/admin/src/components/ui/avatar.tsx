import { cn } from "@/lib/utils"
import * as AvatarPrimitive from "@radix-ui/react-avatar"
import { User2 } from "lucide-react"
import { ComponentPropsWithoutRef, ComponentRef, forwardRef } from "react"

const CJK_CHAR_RE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u

// Each fill achieves >= 5.0:1 WCAG contrast against #ffffff in both light and dark modes.
const AVATAR_PALETTE = [
    "#1d4ed8",
    "#0f766e",
    "#15803d",
    "#b45309",
    "#be123c",
    "#6d28d9",
    "#0369a1",
    "#c2410c",
] as const

export function getAvatarInitials(username?: string | null): string {
    const trimmed = (username ?? "").trim()
    if (!trimmed) return ""
    const chars = Array.from(trimmed)
    if (CJK_CHAR_RE.test(chars[0])) {
        return chars[0]
    }
    const parts = trimmed.split(/[\s._-]+/).filter(Boolean)
    if (parts.length >= 2) {
        const first = Array.from(parts[0])[0] ?? ""
        const second = Array.from(parts[1])[0] ?? ""
        if (CJK_CHAR_RE.test(first)) return first
        if (CJK_CHAR_RE.test(second)) return first.toUpperCase()
        return (first + second).toUpperCase()
    }
    if (chars.length >= 2 && CJK_CHAR_RE.test(chars[1])) {
        return chars[0].toUpperCase()
    }
    return chars.slice(0, 2).join("").toUpperCase()
}

export function getAvatarColor(username?: string | null): {
    backgroundColor: string
    color: string
} {
    const trimmed = (username ?? "").trim()
    if (!trimmed) {
        return { backgroundColor: "#475569", color: "#ffffff" }
    }
    let hash = 2166136261
    for (const ch of trimmed) {
        hash ^= ch.codePointAt(0)!
        hash = Math.imul(hash, 16777619)
    }
    const backgroundColor = AVATAR_PALETTE[(hash >>> 0) % AVATAR_PALETTE.length]
    return { backgroundColor, color: "#ffffff" }
}

const Avatar = forwardRef<
    ComponentRef<typeof AvatarPrimitive.Root>,
    ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
    <AvatarPrimitive.Root
        ref={ref}
        className={cn("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full", className)}
        {...props}
    />
))
Avatar.displayName = AvatarPrimitive.Root.displayName

const AvatarImage = forwardRef<
    ComponentRef<typeof AvatarPrimitive.Image>,
    ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
    <AvatarPrimitive.Image
        ref={ref}
        className={cn("aspect-square h-full w-full", className)}
        {...props}
    />
))
AvatarImage.displayName = AvatarPrimitive.Image.displayName

const AvatarFallback = forwardRef<
    ComponentRef<typeof AvatarPrimitive.Fallback>,
    ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
    <AvatarPrimitive.Fallback
        ref={ref}
        className={cn(
            "flex h-full w-full items-center justify-center rounded-full bg-muted",
            className,
        )}
        {...props}
    />
))
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName

export type UserAvatarProps = ComponentPropsWithoutRef<typeof Avatar> & {
    username?: string | null
    fallbackClassName?: string
}

const UserAvatar = forwardRef<ComponentRef<typeof Avatar>, UserAvatarProps>(
    ({ username, className, fallbackClassName, ...props }, ref) => {
        const initials = getAvatarInitials(username)
        const style = getAvatarColor(username)
        return (
            <Avatar ref={ref} className={className} {...props}>
                <AvatarFallback
                    style={style}
                    className={cn("font-semibold select-none", fallbackClassName)}
                >
                    {initials || <User2 className="size-1/2" aria-hidden="true" />}
                </AvatarFallback>
            </Avatar>
        )
    },
)
UserAvatar.displayName = "UserAvatar"

export { Avatar, AvatarImage, AvatarFallback, UserAvatar }
