import {
    ColumnDef,
    columnSizingFeature,
    columnVisibilityFeature,
    createSortedRowModel,
    rowSelectionFeature,
    rowSortingFeature,
    sortFn_alphanumeric,
    sortFn_datetime,
    sortFn_text,
    tableFeatures,
    useTable,
} from "@tanstack/react-table"
import { useEffect } from "react"

export const selectableTableFeatures = tableFeatures({
    columnVisibilityFeature,
    rowSelectionFeature,
})

export const virtualizedTableFeatures = tableFeatures({
    columnSizingFeature,
    columnVisibilityFeature,
    rowSelectionFeature,
    rowSortingFeature,
    sortedRowModel: createSortedRowModel(),
    sortFns: {
        alphanumeric: sortFn_alphanumeric,
        datetime: sortFn_datetime,
        text: sortFn_text,
    },
})

type EntityRow = { id?: number; group?: { id: number }; ip?: string }
const entityRowId = (row: EntityRow) => String(row.group?.id ?? row.id ?? row.ip)

export function useSelectableTable<T extends EntityRow>(
    data: T[],
    columns: ColumnDef<typeof selectableTableFeatures, T>[],
) {
    const table = useTable({
        features: selectableTableFeatures,
        data,
        columns,
        getRowId: entityRowId,
    })
    for (const row of table.getCoreRowModel().rows) {
        ;(row as { _valuesCache?: Record<string, unknown> })._valuesCache = {}
    }
    useEffect(() => {
        const ids = new Set(data.map(entityRowId))
        table.setRowSelection((selected) => {
            const entries = Object.entries(selected).filter(([id]) => ids.has(id))
            return entries.length === Object.keys(selected).length
                ? selected
                : Object.fromEntries(entries)
        })
    }, [data, table])
    return table
}
