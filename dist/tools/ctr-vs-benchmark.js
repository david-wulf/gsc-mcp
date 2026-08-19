"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ctrVsBenchmark = ctrVsBenchmark;
const analytics_js_1 = require("../analytics.js");
async function ctrVsBenchmark(days = 28, minImpressions = 200, searchType = "web") {
    (0, analytics_js_1.assertValidDimensions)(searchType, ["page"]);
    const { startDate, endDate } = (0, analytics_js_1.getDateRange)(days);
    const rows = await (0, analytics_js_1.fetchAllRows)({
        startDate,
        endDate,
        dimensions: ["page"],
        searchType,
    });
    // Kurve auf den ungefilterten Zeilen bauen, sonst ist sie nach oben verzerrt.
    const curve = (0, analytics_js_1.buildClickCurve)(rows, "page rows of this request");
    const results = [];
    for (const row of rows) {
        if (row.impressions < minImpressions)
            continue;
        if (row.position > 20)
            continue;
        const expectation = (0, analytics_js_1.expectedCtr)(row.position, curve);
        const benchmark = expectation.ctr;
        const gap = row.ctr - benchmark;
        const gapPercent = Math.round(gap * 10000) / 100;
        let verdict;
        if (gap >= 0.02) {
            verdict = "Above benchmark";
        }
        else if (gap >= -0.02) {
            verdict = "At benchmark";
        }
        else if (gap >= -0.05) {
            verdict = "Below benchmark — review title and meta description";
        }
        else {
            verdict = "Significantly below benchmark — likely needs title/description rewrite or rich snippet work";
        }
        results.push({
            page: row.keys[0],
            clicks: row.clicks,
            impressions: row.impressions,
            actualCtr: Math.round(row.ctr * 10000) / 100,
            position: Math.round(row.position * 10) / 10,
            benchmarkCtr: Math.round(benchmark * 10000) / 100,
            benchmarkSource: expectation.source,
            gap: gapPercent,
            verdict,
        });
    }
    // Sort by gap ascending (worst performers first)
    results.sort((a, b) => a.gap - b.gap);
    return results.slice(0, 50);
}
