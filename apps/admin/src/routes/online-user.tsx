import { swrFetcher } from "@/api/api"
import { blockUser } from "@/api/online-user"
import { BlockButtonGroup } from "@/components/action-button-group"
import { HeaderBlockButtonGroup } from "@/components/header-button-group"
import { SettingsTab } from "@/components/settings-tab"
import { Checkbox } from "@/components/ui/checkbox"
import { TablePagination } from "@/components/ui/pagination"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    TableStateRow,
} from "@/components/ui/table"
import { useAuth } from "@/hooks/useAuth"
import { selectableTableFeatures, useSelectableTable } from "@/lib/table"
import { formatDateTime } from "@/lib/utils"
import { ModelOnlineUser, ModelOnlineUserApi } from "@/types"
import { Page } from "@nezha-kumo/ui"
import { ColumnDef, flexRender } from "@tanstack/react-table"
import { useEffect, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import useSWR from "swr"

export default function OnlineUserPage() {
    const { t, i18n } = useTranslation()
    const { profile } = useAuth()
    const [searchParams, setSearchParams] = useSearchParams()
    const page = Number(searchParams.get("page")) || 1
    const pageSize = Number(searchParams.get("pageSize")) || 10

    // 计算 offset
    const offset = (page - 1) * pageSize

    const { data, mutate, error, isLoading } = useSWR<ModelOnlineUserApi, Error>(
        `/api/v1/online-user?offset=${offset}&limit=${pageSize}`,
        swrFetcher,
    )

    const isAdmin = profile?.role === 0

    useEffect(() => {
        if (error)
            toast.error(t("Error"), {
                description: t("Results.ErrorFetchingResource", { error: error.message }),
            })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [error])

    let columns: ColumnDef<typeof selectableTableFeatures, ModelOnlineUser>[] = [
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
            header: "IP",
            accessorKey: "ip",
            accessorFn: (row) => row.ip ?? "",
        },
        {
            header: t("UserId"),
            accessorKey: "user_id",
            accessorFn: (row) => row.user_id || "",
        },
        {
            header: t("ConnectedAt"),
            accessorKey: "connected_at",
            accessorFn: (row) => row.connected_at,
            cell: ({ row }) => {
                const s = row.original
                return (
                    <span className="tabular-nums">
                        {formatDateTime(s.connected_at, i18n?.language, t("Never"))}
                    </span>
                )
            },
        },
        {
            id: "actions",
            header: t("Actions"),
            cell: ({ row }) => {
                const s = row.original
                return (
                    <BlockButtonGroup
                        className="flex gap-2"
                        block={{
                            fn: blockUser,
                            id: s.ip ?? "",
                            mutate: mutate,
                        }}
                    >
                        <></>
                    </BlockButtonGroup>
                )
            },
        },
    ]

    if (!isAdmin) {
        // 非管理员隐藏操作列
        columns = columns.filter((c) => c.id !== "actions")
    }

    const dataCache = useMemo(() => {
        return data?.value ?? []
    }, [data])

    const table = useSelectableTable(dataCache, columns)

    const selectedRows = table.getSelectedRowModel().rows

    return (
        <Page
            title={t("OnlineUser")}
            tabs={<SettingsTab />}
            actions={
                isAdmin && (
                    <HeaderBlockButtonGroup
                        className="flex flex-wrap gap-2"
                        block={{
                            fn: blockUser,
                            id: selectedRows.map((r) => r.original.ip ?? ""),
                            mutate: mutate,
                        }}
                    >
                        <></>
                    </HeaderBlockButtonGroup>
                )
            }
        >
            <Table
                primaryColumn="ip"
                columnPriority={[
                    ["user_id", 90],
                    ["connected_at", 160],
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
            <TablePagination
                page={page}
                pageSize={pageSize}
                total={data?.pagination?.total}
                disabled={isLoading}
                onPageChange={(newPage) =>
                    setSearchParams({ page: newPage.toString(), pageSize: pageSize.toString() })
                }
            />
        </Page>
    )
}
