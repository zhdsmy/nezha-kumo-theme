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
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { KeyedMutator } from "swr"

export interface ConfirmActionDialogProps {
    trigger: React.ReactNode
    title?: React.ReactNode
    description: React.ReactNode
    confirmVariant?: "default" | "destructive"
    onConfirm: () => void | Promise<void>
}

export function ConfirmActionDialog({
    trigger,
    title,
    description,
    confirmVariant = "destructive",
    onConfirm,
}: ConfirmActionDialogProps) {
    const { t } = useTranslation()
    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
            <AlertDialogContent className="sm:max-w-lg">
                <AlertDialogHeader>
                    <AlertDialogTitle>{title ?? t("ConfirmDeletion")}</AlertDialogTitle>
                    <AlertDialogDescription>{description}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>{t("Close")}</AlertDialogCancel>
                    <AlertDialogAction
                        className={buttonVariants({
                            variant: confirmVariant,
                        })}
                        onClick={onConfirm}
                    >
                        {t("Confirm")}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}

interface ButtonGroupProps<E, U> {
    className?: string
    children: React.ReactNode
    delete: { fn: (id: E[]) => Promise<void>; id: E; mutate: KeyedMutator<U> }
}

interface BlockButtonGroupProps<E, U> {
    className?: string
    children?: React.ReactNode
    block: { fn: (id: E[]) => Promise<void>; id: E; mutate: KeyedMutator<U> }
}

export function ActionButtonGroup<E, U>({
    className,
    children,
    delete: { fn, id, mutate },
}: ButtonGroupProps<E, U>) {
    const { t } = useTranslation()
    const handleDelete = async () => {
        try {
            await fn([id])
        } catch (error: any) {
            toast(t("Error"), {
                description: error.message,
            })
        }
        await mutate()
    }

    return (
        <div className={className}>
            {children}
            <ConfirmActionDialog
                trigger={<IconButton variant="destructive" icon="trash" />}
                title={t("ConfirmDeletion")}
                description={t("Results.ThisOperationIsUnrecoverable")}
                onConfirm={handleDelete}
            />
        </div>
    )
}

export function BlockButtonGroup<E, U>({
    className,
    children,
    block: { fn, id, mutate },
}: BlockButtonGroupProps<E, U>) {
    const { t } = useTranslation()

    const handleBlock = async () => {
        try {
            await fn([id])
        } catch (error: any) {
            toast(t("Error"), {
                description: error.message,
            })
        }
        await mutate()
    }
    return (
        <div className={className}>
            {children}
            <ConfirmActionDialog
                trigger={<IconButton variant="destructive" icon="ban" />}
                title={t("ConfirmBlock")}
                description={t("Results.ThisOperationIsUnrecoverable")}
                onConfirm={handleBlock}
            />
        </div>
    )
}
