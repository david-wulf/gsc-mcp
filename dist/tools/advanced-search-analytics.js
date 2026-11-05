"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_PAGE_SIZE = void 0;
exports.sortAndPage = sortAndPage;
exports.advancedSearchAnalytics = advancedSearchAnalytics;
const analytics_js_1 = require("../analytics.js");
/** Most rows a single call returns. Larger lists are read page by page with start_row. */
exports.MAX_PAGE_SIZE = 500;
/**
 * Sorts all rows and cuts out one page. The order is total — ties on the sort
 * metric fall back to the row keys — so consecutive start_row calls page
 * through one fixed list: no row appears twice, none goes missing.
 */
function sortAndPage(rows, orderBy = "clicks", orderDirection = "descending", startRow = 0, rowLimit = 100) {
    const sortKey = orderBy;
    const multiplier = orderDirection === "ascending" ? 1 : -1;
    const value = (r) => typeof r[sortKey] === "number" ? r[sortKey] : 0;
    const tieKey = (r) => r.keys.join("\u0000");
    const sorted = [...rows].sort((a, b) => {
        const diff = (value(a) - value(b)) * multiplier;
        if (diff !== 0)
            return diff;
        const ka = tieKey(a);
        const kb = tieKey(b);
        return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
    const requested = Math.max(1, Math.floor(rowLimit));
    const limit = Math.min(requested, exports.MAX_PAGE_SIZE);
    const offset = Math.max(0, Math.floor(startRow));
    const page = sorted.slice(offset, offset + limit);
    const end = offset + page.length;
    const hasMore = end < sorted.length;
    return {
        rows: page,
        totalRows: sorted.length,
        startRow: offset,
        hasMore,
        nextStartRow: hasMore ? end : null,
        rowLimit: limit,
        rowLimitCapped: requested > exports.MAX_PAGE_SIZE
            ? `row_limit ${requested} lowered to ${exports.MAX_PAGE_SIZE}, the most one call returns. Page on with start_row.`
            : null,
    };
}
async function advancedSearchAnalytics(options = {}) {
    const { days = 28, startDate: requestedStart, endDate: requestedEnd, dimensions = ["query"], filters = [], rowLimit = 100, startRow = 0, orderBy = "clicks", orderDirection = "descending", searchType = "web", dataState = "all", } = options;
    (0, analytics_js_1.assertValidDimensions)(searchType, dimensions);
    const period = (0, analytics_js_1.resolveDateRange)(days, requestedStart, requestedEnd);
    // Build dimension filter groups from user-provided filters
    const dimensionFilterGroups = filters.length > 0
        ? [{
                filters: filters.map((f) => ({
                    dimension: f.dimension,
                    operator: f.operator,
                    expression: f.expression,
                })),
            }]
        : undefined;
    // The API pages internally (25k rows per request); every call fetches the
    // full list so sorting and paging run over all rows, not over the first page.
    const rows = await (0, analytics_js_1.fetchAllRows)({
        startDate: period.startDate,
        endDate: period.endDate,
        dimensions,
        type: searchType,
        dimensionFilterGroups,
        dataState,
    });
    const page = sortAndPage(rows, orderBy, orderDirection, startRow, rowLimit);
    return {
        rows: page.rows.map((r) => ({
            keys: r.keys,
            clicks: r.clicks,
            impressions: r.impressions,
            ctr: Math.round(r.ctr * 10000) / 100,
            position: Math.round(r.position * 10) / 10,
        })),
        totalRows: page.totalRows,
        startRow: page.startRow,
        returnedRows: page.rows.length,
        hasMore: page.hasMore,
        nextStartRow: page.nextStartRow,
        rowLimitCapped: page.rowLimitCapped,
        dimensions,
        period,
        dataState,
        filtersApplied: filters,
        searchType: searchType || "web",
    };
}
