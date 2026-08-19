"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ctrOpportunities = ctrOpportunities;
const analytics_js_1 = require("../analytics.js");
async function ctrOpportunities(days = 28, minImpressions = 500, searchType = "web", device, country) {
    (0, analytics_js_1.assertValidDimensions)(searchType, ["page"]);
    const { startDate, endDate } = (0, analytics_js_1.getDateRange)(days);
    const extra = (0, analytics_js_1.deviceCountryFilters)(device, country, searchType);
    const dimensionFilterGroups = extra.length ? [{ filters: extra }] : undefined;
    const rows = await (0, analytics_js_1.fetchAllRows)({
        dimensionFilterGroups,
        startDate,
        endDate,
        dimensions: ["page"],
        searchType,
    });
    // Kurve auf den ungefilterten Zeilen bauen, sonst ist sie nach oben verzerrt.
    const curve = (0, analytics_js_1.buildClickCurve)(rows, "page rows of this request");
    const opportunities = [];
    for (const row of rows) {
        if (row.impressions < minImpressions)
            continue;
        if (row.position > 20)
            continue; // only care about pages that rank somewhat
        const expectation = (0, analytics_js_1.expectedCtr)(row.position, curve);
        const expected = expectation.ctr;
        const gap = expected - row.ctr;
        if (gap <= 0.01)
            continue; // CTR is at or above benchmark
        opportunities.push({
            page: row.keys[0],
            clicks: row.clicks,
            impressions: row.impressions,
            ctr: Math.round(row.ctr * 10000) / 100,
            position: Math.round(row.position * 10) / 10,
            expectedCtr: Math.round(expected * 10000) / 100,
            expectedCtrSource: expectation.source,
            ctrGap: Math.round(gap * 10000) / 100,
            potentialExtraClicks: Math.round(row.impressions * gap),
        });
    }
    opportunities.sort((a, b) => b.potentialExtraClicks - a.potentialExtraClicks);
    return opportunities.slice(0, 50);
}
