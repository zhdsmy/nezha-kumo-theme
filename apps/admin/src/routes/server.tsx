import { swrFetcher } from "@/api/api"
import { deleteServer, forceUpdateServer } from "@/api/server"
import { ActionButtonGroup } from "@/components/action-button-group"
import { BatchMoveServerIcon } from "@/components/batch-move-server-icon"
import { CopyButton } from "@/components/copy-button"
import { flagCell } from "@/components/flag"
import { HeaderButtonGroup } from "@/components/header-button-group"
import { InstallCommandsMenu } from "@/components/install-commands"
import { NoteMenu } from "@/components/note-menu"
import { ServerCard } from "@/components/server"
import { ServerConfigCard } from "@/components/server-config"
import { ServerConfigCardBatch } from "@/components/server-config-batch"
import { TerminalButton } from "@/components/terminal"
import { Checkbox } from "@/components/ui/checkbox"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { IconButton } from "@/components/xui/icon-button"
import { useServer } from "@/hooks/useServer"
import { selectableTableFeatures, useSelectableTable } from "@/lib/table"
import { errorMessage } from "@/lib/utils"
import { ModelServerTaskResponse, ModelServer as Server } from "@/types"
import { Page } from "@nezha-kumo/ui"
import { ColumnDef, flexRender } from "@tanstack/react-table"
import { useEffect, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import useSWR from "swr"

export default function ServerPage() {
    const { t } = useTranslation()
    const { data, mutate, error, isLoading } = useSWR<Server[]>("/api/v1/server", swrFetcher, {
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
    })
    const { serverGroups } = useServer()

    useEffect(() => {
        if (error)
            toast.error(t("Error"), {
                description: t("Results.ErrorFetchingResource", { error: error.message }),
            })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [error])

    const columns: ColumnDef<typeof selectableTableFeatures, Server>[] = [
        {
            id: "select",
            header: ({ table }) => (
                <Checkbox
                    checked={
                        table.getIsAllPageRowsSelected() ||
                        (table.getIsSomePageRowsSelected() && "indeterminate")
                    }
                    onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                    aria-label={t("SelectAll")}
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    checked={row.getIsSelected()}
                    onCheckedChange={(value) => row.toggleSelected(!!value)}
                    aria-label={t("SelectRow")}
                />
            ),
            enableHiding: false,
        },
        {
            header: "ID",
            accessorKey: "id",
            accessorFn: (row) => `${row.id}(${row.display_index})`,
            cell: ({ row }) => (
                <span
                    className="whitespace-nowrap"
                    title={`${t("Weight")} ${row.original.display_index}`}
                >
                    {row.original.id}
                    <span className="text-muted-foreground"> · {row.original.display_index}</span>
                </span>
            ),
        },
        {
            header: t("Name"),
            accessorKey: "name",
            accessorFn: (row) => row.name,
            cell: ({ row }) => {
                const s = row.original
                const cc = s.geoip?.country_code?.toLowerCase()
                return (
                    <div className="nkt-server-name min-w-32 max-w-40 sm:max-w-56 whitespace-normal break-words font-medium">
                        {/^[a-z]{2}$/.test(cc ?? "") && (
                            // Flag SVGs ship with the frontend theme on the same origin.
                            <img
                                src={`/flags/${cc}.svg`}
                                alt={cc!.toUpperCase()}
                                width={16}
                                height={12}
                                loading="lazy"
                                className="mr-2 inline-block rounded-[2px] align-[-1px]"
                                onError={(e) => e.currentTarget.remove()}
                            />
                        )}
                        {s.name}
                    </div>
                )
            },
        },
        {
            header: t("Group"),
            accessorKey: "groups",
            accessorFn: (row) => {
                return (
                    serverGroups
                        ?.filter((sg) => sg.servers?.includes(row.id))
                        .map((sg) => sg.group.id) || []
                )
            },
        },
        {
            id: "owner",
            header: t("Owner"),
            // Backend Server.MarshalJSON always emits owner.id; username is
            // omitted for uid=0 (legacy global agent secret) and for users
            // that no longer exist. Render uid=0 as "Global Agent" and a
            // missing username as "Unknown user (#id)" so deleted-user rows
            // stay debuggable instead of silently appearing ownerless.
            accessorFn: (row) => {
                if (!row.owner) return ""
                if (row.owner.id === 0) return t("GlobalAgent")
                return row.owner.username || t("UnknownUser", { id: row.owner.id })
            },
            cell: ({ row }) => {
                const owner = row.original.owner
                if (!owner) {
                    return <span className="text-muted-foreground">-</span>
                }
                if (owner.id === 0) {
                    return <span>{t("GlobalAgent")}</span>
                }
                const label = owner.username || t("UnknownUser", { id: owner.id })
                return (
                    <div
                        className="max-w-32 whitespace-normal break-words"
                        title={`uid=${owner.id}`}
                    >
                        {label}
                    </div>
                )
            },
        },
        {
            id: "geoip",
            header: "IP",
            cell: ({ row }) => {
                const s = row.original
                return (
                    <div className="min-w-36 max-w-48 break-all leading-snug">
                        {[s.geoip?.ip?.ipv4_addr, s.geoip?.ip?.ipv6_addr]
                            .filter(Boolean)
                            .map((a) => (
                                <div key={a}>{a}</div>
                            ))}
                    </div>
                )
            },
        },
        {
            header: t("Version"),
            accessorKey: "host.version",
            accessorFn: (row) => row.host.version || t("Unknown"),
        },
        {
            header: t("EnableDDNS"),
            accessorKey: "enableDDNS",
            accessorFn: (row) => row.enable_ddns ?? false,
            cell: flagCell,
        },
        {
            header: t("HideForGuest"),
            accessorKey: "hideForGuest",
            accessorFn: (row) => row.hide_for_guest ?? false,
            cell: flagCell,
        },
        {
            id: "note",
            header: t("Note"),
            cell: ({ row }) => {
                const s = row.original
                return <NoteMenu note={{ private: s.note, public: s.public_note }} />
            },
        },
        {
            id: "uuid",
            header: "UUID",
            cell: ({ row }) => {
                const s = row.original
                return <CopyButton text={s.uuid} />
            },
        },
        {
            id: "actions",
            header: t("Actions"),
            cell: ({ row }) => {
                const s = row.original
                return (
                    <ActionButtonGroup
                        className="flex gap-2"
                        delete={{ fn: deleteServer, id: s.id, mutate: mutate }}
                    >
                        <>
                            <ServerCard mutate={mutate} data={s} />
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <IconButton
                                        icon="more"
                                        variant="outline"
                                        aria-label={t("MoreActions")}
                                    />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem asChild>
                                        <TerminalButton id={s.id} menuItem />
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        asChild
                                        onSelect={(event) => event.preventDefault()}
                                    >
                                        <ServerConfigCard sid={s.id} variant="ghost" menuItem />
                                    </DropdownMenuItem>
                                    <InstallCommandsMenu uuid={s.uuid} menuItem />
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </>
                    </ActionButtonGroup>
                )
            },
        },
    ]

    const dataCache = useMemo(() => {
        return data ?? []
    }, [data])

    const table = useSelectableTable(dataCache, columns)

    const selectedRows = table.getSelectedRowModel().rows
    const selectedServerIds = selectedRows.map((r) => r.original.id)

    return (
        <Page
            title={t("Server")}
            actions={
                <HeaderButtonGroup
                    className="flex gap-2 flex-wrap shrink-0"
                    delete={{
                        fn: deleteServer,
                        id: selectedServerIds,
                        mutate: mutate,
                    }}
                >
                    <IconButton
                        icon="update"
                        disabled={selectedServerIds.length === 0}
                        title={
                            selectedServerIds.length === 0
                                ? t("Results.NoRowsAreSelected")
                                : undefined
                        }
                        onClick={async () => {
                            let resp: ModelServerTaskResponse = {}
                            try {
                                resp = await forceUpdateServer(selectedServerIds)
                            } catch (e) {
                                console.error(e)
                                toast.error(t("Error"), {
                                    description: errorMessage(e, t("Results.UnExpectedError")),
                                })
                                return
                            }
                            const notify =
                                resp.failure?.length || resp.offline?.length
                                    ? toast.warning
                                    : toast.success
                            notify(t("Done"), {
                                description:
                                    t("Results.ForceUpdate") +
                                    (resp.success?.length
                                        ? t(`Success`) + ` [${resp.success.join(",")}]`
                                        : "") +
                                    (resp.failure?.length
                                        ? t(`Failure`) + ` [${resp.failure.join(",")}]`
                                        : "") +
                                    (resp.offline?.length
                                        ? t(`Offline`) + ` [${resp.offline.join(",")}]`
                                        : ""),
                            })
                        }}
                    />
                    <BatchMoveServerIcon serverIds={selectedServerIds} />
                    <ServerConfigCardBatch sid={selectedServerIds} />
                    <InstallCommandsMenu className="rounded-lg" />
                </HeaderButtonGroup>
            }
        >
            <div>
                <Table
                    columnPriority={[
                        ["id", 108],
                        ["groups", 80],
                        ["geoip", 156],
                        ["host_version", 92],
                        ["owner", 120],
                        ["enableDDNS", 100],
                        ["hideForGuest", 110],
                        ["note", 80],
                        ["uuid", 100],
                    ]}
                >
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => {
                                    return (
                                        <TableHead
                                            key={header.id}
                                            data-col={header.column.id}
                                            className="text-sm"
                                        >
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                      header.column.columnDef.header,
                                                      header.getContext(),
                                                  )}
                                        </TableHead>
                                    )
                                })}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={columns.length} className="h-24 text-center">
                                    {t("Loading")}...
                                </TableCell>
                            </TableRow>
                        ) : table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    data-state={row.getIsSelected() && "selected"}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell
                                            key={cell.id}
                                            data-col={cell.column.id}
                                            className="text-xsm"
                                        >
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext(),
                                            )}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={columns.length} className="h-24 text-center">
                                    {t("NoResults")}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </Page>
    )
}
