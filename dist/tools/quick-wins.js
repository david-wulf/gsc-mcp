"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.quickWins = quickWins;
const analytics_js_1 = require("../analytics.js");
async function quickWins(days = 28, minImpressions = 100, maxPosition = 15, searchType = "web", device, country) {
    (0, analytics_js_1.assertValidDimensions)(searchType, ["query"]);
    const { startDate, endDate } = (0, analytics_js_1.getDateRange)(days);
    const extra = (0, analytics_js_1.deviceCountryFilters)(device, country, searchType);
    const dimensionFilterGroups = extra.length ? [{ filters: extra }] : undefined;
    const rows = await (0, analytics_js_1.fetchAllRows)({
        dimensionFilterGroups,
        startDate,
        endDate,
        dimensions: ["query"],
        searchType,
    });
    // Kurve auf den ungefilterten Zeilen bauen, sonst ist sie nach oben verzerrt.
    const curve = (0, analytics_js_1.buildClickCurve)(rows, "query rows of this request");
    const wins = [];
    for (const row of rows) {
        const position = row.position;
        const impressions = row.impressions;
        if (position < 4 || position > maxPosition)
            continue;
        if (impressions < minImpressions)
            continue;
        // Opportunity = impressions * (CTR auf Position 3 - aktuelle CTR)
        const target = (0, analytics_js_1.expectedCtr)(3, curve);
        const currentCtr = row.ctr;
        const opportunity = Math.round(impressions * Math.max(0, target.ctr - currentCtr));
        wins.push({
            query: row.keys[0],
            clicks: row.clicks,
            impressions,
            ctr: Math.round(row.ctr * 10000) / 100,
            position: Math.round(position * 10) / 10,
            opportunity,
            targetCtrSource: target.source,
        });
    }
    wins.sort((a, b) => b.opportunity - a.opportunity);
    return wins.slice(0, 50);
}
