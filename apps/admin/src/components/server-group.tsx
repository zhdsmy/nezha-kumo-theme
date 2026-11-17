import { createServerGroup, updateServerGroup } from "@/api/server-group"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { IconButton } from "@/components/xui/icon-button"
import { MultiSelect } from "@/components/xui/multi-select"
import { useServer } from "@/hooks/useServer"
import useSetting from "@/hooks/useSetting"
import { useSubmitLock } from "@/hooks/useSubmitLock"
import { saveServerGroupIcon } from "@/lib/group-icons"
import { errorMessage } from "@/lib/utils"
import { ModelServerGroupResponseItem } from "@/types"
import { zodResolver } from "@hookform/resolvers/zod"
import { AlertCircle, Folder, ImageOff } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { KeyedMutator } from "swr"
import { z } from "zod"

import { classifyGroupIcon, parseGroupIcons } from "../../../../packages/shared/group-icons"

interface ServerGroupCardProps {
    data?: ModelServerGroupResponseItem
    mutate: KeyedMutator<ModelServerGroupResponseItem[]>
}

export const ServerGroupCard: React.FC<ServerGroupCardProps> = ({ data, mutate }) => {
    const { t } = useTranslation()
    const { data: settingData, mutate: mutateSetting } = useSetting()
    const existingIcon = useMemo(() => {
        if (!data?.group.id) return ""
        return parseGroupIcons(settingData?.config?.custom_code)[String(data.group.id)] ?? ""
    }, [data?.group.id, settingData?.config?.custom_code])

    const serverGroupFormSchema = useMemo(
        () =>
            z.object({
                name: z.string().min(1),
                servers: z.array(z.number()),
                icon: z.string().refine((val) => !val.trim() || classifyGroupIcon(val) !== null, {
                    message: t("GroupIconInvalid"),
                }),
            }),
        [t],
    )

    type FormValues = z.infer<typeof serverGroupFormSchema>

    const form = useForm<FormValues>({
        resolver: zodResolver(serverGroupFormSchema),
        defaultValues: {
            name: data?.group.name ?? "",
            servers: data?.servers ?? [],
            icon: existingIcon,
        },
        resetOptions: {
            keepDefaultValues: false,
        },
    })

    const savedGroup = useRef<{ id: number; payload: string } | null>(null)
    const [open, setOpen] = useState(false)
    const [failedUrl, setFailedUrl] = useState<string | null>(null)

    useEffect(() => {
        if (open && !form.formState.dirtyFields.icon) {
            form.setValue("icon", existingIcon)
        }
    }, [open, existingIcon, form])

    const handleOpenChange = (nextOpen: boolean) => {
        if (nextOpen) {
            savedGroup.current = null
            setFailedUrl(null)
            form.reset({
                name: data?.group.name ?? "",
                servers: data?.servers ?? [],
                icon: existingIcon,
            })
        }
        setOpen(nextOpen)
    }

    const { submitting, runSubmit } = useSubmitLock()

    const onSubmit = runSubmit(async (values: FormValues) => {
        let groupId = savedGroup.current?.id ?? data?.group.id
        try {
            const payload = { name: values.name, servers: values.servers }
            const serialized = JSON.stringify(payload)
            if (savedGroup.current?.payload !== serialized) {
                if (groupId) {
                    await updateServerGroup(groupId, payload)
                } else {
                    groupId = await createServerGroup(payload)
                }
                // Keep the successful write while the separate icon save is retried.
                savedGroup.current = { id: groupId, payload: serialized }
            }
        } catch (e) {
            console.error(e)
            toast.error(t("Error"), {
                description: errorMessage(e, t("Results.UnExpectedError")),
            })
            return
        }

        if (typeof groupId === "number" && Number.isFinite(groupId) && groupId > 0) {
            try {
                const updated = await saveServerGroupIcon(groupId, values.icon)
                if (updated) {
                    await mutateSetting()
                }
            } catch (e) {
                console.error(e)
                await mutate()
                toast.error(t("Error"), {
                    description: errorMessage(e, t("Results.UnExpectedError")),
                })
                return
            }
        }

        setOpen(false)
        await mutate()
        form.reset()
    })

    const { servers } = useServer()
    const serverList = servers?.map((s) => ({
        value: `${s.id}`,
        label: s.name,
    })) || [{ value: "", label: "" }]

    const rawIcon = form.watch("icon") ?? ""
    const trimmedIcon = rawIcon.trim()
    const parsedIcon = trimmedIcon ? classifyGroupIcon(trimmedIcon) : null
    const imageLoadFailed = parsedIcon?.kind === "image" && failedUrl === parsedIcon.value

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                {data ? <IconButton variant="outline" icon="edit" /> : <IconButton icon="plus" />}
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
                <div className="nkt-dialog-form">
                    <div className="items-center mx-1">
                        <DialogHeader>
                            <DialogTitle>
                                {data ? t("EditServerGroup") : t("CreateServerGroup")}
                            </DialogTitle>
                            <DialogDescription />
                        </DialogHeader>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2 my-2">
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t("Name")}</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder={t("Placeholders.GroupName")}
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="icon"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t("GroupIcon")}</FormLabel>
                                            <div className="flex items-center gap-2.5">
                                                <FormControl>
                                                    <Input
                                                        placeholder={t("GroupIconPlaceholder")}
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <div
                                                    data-testid="group-icon-preview"
                                                    aria-hidden="true"
                                                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-muted/40"
                                                >
                                                    {!trimmedIcon ? (
                                                        <Folder className="h-4 w-4 text-muted-foreground" />
                                                    ) : !parsedIcon ? (
                                                        <AlertCircle className="h-4 w-4 text-destructive" />
                                                    ) : parsedIcon.kind === "text" ? (
                                                        <span className="max-w-[30px] truncate text-base leading-none select-none">
                                                            {parsedIcon.value}
                                                        </span>
                                                    ) : imageLoadFailed ? (
                                                        <ImageOff className="h-4 w-4 text-destructive" />
                                                    ) : (
                                                        <img
                                                            key={parsedIcon.value}
                                                            src={parsedIcon.value}
                                                            alt=""
                                                            referrerPolicy="no-referrer"
                                                            className="h-5 w-5 rounded object-contain"
                                                            onLoad={() => {
                                                                if (
                                                                    failedUrl === parsedIcon.value
                                                                ) {
                                                                    setFailedUrl(null)
                                                                }
                                                            }}
                                                            onError={() =>
                                                                setFailedUrl(parsedIcon.value)
                                                            }
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                            {imageLoadFailed ? (
                                                <p
                                                    role="alert"
                                                    className="text-xs font-medium text-destructive"
                                                >
                                                    {t("GroupIconLoadError")}
                                                </p>
                                            ) : (
                                                <FormDescription className="text-xs">
                                                    {t("GroupIconHint")}
                                                </FormDescription>
                                            )}
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="servers"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t("Server")}</FormLabel>
                                            <FormControl>
                                                <MultiSelect
                                                    options={serverList}
                                                    onValueChange={(e) => {
                                                        const arr = e.map(Number)
                                                        field.onChange(arr)
                                                    }}
                                                    defaultValue={field.value?.map(String)}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <DialogFooter className="justify-end">
                                    <DialogClose asChild>
                                        <Button type="button" className="my-2" variant="secondary">
                                            {t("Close")}
                                        </Button>
                                    </DialogClose>
                                    <Button type="submit" className="my-2" loading={submitting}>
                                        {t("Confirm")}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
