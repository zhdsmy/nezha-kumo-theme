import { useAuth } from "@/hooks/useAuth"
import { useMainStore } from "@/hooks/useMainStore"
import { LogOut, Settings, User2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"

import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "./ui/dropdown-menu"

export default function UserMenu() {
    const { t } = useTranslation()
    const { logout } = useAuth()
    const profile = useMainStore((store) => store.profile)
    const [dropdownOpen, setDropdownOpen] = useState(false)
    const navigate = useNavigate()
    return (
        profile && (
            <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
                <DropdownMenuTrigger asChild>
                    <button
                        type="button"
                        aria-label={profile.username}
                        title={profile.username}
                        className="shrink-0 rounded-lg focus-visible:outline-2 focus-visible:outline-ring"
                    >
                        <Avatar className="size-8 border">
                            <AvatarImage
                                src={
                                    "https://api.dicebear.com/7.x/notionists/svg?seed=" +
                                    encodeURIComponent(profile.username)
                                }
                                alt=""
                            />
                            <AvatarFallback className="text-xs">
                                {Array.from(profile.username).slice(0, 2).join("").toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuLabel className="break-all">{profile.username}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                        <DropdownMenuItem
                            onSelect={() => navigate("/dashboard/profile")}
                            className="cursor-pointer"
                        >
                            <User2 />
                            {t("Profile")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onSelect={() => navigate("/dashboard/settings")}
                            className="cursor-pointer"
                        >
                            <Settings />
                            {t("Settings")}
                        </DropdownMenuItem>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={logout} className="cursor-pointer">
                        <LogOut />
                        {t("Logout")}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        )
    )
}
