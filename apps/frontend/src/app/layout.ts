import { BREAKPOINTS } from "@nezha-kumo/ui"

// Compact view columns: room for the status badge and both network rates.
const FLEET_COLUMNS = {
    medium: { name: "30%", status: "15%", network: "22%" },
    wide: { name: "26%", status: "11%", network: "18%" },
} as const

export const responsive = `
.fleet-table {
    display: block;
    width: 100%;
    background: var(--color-kumo-base);
    border: 1px solid var(--color-kumo-line);
    border-radius: 8px;
}
.fleet-table thead {
    display: none;
}
.fleet-table tbody {
    display: block;
}
.fleet-table .server-row {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    align-items: center;
    gap: 8px 12px;
    padding: 10px 12px;
    border-bottom: 1px solid var(--color-kumo-line);
}
.fleet-table .server-row:last-child {
    border-bottom: 0;
}
.fleet-table .server-row > td {
    display: block;
    padding: 0;
    min-width: 0;
}
.fleet-table .server-name {
    grid-column: 1/3;
}
.fleet-table .server-name > a {
    display: block;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 14px;
    font-weight: 500;
    color: var(--text-color-kumo-link);
}
.fleet-table .server-name > span {
    display: block;
    font-size: 12px;
    line-height: 16px;
}
.fleet-table .server-status {
    grid-row: 1;
    grid-column: 3;
    justify-self: end;
}
.fleet-table .server-network .net-rates {
    font-size: 11px;
    line-height: 14px;
}
.fleet-table .wide-cell {
    display: none !important;
}
.fleet-table td,
.fleet-table th {
    vertical-align: middle;
    overflow-wrap: anywhere;
}

@media (min-width:${BREAKPOINTS.gutter}px) {
 .metric-tile { min-height:140px; }
 .tile-value { font-size:24px; line-height:30px; }
 .tile-heading { padding:12px 16px 0; }
 .hour-grid-rows { margin-top:12px; gap:3px; }
 .hour-grid-cell { height:10px; }
 .action-label { display:inline; }
 .section-heading[data-search-open="true"] .sort-button { display:inline-flex; }
 .fleet-table thead { display:table-header-group; }
 .fleet-table tbody { display:table-row-group; }
 .fleet-table { display:table; border-collapse:separate; border-spacing:0; overflow:hidden; }
 .fleet-table .server-row { display:table-row; }
 .fleet-table .server-row > td { display:table-cell; padding:10px 12px; border-top:1px solid var(--color-kumo-line); }
 .fleet-table .server-name { width:${FLEET_COLUMNS.medium.name}; }
 .fleet-table .server-status { width:${FLEET_COLUMNS.medium.status}; }
 .fleet-table .server-network { width:${FLEET_COLUMNS.medium.network}; }
 .fleet-table .meter-label,.fleet-table .cell-label { display:none; }
 .fleet-table .server-network .net-rates { font-size:12px; line-height:16px; }
}
@media (min-width:${BREAKPOINTS.sidebar}px) { .topbar-title { display:none; } }
@media (min-width:${BREAKPOINTS.wide}px) {
 .metric-grid { grid-template-columns:repeat(4,minmax(0,1fr)); }
 .chart-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
 .fleet-table .wide-cell { display:table-cell !important; }
 .fleet-table .server-name { width:${FLEET_COLUMNS.wide.name}; }
 .fleet-table .server-status { width:${FLEET_COLUMNS.wide.status}; }
 .fleet-table .server-network { width:${FLEET_COLUMNS.wide.network}; }
}
`
