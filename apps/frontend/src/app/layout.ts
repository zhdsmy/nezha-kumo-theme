import { BREAKPOINTS } from "@nezha-kumo/ui"

// Reserve room for status and both network rates; wide fee columns wrap their cycle suffix.
const FLEET_COLUMNS = {
    medium: { name: "29%", status: "17%", network: "23%" },
    wide: { name: "19%", status: "10%", network: "16%", billing: "16%" },
} as const

export const responsive = `
.fleet-table {
    display: block;
    width: 100%;
}
.fleet-table thead {
    display: none;
}
.fleet-table tbody {
    display: block;
}
.fleet-table .server-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 32px;
    align-items: center;
    gap: 12px 8px;
    margin-bottom: 12px;
    padding: 14px;
    background: var(--color-kumo-base);
    border: 1px solid var(--color-kumo-line);
    border-radius: 8px;
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
    font-size: 15px;
    font-weight: 500;
    color: var(--text-color-kumo-link);
}
.fleet-table .server-name > span {
    display: block;
    font-size: 12px;
    line-height: 18px;
}
.fleet-table .server-status {
    grid-row: 2;
    grid-column: 1/3;
}
.fleet-table .server-cpu {
    grid-row: 3;
    grid-column: 1;
}
.fleet-table .server-memory {
    grid-row: 3;
    grid-column: 2;
}
.fleet-table .server-network {
    grid-row: 4;
    grid-column: 1/3;
}
.fleet-table .row-expand {
    grid-row: 1;
    grid-column: 3;
}
.fleet-table .wide-cell {
    display: none !important;
}
.fleet-table .billing-cell > span {
    display: block;
}
.fleet-table .expanded-row {
    display: block;
    border: 1px solid var(--color-kumo-line);
    border-radius: 8px;
    margin-top: -5px;
    margin-bottom: 12px;
    background: var(--color-kumo-base);
}
.fleet-table .expanded-row > td {
    display: block;
    padding: 16px;
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
 .fleet-table { display:table; }
 .fleet-table thead { display:table-header-group; }
 .fleet-table tbody { display:table-row-group; }
 .fleet-table .server-row { display:table-row; }
 .fleet-table .server-row > td { display:table-cell; padding:12px 10px; }
 .fleet-table .wide-cell { display:none !important; }
 .fleet-table .server-name { width:${FLEET_COLUMNS.medium.name}; }
 .fleet-table .server-status { width:${FLEET_COLUMNS.medium.status}; }
 .fleet-table .server-network { width:${FLEET_COLUMNS.medium.network}; }
 .fleet-table .row-expand { width:38px; }
 .fleet-table .server-name > a { font-size:14px; }
 .fleet-table .meter-label,.fleet-table .cell-label { display:none; }
 .fleet-table .server-row { border-bottom:1px solid var(--color-kumo-line); border-radius:0; }
 .fleet-table .expanded-row { display:table-row; }
 .fleet-table .expanded-row > td { display:table-cell; }
}
@media (min-width:${BREAKPOINTS.sidebar}px) { .topbar-title { display:none; } }
@media (min-width:${BREAKPOINTS.wide}px) {
 .metric-grid { grid-template-columns:repeat(5,minmax(0,1fr)); }
 .metric-grid > :last-child:nth-child(odd) { grid-column:auto; }
 .fleet-table .billing-cell { width:${FLEET_COLUMNS.wide.billing}; }
 .node-metrics { grid-template-columns:repeat(2,minmax(0,1fr)); }
 .chart-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
 .fleet-table .wide-cell { display:table-cell !important; }
 .fleet-table .server-name { width:${FLEET_COLUMNS.wide.name}; }
 .fleet-table .server-status { width:${FLEET_COLUMNS.wide.status}; }
 .fleet-table .server-network { width:${FLEET_COLUMNS.wide.network}; }
 .fleet-table .server-row > .row-expand,.fleet-table thead .row-expand,.fleet-table .expanded-row { display:none; }
}
`
