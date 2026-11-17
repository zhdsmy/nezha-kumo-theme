import { BREAKPOINTS, SHELL } from "@nezha-kumo/ui"

// Compact view columns: room for the status badge and both network rates.
const FLEET_COLUMNS = {
    medium: { name: "30%", status: "15%", network: "22%" },
    wide: { name: "26%", status: "11%", network: "18%" },
} as const

// Content width at 880 px viewport with the 260 px sidebar expanded (620 px).
// At 768–879 px expanded (.nk-main = 508–619 px), content keeps the compact phone layout;
// collapsing the sidebar (.nk-main >= 711 px) or widening to >= 880 px unlocks desktop layout.
const CONTENT_WIDE = 880 - SHELL.sidebarWidth

const FT = ":is(.fleet-table,.fleet-table-skeleton)"

export const responsive = `
${FT} { display:block; width:100%; background:var(--color-kumo-base); border:1px solid var(--color-kumo-line); border-radius:8px; }
${FT} thead { display:none; }
${FT} tbody { display:block; }
${FT} .server-row { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); align-items:center; gap:8px 12px; padding:10px 12px; border-bottom:1px solid var(--color-kumo-line); }
${FT} .server-row:last-child { border-bottom:0; }
${FT} .server-row > td { display:block; padding:0; min-width:0; }
${FT} .server-name { grid-column:1/3; }
.fleet-table .server-name > a { position:relative; display:block; min-width:0; font-size:14px; font-weight:500; color:var(--text-color-kumo-link); }
${FT} .server-name > span { display:block; font-size:12px; line-height:16px; }
${FT} .server-status { grid-row:1; grid-column:3; justify-self:end; }
${FT} .server-network .net-rates { font-size:11px; line-height:14px; }
${FT} .wide-cell { display:none !important; }
${FT} td,${FT} th { vertical-align:middle; overflow-wrap:anywhere; }
@media (min-width:${BREAKPOINTS.gutter}px) {
 .action-label { display:inline; }
 @container (min-width:${CONTENT_WIDE}px) {
  .metric-tile { min-height:146px; }
  .tile-value { font-size:24px; line-height:30px; }
  .tile-heading { padding:12px 16px 0; }
  .hour-grid-rows { gap:3px; }
  .hour-grid-cell { height:10px; }
  .section-heading[data-search-open="true"] .sort-button { display:inline-flex; }
  ${FT} thead { display:table-header-group; }
  ${FT} tbody { display:table-row-group; }
  ${FT} { display:table; border-collapse:separate; border-spacing:0; overflow:hidden; }
  ${FT} .server-row { display:table-row; }
  ${FT} .server-row > td { display:table-cell; padding:10px 12px; border-top:1px solid var(--color-kumo-line); }
  ${FT} .server-name { width:${FLEET_COLUMNS.medium.name}; }
  ${FT} .server-status { width:${FLEET_COLUMNS.medium.status}; }
  ${FT} .server-network { width:${FLEET_COLUMNS.medium.network}; }
  ${FT} .meter-label,${FT} .cell-label { display:none; }
  ${FT} .server-network .net-rates { font-size:12px; line-height:16px; }
  .node-live-strip { grid-template-columns:repeat(4,minmax(0,1fr)); gap:20px; margin-bottom:20px; padding:16px 20px; }
  .node-subtabs { display:none; }
  .node-info-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px; align-items:start; }
  .node-info-grid[data-has-billing] { grid-template-rows:max-content 1fr; }
  .node-info-grid[data-has-billing]>.node-info-panel[data-panel="system"] { grid-column:1; grid-row:1/3; }
  .node-info-grid[data-has-billing]>.node-info-panel[data-panel="network"] { grid-column:2; grid-row:1; }
  .node-info-grid[data-has-billing]>.node-info-panel[data-panel="billing"] { grid-column:2; grid-row:2; }
  .node-info-panel { display:block; }
  .node-info-panel .info-section>h2 { display:block; }
  .node-info-panel .info-heading-skeleton { display:flex; }
  .node-info-panel .info-section dl>div:first-child { padding-top:10px; }
 }
}
@media (min-width:${BREAKPOINTS.sidebar}px) { .topbar-title { display:none; } }
@media (min-width:${BREAKPOINTS.wide}px) {
 .metric-grid { grid-template-columns:repeat(4,minmax(0,1fr)); }
 .chart-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
 ${FT} .wide-cell { display:table-cell !important; }
 ${FT} .server-name { width:${FLEET_COLUMNS.wide.name}; }
 ${FT} .server-status { width:${FLEET_COLUMNS.wide.status}; }
 ${FT} .server-network { width:${FLEET_COLUMNS.wide.network}; }
}
`
