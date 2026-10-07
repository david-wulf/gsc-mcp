"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchAppearance = searchAppearance;
const analytics_js_1 = require("../analytics.js");
/**
 * Search-appearance breakdown (rich-result / feature types). Common values include
 * MERCHANT_LISTINGS (Händlereinträge), PRODUCT_SNIPPETS, REVIEW_SNIPPET,
 * RECIPE_FEATURE, VIDEO, AMP_* and others — the exact set is whatever the property
 * is eligible for. The API requires searchAppearance to be queried alone, so to see
 * which pages/queries drive a given appearance you must filter on it (drilldown).
 *
 * @param appearance Optional. If provided, drills into that appearance type and
 *                   returns the top pages (or queries) driving it.
 */
async function searchAppearance(days = 28, appearance, drillDimension = "page", searchType = "web", rowLimit = 50) {
    const period = (0, analytics_js_1.getDateRange)(days);
    // Step 1: always fetch the full appearance breakdown (searchAppearance alone).
    const breakdownRows = await (0, analytics_js_1.fetchAllRows)({
        startDate: period.startDate,
        endDate: period.endDate,
        dimensions: ["searchAppearance"],
        searchType,
    });
    const appearanceBreakdown = breakdownRows
        .sort((a, b) => b.impressions - a.impressions)
        .map((r) => ({
        appearance: r.keys[0],
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: Math.round(r.ctr * 10000) / 100,
        position: Math.round(r.position * 10) / 10,
    }));
    let drilldown;
    // Step 2: optional drilldown — filter on the appearance, group by page/query.
    if (appearance) {
        const drillRows = await (0, analytics_js_1.fetchAllRows)({
            startDate: period.startDate,
            endDate: period.endDate,
            dimensions: [drillDimension],
            searchType,
            dimensionFilterGroups: [
                {
                    filters: [
                        { dimension: "searchAppearance", operator: "equals", expression: appearance },
                    ],
                },
            ],
        });
        drilldown = {
            appearance,
            dimension: drillDimension,
            rows: drillRows
                .sort((a, b) => b.clicks - a.clicks)
                .slice(0, Math.min(rowLimit, 200))
                .map((r) => ({
                key: r.keys[0],
                clicks: r.clicks,
                impressions: r.impressions,
                ctr: Math.round(r.ctr * 10000) / 100,
                position: Math.round(r.position * 10) / 10,
            })),
        };
    }
    return {
        surface: searchType,
        mode: appearance ? "drilldown" : "breakdown",
        period,
        appearanceBreakdown,
        drilldown,
        note: appearance
            ? `Top ${drilldown?.dimension ?? "page"}s for appearance "${appearance}". Filtered via dimensionFilterGroups.`
            : "Appearance-type breakdown. Pass an `appearance` value (e.g. MERCHANT_LISTINGS) to drill into the pages or queries driving it.",
    };
}
