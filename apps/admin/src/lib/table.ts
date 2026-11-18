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

export function groupNamesByMember<T extends { group: { name: string } }>(
    groups: T[] | undefined,
    members: (group: T) => number[],
) {
    const names = new Map<number, string>()
    for (const group of groups ?? []) {
        if (!group.group.name) continue
        for (const id of new Set(members(group))) {
            const previous = names.get(id)
            names.set(id, previous ? previous + ", " + group.group.name : group.group.name)
        }
    }
    return names
}

type EntityRow = { id?: number; group?: { id: number }; ip?: string }
const entityRowId = (row: EntityRow) => String(row.group?.id ?? row.id ?? row.ip)

export function useSelectableTable<T extends EntityRow>(
    data: T[],
    columns: ColumnDef<typeof selectableTableFeatures, T>[],
    enableRowSelection?: (row: { original: T }) => boolean,
) {
    const table = useTable({
        features: selectableTableFeatures,
        data,
        columns,
        getRowId: entityRowId,
        ...(enableRowSelection ? { enableRowSelection } : {}),
    })
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
