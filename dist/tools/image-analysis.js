"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.imageAnalysis = imageAnalysis;
const analytics_js_1 = require("../analytics.js");
function summarise(rows) {
    let clicks = 0;
    let impressions = 0;
    let posSum = 0;
    let posCount = 0;
    for (const r of rows) {
        clicks += r.clicks;
        impressions += r.impressions;
        posSum += r.position;
        posCount++;
    }
    return {
        clicks,
        impressions,
        ctr: impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0,
        position: posCount > 0 ? Math.round((posSum / posCount) * 10) / 10 : 0,
    };
}
function pct(curr, prior) {
    return prior > 0 ? Math.round(((curr - prior) / prior) * 10000) / 100 : 0;
}
/**
 * Isolated Google Image search performance. Image search supports the same
 * dimensions as web (query, page, country, device, date).
 */
async function imageAnalysis(days = 28, rowLimit = 50) {
    const current = (0, analytics_js_1.getDateRange)(days);
    const prior = (0, analytics_js_1.getPriorDateRange)(days);
    const [queryRows, pageRows, priorRows] = await Promise.all([
        (0, analytics_js_1.fetchAllRows)({ startDate: current.startDate, endDate: current.endDate, dimensions: ["query"], searchType: "image" }),
        (0, analytics_js_1.fetchAllRows)({ startDate: current.startDate, endDate: current.endDate, dimensions: ["page"], searchType: "image" }),
        (0, analytics_js_1.fetchAllRows)({ startDate: prior.startDate, endDate: prior.endDate, dimensions: ["date"], searchType: "image" }),
    ]);
    const dateRowsCurrent = await (0, analytics_js_1.fetchAllRows)({ startDate: current.startDate, endDate: current.endDate, dimensions: ["date"], searchType: "image" });
    const curTotals = summarise(dateRowsCurrent);
    const priorTotals = summarise(priorRows);
    const topQueries = queryRows
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, Math.min(rowLimit, 200))
        .map((r) => ({
        query: r.keys[0],
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: Math.round(r.ctr * 10000) / 100,
        position: Math.round(r.position * 10) / 10,
    }));
    const topPages = pageRows
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, Math.min(rowLimit, 200))
        .map((r) => ({
        page: r.keys[0],
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: Math.round(r.ctr * 10000) / 100,
        position: Math.round(r.position * 10) / 10,
    }));
    return {
        surface: "image",
        period: current,
        totals: curTotals,
        change: {
            clicksPercent: pct(curTotals.clicks, priorTotals.clicks),
            impressionsPercent: pct(curTotals.impressions, priorTotals.impressions),
            position: Math.round((curTotals.position - priorTotals.position) * 10) / 10,
        },
        topQueries,
        topPages,
        note: "Image search data only. Optimise on filename, alt text, surrounding context, " +
            "image dimensions and structured data (ImageObject).",
    };
}
