"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.topicClusterPerformance = topicClusterPerformance;
const analytics_js_1 = require("../analytics.js");
async function topicClusterPerformance(pathPattern, days = 28, searchType = "web") {
    const { startDate, endDate } = (0, analytics_js_1.getDateRange)(days);
    const supportsQuery = analytics_js_1.ALLOWED_DIMENSIONS[searchType].includes("query");
    // Fetch page-level data filtered by URL pattern
    const pageRows = await (0, analytics_js_1.fetchAllRows)({
        startDate,
        endDate,
        dimensions: ["page"],
        searchType,
        dimensionFilterGroups: [
            {
                filters: [
                    {
                        dimension: "page",
                        operator: "contains",
                        expression: pathPattern,
                    },
                ],
            },
        ],
    });
    // Fetch query-level data filtered by URL pattern.
    // Surfaces like Discover have no query dimension, so skip it there.
    const queryRows = supportsQuery
        ? await (0, analytics_js_1.fetchAllRows)({
            startDate,
            endDate,
            dimensions: ["query"],
            searchType,
            dimensionFilterGroups: [
                {
                    filters: [
                        {
                            dimension: "page",
                            operator: "contains",
                            expression: pathPattern,
                        },
                    ],
                },
            ],
        })
        : [];
    let totalClicks = 0;
    let totalImpressions = 0;
    let positionWeight = 0;
    for (const row of pageRows) {
        totalClicks += row.clicks;
        totalImpressions += row.impressions;
        positionWeight += row.position * row.impressions;
    }
    const topPages = pageRows
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, 5)
        .map((r) => ({
        page: r.keys[0],
        clicks: r.clicks,
        impressions: r.impressions,
        position: Math.round(r.position * 10) / 10,
    }));
    const topQueries = queryRows
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, 5)
        .map((r) => ({
        query: r.keys[0],
        clicks: r.clicks,
        impressions: r.impressions,
        position: Math.round(r.position * 10) / 10,
    }));
    return {
        pathPattern,
        totalClicks,
        totalImpressions,
        averageCtr: totalImpressions > 0
            ? Math.round((totalClicks / totalImpressions) * 10000) / 100
            : 0,
        averagePosition: totalImpressions > 0
            ? Math.round((positionWeight / totalImpressions) * 10) / 10
            : 0,
        pageCount: pageRows.length,
        topPages,
        topQueries,
    };
}
