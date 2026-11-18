import { swrFetcher } from "@/api/api"
import { deleteUser } from "@/api/user"
import { ActionButtonGroup } from "@/components/action-button-group"
import { HeaderButtonGroup } from "@/components/header-button-group"
import { SettingsTab } from "@/components/settings-tab"
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
import { UserCard } from "@/components/user"
import { IconButton } from "@/components/xui/icon-button"
import { useAuth } from "@/hooks/useAuth"
import { selectableTableFeatures, useSelectableTable } from "@/lib/table"
import { formatDateTime } from "@/lib/utils"
import { ModelUser } from "@/types"
import { Page } from "@nezha-kumo/ui"
import { ColumnDef, flexRender } from "@tanstack/react-table"
import { useEffect, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import useSWR from "swr"

export default function UserPage() {
    const { t, i18n } = useTranslation()
    const { profile } = useAuth()
    const { data, mutate, error, isLoading } = useSWR<ModelUser[]>("/api/v1/user", swrFetcher)

    useEffect(() => {
        if (error)
            toast.error(t("Error"), {
                description: t("Results.ErrorFetchingResource", {
                    error: error.message,
                }),
            })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [error])

    const columns: ColumnDef<typeof selectableTableFeatures, ModelUser>[] = [
        {
            id: "select",
            header: ({ table }) => {
                const selectableRows = table
                    .getRowModel()
                    .rows.filter((row) => row.getCanSelect())
                const allSelected =
                    selectableRows.length > 0 && selectableRows.every((row) => row.getIsSelected())
                const someSelected = selectableRows.some((row) => row.getIsSelected())
                return (
                    <Checkbox
                        checked={allSelected || (someSelected && "indeterminate")}
                        disabled={selectableRows.length === 0}
                        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                        aria-label={t("SelectAll")}
                    />
                )
            },
            cell: ({ row }) => {
                const canSelect = row.getCanSelect()
                return (
                    <Checkbox
                        checked={canSelect && row.getIsSelected()}
                        disabled={!canSelect}
                        onCheckedChange={(value) => {
                            if (canSelect) row.toggleSelected(!!value)
                        }}
                        aria-label={t("SelectRow")}
                    />
                )
            },
            enableHiding: false,
        },
        {
            header: "ID",
            accessorKey: "id",
            accessorFn: (row) => row.id,
        },
        {
            header: t("Username"),
            accessorKey: "username",
            accessorFn: (row) => row.username,
        },
        {
            header: t("Role"),
            accessorKey: "role",
            accessorFn: (row) => {
                return row.role === 1 ? t("User") : t("Admin")
            },
        },
        {
            header: t("LastLogin"),
            accessorKey: "updated_at",
            accessorFn: (row) => formatDateTime(row.updated_at, i18n?.language, t("Never")),
        },
        {
            id: "actions",
            header: t("Actions"),
            cell: ({ row }) => {
                const s = row.original
                if (s.id === profile?.id) {
                    return (
                        <div className="flex gap-2">
                            <IconButton
                                variant="destructive"
                                icon="trash"
                                disabled
                                title={t("CannotDeleteCurrentUser")}
                                aria-label={t("CannotDeleteCurrentUser")}
                            />
                        </div>
                    )
                }
                return (
                    <ActionButtonGroup
                        className="flex gap-2"
                        delete={{
                            fn: deleteUser,
                            id: s.id,
                            name: s.username,
                            mutate: mutate,
                        }}
                    >
                        <></>
                    </ActionButtonGroup>
                )
            },
        },
    ]

    const dataCache = useMemo(() => {
        return data ?? []
    }, [data])

    const table = useSelectableTable(
        dataCache,
        columns,
        (row) => row.original.id !== profile?.id,
    )

    const selectedRows = table.getSelectedRowModel().rows
    const deletableSelectedIds = selectedRows
        .map((r) => r.original.id)
        .filter((id) => id !== profile?.id)

    return (
        <Page
            title={t("User")}
            tabs={<SettingsTab />}
            actions={
                <HeaderButtonGroup
                    className="flex flex-wrap gap-2"
                    delete={{
                        fn: deleteUser,
                        id: deletableSelectedIds,
                        mutate: mutate,
                    }}
                >
                    <UserCard mutate={mutate} />
                </HeaderButtonGroup>
            }
        >
            <Table
                primaryColumn="username"
                columnPriority={[
                    ["id", 64],
                    ["role", 100],
                    ["updated_at", 160],
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
                    {isLoading || !table.getRowModel().rows?.length ? (
                        <TableStateRow
                            colSpan={columns.length}
                            isLoading={isLoading}
                            error={error}
                            onRetry={mutate}
                        />
                    ) : (
                        table.getRowModel().rows.map((row) => (
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
                        ))
                    )}
                </TableBody>
            </Table>
        </Page>
    )
}
