import { swrFetcher } from "@/api/api"
import { deleteDDNSProfiles, getDDNSProviders } from "@/api/ddns"
import { ActionButtonGroup } from "@/components/action-button-group"
import { DDNSCard } from "@/components/ddns"
import { flagCell } from "@/components/flag"
import { HeaderButtonGroup } from "@/components/header-button-group"
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
import { ModelDDNSProfile } from "@/types"
import { Page } from "@nezha-kumo/ui"
import { ColumnDef, flexRender } from "@tanstack/react-table"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import useSWR from "swr"

export default function DDNSPage() {
    const { t } = useTranslation()
    const { data, mutate, error, isLoading } = useSWR<ModelDDNSProfile[]>(
        "/api/v1/ddns",
        swrFetcher,
    )
    const [providers, setProviders] = useState<string[]>([])

    useEffect(() => {
        const fetchProviders = async () => {
            const fetchedProviders = await getDDNSProviders()
            setProviders(fetchedProviders)
        }
        fetchProviders()
    }, [])

    useEffect(() => {
        if (error)
            toast.error(t("Error"), {
                description: t("Results.ErrorFetchingResource", {
                    error: error.message,
                }),
            })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [error])

    const columns: ColumnDef<typeof selectableTableFeatures, ModelDDNSProfile>[] = [
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
            accessorFn: (row) => row.id,
        },
        {
            header: t("Name"),
            accessorKey: "name",
            accessorFn: (row) => row.name,
            cell: ({ row }) => {
                const s = row.original
                return <div className="max-w-24 whitespace-normal break-words">{s.name}</div>
            },
        },
        {
            header: "IPv4",
            accessorKey: "enableIPv4",
            accessorFn: (row) => row.enable_ipv4 ?? false,
            cell: flagCell,
        },
        {
            header: "IPv6",
            accessorKey: "enableIPv6",
            accessorFn: (row) => row.enable_ipv6 ?? false,
            cell: flagCell,
        },
        {
            header: t("Provider"),
            accessorKey: "provider",
            accessorFn: (row) => row.provider,
        },
        {
            header: t("Domains"),
            accessorKey: "domains",
            accessorFn: (row) => (row.domains ?? []).join(", "),
            cell: ({ row }) => {
                const domains = row.original.domains ?? []
                if (domains.length === 0) {
                    return <span className="text-muted-foreground">—</span>
                }
                const joined = domains.join(", ")
                return (
                    <div className="max-w-64 whitespace-normal break-words" title={joined}>
                        {joined}
                    </div>
                )
            },
        },
        {
            header: t("MaximumRetryAttempts"),
            accessorKey: "maxRetries",
            accessorFn: (row) => row.max_retries,
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
                            fn: deleteDDNSProfiles,
                            id: s.id,
                            name: s.name,
                            mutate: mutate,
                        }}
                    >
                        <DDNSCard mutate={mutate} data={s} providers={providers} />
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

    return (
        <Page
            title={t("DDNS")}
            actions={
                <HeaderButtonGroup
                    className="flex ml-auto self-end sm:self-auto gap-2 flex-wrap shrink-0"
                    delete={{
                        fn: deleteDDNSProfiles,
                        id: selectedRows.map((r) => r.original.id),
                        mutate: mutate,
                    }}
                >
                    <DDNSCard mutate={mutate} providers={providers} />
                </HeaderButtonGroup>
            }
        >
            <Table
                columnPriority={[
                    ["id", 64],
                    ["provider", 110],
                    ["domains", 240],
                    ["enableIPv4", 90],
                    ["enableIPv6", 90],
                    ["maxRetries", 100],
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
