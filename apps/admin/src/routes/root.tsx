import AdminShell, { AdminActions } from "@/components/admin-shell"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import useSetting from "@/hooks/useSetting"
import i18n from "@/lib/i18n"
import { InjectContext } from "@/lib/inject"
import { useEffect } from "react"
import { useLocation } from "react-router-dom"
import { Outlet } from "react-router-dom"

export default function Root() {
    const { pathname } = useLocation()
    const { data: settingData, error } = useSetting()

    useEffect(() => {
        document.title = settingData?.config?.site_name || "哪吒监控 Nezha Monitoring"
    }, [settingData?.config?.site_name])

    useEffect(() => {
        if (settingData?.config?.custom_code_dashboard) {
            InjectContext(settingData?.config?.custom_code_dashboard)
        }
    }, [settingData?.config?.custom_code_dashboard])

    useEffect(() => {
        if (settingData?.config?.language && !localStorage.getItem("language")) {
            i18n.changeLanguage(settingData?.config?.language)
        }
    }, [settingData?.config?.language])

    if (error) {
        throw error
    }

    if (!settingData) {
        return null
    }

    return (
        <ThemeProvider>
            {pathname === "/dashboard/login" ? (
                <div className="nk-shell flex flex-col">
                    <div className="flex shrink-0 items-center justify-end gap-2 px-4 pt-3">
                        <AdminActions />
                    </div>
                    <main className="nk-main">
                        <Outlet />
                    </main>
                </div>
            ) : (
                <AdminShell
                    siteName={settingData.config?.site_name || "Nezha"}
                    version={settingData.version}
                >
                    <Outlet />
                </AdminShell>
            )}
            <Toaster />
        </ThemeProvider>
    )
}
