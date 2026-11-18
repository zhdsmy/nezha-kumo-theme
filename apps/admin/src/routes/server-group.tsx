import { swrFetcher } from "@/api/api"
import { deleteServerGroups } from "@/api/server-group"
import { ActionButtonGroup } from "@/components/action-button-group"
import { GroupTab } from "@/components/group-tab"
import { HeaderButtonGroup } from "@/components/header-button-group"
import { ServerGroupCard } from "@/components/server-group"
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
import useSetting from "@/hooks/useSetting"
import { removeServerGroupIcons } from "@/lib/group-icons"
import { selectableTableFeatures, useSelectableTable } from "@/lib/table"
import { errorMessage } from "@/lib/utils"
import { ModelServerGroupResponseItem } from "@/types"
import { Page } from "@nezha-kumo/ui"
import { ColumnDef, flexRender } from "@tanstack/react-table"
import { useCallback, useEffect, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import useSWR from "swr"

export default function ServerGroupPage() {
    const { t } = useTranslation()
    const { mutate: mutateSetting } = useSetting()
    const { data, mutate, error, isLoading } = useSWR<ModelServerGroupResponseItem[]>(
        "/api/v1/server-group",
        swrFetcher,
    )

    const handleDeleteGroups = useCallback(
        async (ids: number[]) => {
            await deleteServerGroups(ids)
            try {
                if (await removeServerGroupIcons(ids)) {
                    await mutateSetting()
                }
            } catch (e) {
                console.error(e)
                toast.error(t("Error"), {
                    description: errorMessage(e, t("Results.UnExpectedError")),
                })
            }
        },
        [mutateSetting, t],
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

    const columns: ColumnDef<typeof selectableTableFeatures, ModelServerGroupResponseItem>[] = [
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
                return <div className="max-w-48 whitespace-normal break-words">{s.group.name}</div>
            },
        },
        {
            header: t("Server") + "(ID)",
            accessorKey: "servers",
            accessorFn: (row) => row.servers,
            cell: ({ row }) => {
                const s = row.original
                return (
                    <div className="max-w-48 whitespace-normal break-words">
                        <span>{(s.servers || []).join(",")}</span>
                    </div>
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
                            fn: handleDeleteGroups,
                            id: s.group.id,
                            mutate: mutate,
                        }}
                    >
                        <ServerGroupCard mutate={mutate} data={s} />
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
            title={`${t("Server")} · ${t("Group")}`}
            tabs={<GroupTab />}
            actions={
                <HeaderButtonGroup
                    className="flex ml-auto self-end sm:self-auto gap-2 flex-wrap shrink-0"
                    delete={{
                        fn: handleDeleteGroups,
                        id: selectedRows.map((r) => r.original.group.id),
                        mutate: mutate,
                    }}
                >
                    <ServerGroupCard mutate={mutate} />
                </HeaderButtonGroup>
            }
        >
            <Table
                columnPriority={[
                    ["id", 64],
                    ["servers", 150],
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
