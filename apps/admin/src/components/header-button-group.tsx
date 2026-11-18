import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { buttonVariants } from "@/components/ui/button"
import { IconButton } from "@/components/xui/icon-button"
import { errorMessage } from "@/lib/utils"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { KeyedMutator } from "swr"

interface ButtonGroupProps<E, U> {
    className?: string
    children?: React.ReactNode
    delete: { fn: (id: E[]) => Promise<void>; id: E[]; mutate: KeyedMutator<U> }
}

interface ButtonBlockGroupProps<E, U> {
    className?: string
    children?: React.ReactNode
    block: { fn: (id: E[]) => Promise<void>; id: E[]; mutate: KeyedMutator<U> }
}

export function HeaderButtonGroup<E, U>({
    className,
    children,
    delete: { fn, id, mutate },
}: ButtonGroupProps<E, U>) {
    const { t } = useTranslation()

    const handleDelete = async () => {
        try {
            await fn(id)
        } catch (error) {
            toast.error(t("Error"), {
                description: errorMessage(error, t("Results.UnExpectedError")),
            })
        }
        await mutate()
    }

    return (
        <div className={className}>
            {id.length > 0 && (
                <span className="self-center px-1 text-sm font-medium text-muted-foreground tabular-nums">
                    {t("SelectedCount", { count: id.length })}
                </span>
            )}
            {id.length < 1 ? (
                <IconButton
                    variant="destructive"
                    icon="trash"
                    disabled
                    title={t("Results.NoRowsAreSelected")}
                />
            ) : (
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <IconButton variant="destructive" icon="trash" />
                    </AlertDialogTrigger>
                    <AlertDialogContent className="sm:max-w-lg">
                        <AlertDialogHeader>
                            <AlertDialogTitle>{t("ConfirmDeletion")}</AlertDialogTitle>
                            <AlertDialogDescription>
                                {t("ConfirmBatchDelete", { count: id.length })}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
                            <AlertDialogAction
                                className={buttonVariants({
                                    variant: "destructive",
                                })}
                                onClick={handleDelete}
                            >
                                {t("Confirm")}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}
            {children}
        </div>
    )
}

export function HeaderBlockButtonGroup<E, U>({
    className,
    children,
    block: { fn, id, mutate },
}: ButtonBlockGroupProps<E, U>) {
    const { t } = useTranslation()

    const handleBlock = async () => {
        try {
            await fn(id)
        } catch (error) {
            toast.error(t("Error"), {
                description: errorMessage(error, t("Results.UnExpectedError")),
            })
        }
        await mutate()
    }

    return (
        <div className={className}>
            {id.length > 0 && (
                <span className="self-center px-1 text-sm font-medium text-muted-foreground tabular-nums">
                    {t("SelectedCount", { count: id.length })}
                </span>
            )}
            {id.length < 1 ? (
                <IconButton
                    variant="destructive"
                    icon="ban"
                    disabled
                    title={t("Results.NoRowsAreSelected")}
                />
            ) : (
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <IconButton variant="destructive" icon="ban" />
                    </AlertDialogTrigger>
                    <AlertDialogContent className="sm:max-w-lg">
                        <AlertDialogHeader>
                            <AlertDialogTitle>{t("ConfirmBlock")}</AlertDialogTitle>
                            <AlertDialogDescription>
                                {t("ConfirmBatchBlock", { count: id.length })}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
                            <AlertDialogAction
                                className={buttonVariants({
                                    variant: "destructive",
                                })}
                                onClick={handleBlock}
                            >
                                {t("Confirm")}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}
            {children}
        </div>
    )
}
