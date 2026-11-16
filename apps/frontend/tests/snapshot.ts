import type { Snapshot } from "../src/core/model"

export const emptySnapshot = (online = false): Snapshot => ({
    online,
    at: 0,
    cpu: 0,
    memUsed: 0,
    memTotal: 0,
    swapUsed: 0,
    swapTotal: 0,
    diskUsed: 0,
    diskTotal: 0,
    netUp: 0,
    netDown: 0,
    totalUp: 0,
    totalDown: 0,
    load1: 0,
    load5: 0,
    load15: 0,
    tcp: 0,
    udp: 0,
    process: 0,
    uptime: 0,
})
