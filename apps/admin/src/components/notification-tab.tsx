import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useTranslation } from "react-i18next"
import { Link, useLocation } from "react-router-dom"

export const NotificationTab = ({ className }: { className?: string }) => {
    const { t } = useTranslation()
    const location = useLocation()

    const activeTab = location.pathname.replace(/\/+$/, "") || "/"

    return (
        <Tabs value={activeTab} className={className}>
            <TabsList className="flex w-max max-w-full overflow-x-auto justify-start">
                <TabsTrigger value="/dashboard/notification" asChild>
                    <Link to="/dashboard/notification">{t("Notifier")}</Link>
                </TabsTrigger>
                <TabsTrigger value="/dashboard/alert-rule" asChild>
                    <Link to="/dashboard/alert-rule">{t("AlertRule")}</Link>
                </TabsTrigger>
            </TabsList>
        </Tabs>
    )
}
