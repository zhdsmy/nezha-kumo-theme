import { swrFetcher } from "@/api/api"
import { deleteWAF } from "@/api/waf"
import { ActionButtonGroup } from "@/components/action-button-group"
import { HeaderButtonGroup } from "@/components/header-button-group"
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
import {
    GithubComNezhahqNezhaModelValueArrayModelWAFApiMock,
    ModelWAFApiMock,
    wafBlockIdentifiers,
    wafBlockReasons,
} from "@/types"
import { Page } from "@nezha-kumo/ui"
import { ColumnDef, flexRender } from "@tanstack/react-table"
import { useEffect, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import useSWR from "swr"

export default function WAFPage() {
    const { t, i18n } = useTranslation()
    const { profile } = useAuth()
    const [searchParams, setSearchParams] = useSearchParams()
    const page = Number(searchParams.get("page")) || 1
    const pageSize = Number(searchParams.get("pageSize")) || 10

    // 计算 offset
    const offset = (page - 1) * pageSize

    const { data, mutate, error, isLoading } =
        useSWR<GithubComNezhahqNezhaModelValueArrayModelWAFApiMock>(
            `/api/v1/waf?offset=${offset}&limit=${pageSize}`,
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

    let columns: ColumnDef<typeof selectableTableFeatures, ModelWAFApiMock>[] = [
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
            accessorFn: (row) => row.ip,
        },
        {
            header: t("Count"),
            accessorKey: "count",
            accessorFn: (row) => row.count,
        },
        {
            header: t("LastBlockReason"),
            accessorKey: "lastBlockReason",
            accessorFn: (row) => row.block_reason,
            cell: ({ row }) => (
                <span>
                    {wafBlockReasons[row.original.block_reason]
                        ? t(wafBlockReasons[row.original.block_reason])
                        : ""}
                </span>
            ),
        },
        {
            header: t("BlockIdentifier"),
            accessorKey: "BlockIdentifier",
            accessorFn: (row) => {
                return wafBlockIdentifiers[row.block_identifier]
                    ? t(wafBlockIdentifiers[row.block_identifier])
                    : row.block_identifier
            },
        },
        {
            header: t("LastBlockTime"),
            accessorKey: "lastBlockTime",
            accessorFn: (row) => row.block_timestamp,
            cell: ({ row }) => {
                const s = row.original
                return (
                    <span className="tabular-nums">
                        {formatDateTime(
                            s.block_timestamp ? s.block_timestamp * 1000 : null,
                            i18n?.language,
                            t("Never"),
                        )}
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
                    <ActionButtonGroup
                        className="flex gap-2"
                        delete={{
                            fn: deleteWAF,
                            id: s.ip || "",
                            mutate: mutate,
                        }}
                    >
                        <></>
                    </ActionButtonGroup>
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
            title={t("WAF")}
            tabs={<SettingsTab />}
            actions={
                isAdmin && (
                    <HeaderButtonGroup
                        className="flex flex-wrap gap-2"
                        delete={{
                            fn: deleteWAF,
                            id: selectedRows.map((r) => r.original.ip || ""),
                            mutate: mutate,
                        }}
                    >
                        <></>
                    </HeaderButtonGroup>
                )
            }
        >
            <Table
                primaryColumn="ip"
                columnPriority={[
                    ["count", 90],
                    ["lastBlockReason", 130],
                    ["BlockIdentifier", 140],
                    ["lastBlockTime", 160],
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
            {data?.pagination && (
                <TablePagination
                    page={page}
                    pageSize={pageSize}
                    total={data.pagination.total}
                    disabled={isLoading}
                    onPageChange={(newPage) =>
                        setSearchParams({ page: newPage.toString(), pageSize: pageSize.toString() })
                    }
                />
            )}
        </Page>
    )
}
