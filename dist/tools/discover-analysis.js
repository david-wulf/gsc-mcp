"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.discoverAnalysis = discoverAnalysis;
const analytics_js_1 = require("../analytics.js");
function totals(rows) {
    let clicks = 0;
    let impressions = 0;
    for (const r of rows) {
        clicks += r.clicks;
        impressions += r.impressions;
    }
    return {
        clicks,
        impressions,
        ctr: impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0,
    };
}
function pct(curr, prior) {
    return prior > 0 ? Math.round(((curr - prior) / prior) * 10000) / 100 : 0;
}
/**
 * Isolated Google Discover performance. Discover is NOT query-based, so the API
 * only supports page / country / date dimensions here. Position/CTR-vs-position
 * benchmarks from web tools do not apply.
 */
async function discoverAnalysis(days = 28, rowLimit = 50) {
    const current = (0, analytics_js_1.getDateRange)(days);
    const prior = (0, analytics_js_1.getPriorDateRange)(days);
    (0, analytics_js_1.assertValidDimensions)("discover", ["page"]);
    const [pageRows, priorPageRows, countryRows, dateRows] = await Promise.all([
        (0, analytics_js_1.fetchAllRows)({ startDate: current.startDate, endDate: current.endDate, dimensions: ["page"], searchType: "discover" }),
        (0, analytics_js_1.fetchAllRows)({ startDate: prior.startDate, endDate: prior.endDate, dimensions: ["page"], searchType: "discover" }),
        (0, analytics_js_1.fetchAllRows)({ startDate: current.startDate, endDate: current.endDate, dimensions: ["country"], searchType: "discover" }),
        (0, analytics_js_1.fetchAllRows)({ startDate: current.startDate, endDate: current.endDate, dimensions: ["date"], searchType: "discover" }),
    ]);
    const curTotals = totals(pageRows);
    const priorTotals = totals(priorPageRows);
    const topPages = pageRows
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, Math.min(rowLimit, 200))
        .map((r) => ({
        page: r.keys[0],
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: Math.round(r.ctr * 10000) / 100,
    }));
    const byCountry = countryRows
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, 15)
        .map((r) => ({
        country: r.keys[0],
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: Math.round(r.ctr * 10000) / 100,
    }));
    const dailyTrend = dateRows
        .sort((a, b) => a.keys[0].localeCompare(b.keys[0]))
        .map((r) => ({ date: r.keys[0], clicks: r.clicks, impressions: r.impressions }));
    return {
        surface: "discover",
        period: current,
        totals: curTotals,
        change: {
            clicksPercent: pct(curTotals.clicks, priorTotals.clicks),
            impressionsPercent: pct(curTotals.impressions, priorTotals.impressions),
        },
        topPages,
        byCountry,
        dailyTrend,
        note: "Google Discover is feed-based, not query-based. There are no query-level rows " +
            "and average position is not meaningful here. Optimise on title, hero image and freshness.",
    };
}
