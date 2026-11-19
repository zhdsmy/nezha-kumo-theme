import { useNotification } from "@/hooks/useNotfication"
import { entityNames } from "@/hooks/useEntityNames"
import { swrFetcher } from "@/api/api"
import { deleteNotificationGroups } from "@/api/notification-group"
import { ActionButtonGroup } from "@/components/action-button-group"
import { HeaderButtonGroup } from "@/components/header-button-group"
import { NotificationGroupCard } from "@/components/notification-group"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    TableStateRow,
} from "@/components/ui/table"
import { selectableTableFeatures, useSelectableTable } from "@/lib/table"
import { ModelNotificationGroupResponseItem } from "@/types"
import { Page } from "@nezha-kumo/ui"
import { ColumnDef, flexRender } from "@tanstack/react-table"
import { useCallback, useEffect, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import useSWR from "swr"

type NotificationGroupColumn = ColumnDef<
    typeof selectableTableFeatures,
    ModelNotificationGroupResponseItem
>

export default function NotificationGroupPage() {
    const { t } = useTranslation()
    const notifierName = entityNames(useNotification().notifiers)
    const { data, mutate, error, isLoading } = useSWR<ModelNotificationGroupResponseItem[]>(
        "/api/v1/notification-group",
        swrFetcher,
    )

    useEffect(() => {
        if (error)
            toast.error(t("Error"), {
                description: t("Results.ErrorFetchingResource", {
                    error: error.message,
                }),
            })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [error])

    const columns: NotificationGroupColumn[] = [
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
            accessorFn: (row) => row.group.id,
        },
        {
            header: t("Name"),
            accessorKey: "name",
            accessorFn: (row) => row.group.name,
            cell: ({ row }) => {
                const s = row.original
                return <div className="whitespace-normal break-words">{s.group.name}</div>
            },
        },
        {
            header: t("Notifier"),
            accessorKey: "notifications",
            accessorFn: (row) => row.notifications,
            cell: ({ row }) => {
                const s = row.original
                return (
                    <div className="whitespace-normal break-words">
                        <span>{(s.notifications ?? []).map(notifierName).join(", ")}</span>
                    </div>
                )
            },
        },
        {
            id: "actions",
            header: t("Actions"),
            cell: useCallback(({ row }) => {
                const s = row.original
                return (
                    <ActionButtonGroup
                        className="flex gap-2"
                        delete={{
                            fn: deleteNotificationGroups,
                            id: s.group.id,
                            name: s.group.name,
                            mutate: mutate,
                        }}
                    >
                        <NotificationGroupCard mutate={mutate} data={s} />
                    </ActionButtonGroup>
                )
            }, [mutate]),
        },
    ]

    const dataCache = useMemo(() => {
        return data ?? []
    }, [data])

    const table = useSelectableTable(dataCache, columns)

    const selectedRows = table.getSelectedRowModel().rows

    return (
        <Page
            title={t("NotificationGroups")}
            actions={
                <HeaderButtonGroup
                    className="flex ml-auto self-end sm:self-auto gap-2 flex-wrap shrink-0"
                    delete={{
                        fn: deleteNotificationGroups,
                        id: selectedRows.map((r) => r.original.group.id),
                        mutate: mutate,
                    }}
                >
                    <NotificationGroupCard mutate={mutate} />
                </HeaderButtonGroup>
            }
        >
            <Table
                fillColumn="notifications"
                columnPriority={[
                    ["id", 64],
                    ["notifications", 150],
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
                    <TableStateRow
                        rowCount={table.getRowModel().rows.length}
                        colSpan={columns.length}
                        isLoading={isLoading}
                        error={error}
                        onRetry={mutate}
                    />
                    {table.getRowModel().rows.map((row) => (
                        <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                            {row.getVisibleCells().map((cell) => (
                                <TableCell
                                    key={cell.id}
                                    data-col={cell.column.id}
                                    className="text-xsm"
                                >
                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </TableCell>
                            ))}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </Page>
    )
}
