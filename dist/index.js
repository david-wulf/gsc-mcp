#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const zod_1 = require("zod");
const guardrails_js_1 = require("./guardrails.js");
const quick_wins_js_1 = require("./tools/quick-wins.js");
const ctr_opportunities_js_1 = require("./tools/ctr-opportunities.js");
const traffic_drops_js_1 = require("./tools/traffic-drops.js");
const content_gaps_js_1 = require("./tools/content-gaps.js");
const site_snapshot_js_1 = require("./tools/site-snapshot.js");
const inspect_url_js_1 = require("./tools/inspect-url.js");
const cannibalization_check_js_1 = require("./tools/cannibalization-check.js");
const content_decay_js_1 = require("./tools/content-decay.js");
const topic_cluster_performance_js_1 = require("./tools/topic-cluster-performance.js");
const ctr_vs_benchmark_js_1 = require("./tools/ctr-vs-benchmark.js");
const verify_claim_js_1 = require("./tools/verify-claim.js");
const advanced_search_analytics_js_1 = require("./tools/advanced-search-analytics.js");
const check_alerts_js_1 = require("./tools/check-alerts.js");
const content_recommendations_js_1 = require("./tools/content-recommendations.js");
const generate_report_js_1 = require("./tools/generate-report.js");
const multi_site_dashboard_js_1 = require("./tools/multi-site-dashboard.js");
const submit_url_js_1 = require("./tools/submit-url.js");
const submit_sitemap_js_1 = require("./tools/submit-sitemap.js");
// Fork tools: surfaces the upstream image suite does not cover.
const discover_analysis_js_1 = require("./tools/discover-analysis.js");
const image_analysis_js_1 = require("./tools/image-analysis.js");
const search_appearance_js_1 = require("./tools/search-appearance.js");
const query_count_js_1 = require("./tools/query-count.js");
// v2.3 image SEO tools — paired with the Image SEO post on suganthan.com.
const image_keyword_overview_js_1 = require("./tools/image-keyword-overview.js");
const image_search_quick_wins_js_1 = require("./tools/image-search-quick-wins.js");
const compare_web_vs_image_js_1 = require("./tools/compare-web-vs-image.js");
const image_pages_overview_js_1 = require("./tools/image-pages-overview.js");
const image_keyword_trends_js_1 = require("./tools/image-keyword-trends.js");
const image_impressions_no_clicks_js_1 = require("./tools/image-impressions-no-clicks.js");
const image_content_decay_js_1 = require("./tools/image-content-decay.js");
// v2.4 generative AI tools — the Generative AI report has no API, but AI Mode
// conversation exhaust leaks into the regular query dimension. See the tool
// file for the mechanism and sources.
const genai_conversation_queries_js_1 = require("./tools/genai-conversation-queries.js");
// v2.5: the bridge from "which pages fail in image search" to "why". Fetches
// the user's own pages and audits the on-page image factors.
const image_page_audit_js_1 = require("./tools/image-page-audit.js");
const server = new mcp_js_1.McpServer({
    name: "gsc-mcp",
    version: "2.5.1",
});
// Shared GSC surface (search type) parameter. "web" is the API default and keeps
// every tool backwards-compatible. Page-based tools also accept "discover";
// query-based tools accept image/video/news but not discover (no query dimension).
const SURFACES = ["web", "image", "video", "news", "discover", "googleNews"];
const surfaceParam = (note) => zod_1.z.enum(SURFACES).default("web").describe(note);
// 1. Quick Wins
server.registerTool("quick_wins", {
    description: "Find keywords you're almost ranking for that could be pushed to page one. Returns queries at positions 4-15 with high impressions, sorted by traffic opportunity." + guardrails_js_1.GUARDRAIL_SUFFIX + guardrails_js_1.VISUAL_SUFFIX + guardrails_js_1.POSITION_CAVEAT,
    inputSchema: {
        days: zod_1.z.number().default(28).describe("Number of days to analyse"),
        min_impressions: zod_1.z.number().default(100).describe("Minimum impressions threshold"),
        max_position: zod_1.z.number().default(15).describe("Maximum position to include"),
        surface: surfaceParam("Surface to query: web (default), image, video, news. Discover is NOT supported here (no query dimension)."),
        device: zod_1.z.enum(["MOBILE", "DESKTOP", "TABLET"]).optional().describe("Restrict to one device. Omit for all devices, which is the default. Not available on Discover, which carries no device dimension."),
        country: zod_1.z.string().optional().describe("Restrict to one country as an ISO-3166-1 alpha-3 code, e.g. deu, aut, che. Omit for all countries, which is the default."),
    },
}, async ({ days, min_impressions, max_position, surface, device, country }) => {
    const results = await (0, quick_wins_js_1.quickWins)(days, min_impressions, max_position, surface, device, country);
    const wrapped = (0, guardrails_js_1.withMeta)(results, "quick_wins", { days, min_impressions, max_position, surface, device, country });
    return {
        content: [{ type: "text", text: JSON.stringify(wrapped, null, 2) }],
    };
});
// 2. CTR Opportunities
server.registerTool("ctr_opportunities", {
    description: "Find pages with high impressions but CTR significantly below expected for their position. These are title/meta description optimisation candidates." + guardrails_js_1.GUARDRAIL_SUFFIX + guardrails_js_1.VISUAL_SUFFIX + guardrails_js_1.POSITION_CAVEAT,
    inputSchema: {
        days: zod_1.z.number().default(28).describe("Number of days to analyse"),
        min_impressions: zod_1.z.number().default(500).describe("Minimum impressions threshold"),
        surface: surfaceParam("Surface to query: web (default), image, video, news, discover. Discover is page-based and supported."),
        device: zod_1.z.enum(["MOBILE", "DESKTOP", "TABLET"]).optional().describe("Restrict to one device. Omit for all devices, which is the default. Not available on Discover, which carries no device dimension."),
        country: zod_1.z.string().optional().describe("Restrict to one country as an ISO-3166-1 alpha-3 code, e.g. deu, aut, che. Omit for all countries, which is the default."),
    },
}, async ({ days, min_impressions, surface, device, country }) => {
    const results = await (0, ctr_opportunities_js_1.ctrOpportunities)(days, min_impressions, surface, device, country);
    const wrapped = (0, guardrails_js_1.withMeta)(results, "ctr_opportunities", { days, min_impressions, surface, device, country });
    return {
        content: [{ type: "text", text: JSON.stringify(wrapped, null, 2) }],
    };
});
// 3. Traffic Drops
server.registerTool("traffic_drops", {
    description: "Find pages that lost the most traffic recently. Compares current period vs prior period and diagnoses whether each drop is a ranking loss, CTR collapse, or demand decline." + guardrails_js_1.GUARDRAIL_SUFFIX + guardrails_js_1.VISUAL_SUFFIX + guardrails_js_1.POSITION_CAVEAT,
    inputSchema: {
        days: zod_1.z.number().default(28).describe("Number of days per period to compare"),
        surface: surfaceParam("Surface to query: web (default), image, video, news, discover. Discover is page-based and supported."),
    },
}, async ({ days, surface }) => {
    const results = await (0, traffic_drops_js_1.trafficDrops)(days, surface);
    const wrapped = (0, guardrails_js_1.withMeta)(results, "traffic_drops", { days, surface });
    return {
        content: [{ type: "text", text: JSON.stringify(wrapped, null, 2) }],
    };
});
// 4. Content Gaps
server.registerTool("content_gaps", {
    description: "Find topics you should create content for. Returns queries where you get impressions but rank beyond position 20, meaning there is search demand but no real content targeting it." + guardrails_js_1.GUARDRAIL_SUFFIX + guardrails_js_1.VISUAL_SUFFIX + guardrails_js_1.POSITION_CAVEAT,
    inputSchema: {
        days: zod_1.z.number().default(90).describe("Number of days to analyse"),
        min_impressions: zod_1.z.number().default(50).describe("Minimum impressions threshold"),
        min_position: zod_1.z.number().default(20).describe("Minimum position (queries ranking worse than this)"),
        surface: surfaceParam("Surface to query: web (default), image, video, news. Discover is NOT supported here (no query dimension)."),
    },
}, async ({ days, min_impressions, min_position, surface }) => {
    const results = await (0, content_gaps_js_1.contentGaps)(days, min_impressions, min_position, surface);
    const wrapped = (0, guardrails_js_1.withMeta)(results, "content_gaps", { days, min_impressions, min_position, surface });
    return {
        content: [{ type: "text", text: JSON.stringify(wrapped, null, 2) }],
    };
});
// 5. Site Snapshot
server.registerTool("site_snapshot", {
    description: "Get a quick overview of how the site is performing. Returns total clicks, impressions, CTR, and position with a comparison to the prior period." + guardrails_js_1.GUARDRAIL_SUFFIX + guardrails_js_1.VISUAL_SUFFIX + guardrails_js_1.POSITION_CAVEAT,
    inputSchema: {
        days: zod_1.z.number().default(28).describe("Number of days per period"),
    },
}, async ({ days }) => {
    const results = await (0, site_snapshot_js_1.siteSnapshot)(days);
    const wrapped = (0, guardrails_js_1.withMeta)(results, "site_snapshot", { days });
    return {
        content: [{ type: "text", text: JSON.stringify(wrapped, null, 2) }],
    };
});
// 6. Inspect URL
server.registerTool("inspect_url", {
    description: "Check if a URL is indexed and why or why not. Returns indexing status, last crawl date, canonical info, robots/noindex issues, and mobile usability in one answer." + guardrails_js_1.GUARDRAIL_SUFFIX + guardrails_js_1.VISUAL_SUFFIX,
    inputSchema: {
        url: zod_1.z.string().describe("The full URL to inspect"),
    },
}, async ({ url }) => {
    const results = await (0, inspect_url_js_1.inspectUrlTool)(url);
    const wrapped = (0, guardrails_js_1.withMeta)(results, "inspect_url", { url });
    return {
        content: [{ type: "text", text: JSON.stringify(wrapped, null, 2) }],
    };
});
// 7. Cannibalization Check
server.registerTool("cannibalization_check", {
    description: "Find keywords where multiple pages from your site compete against each other. Shows which page ranks higher, the position gap, and combined impressions being split." + guardrails_js_1.GUARDRAIL_SUFFIX + guardrails_js_1.VISUAL_SUFFIX + guardrails_js_1.POSITION_CAVEAT,
    inputSchema: {
        days: zod_1.z.number().default(28).describe("Number of days to analyse"),
        min_impressions: zod_1.z.number().default(50).describe("Minimum combined impressions for a query"),
        surface: surfaceParam("Surface to query: web (default), image, video, news. Discover is NOT supported here (no query dimension)."),
    },
}, async ({ days, min_impressions, surface }) => {
    const results = await (0, cannibalization_check_js_1.cannibalizationCheck)(days, min_impressions, surface);
    const wrapped = (0, guardrails_js_1.withMeta)(results, "cannibalization_check", { days, min_impressions, surface });
    return {
        content: [{ type: "text", text: JSON.stringify(wrapped, null, 2) }],
    };
});
// 8. Content Decay
server.registerTool("content_decay", {
    description: "Find pages that are slowly dying with consistent traffic decline over three consecutive 30-day periods. One bad month is noise; three consecutive bad months is a problem." + guardrails_js_1.GUARDRAIL_SUFFIX + guardrails_js_1.VISUAL_SUFFIX + guardrails_js_1.POSITION_CAVEAT,
    inputSchema: {
        surface: surfaceParam("Surface to query: web (default), image, video, news, discover. Discover is page-based and supported."),
        device: zod_1.z.enum(["MOBILE", "DESKTOP", "TABLET"]).optional().describe("Restrict to one device. Omit for all devices, which is the default. Not available on Discover, which carries no device dimension."),
        country: zod_1.z.string().optional().describe("Restrict to one country as an ISO-3166-1 alpha-3 code, e.g. deu, aut, che. Omit for all countries, which is the default."),
    },
}, async ({ surface, device, country }) => {
    const results = await (0, content_decay_js_1.contentDecay)(surface, device, country);
    const wrapped = (0, guardrails_js_1.withMeta)(results, "content_decay", { surface, device, country });
    return {
        content: [{ type: "text", text: JSON.stringify(wrapped, null, 2) }],
    };
});
// 9. Topic Cluster Performance
server.registerTool("topic_cluster_performance", {
    description: "See how a group of pages performs as a whole. Aggregates clicks, impressions, CTR, and position for all pages matching a URL path pattern, plus top 5 pages and queries." + guardrails_js_1.GUARDRAIL_SUFFIX + guardrails_js_1.VISUAL_SUFFIX + guardrails_js_1.POSITION_CAVEAT,
    inputSchema: {
        path_pattern: zod_1.z.string().describe("URL path pattern to match (e.g. /blog/seo)"),
        days: zod_1.z.number().default(28).describe("Number of days to analyse"),
        surface: surfaceParam("Surface to query: web (default), image, video, news, discover. On Discover only page-level data is returned (no queries)."),
    },
}, async ({ path_pattern, days, surface }) => {
    const results = await (0, topic_cluster_performance_js_1.topicClusterPerformance)(path_pattern, days, surface);
    const wrapped = (0, guardrails_js_1.withMeta)(results, "topic_cluster_performance", { path_pattern, days, surface });
    return {
        content: [{ type: "text", text: JSON.stringify(wrapped, null, 2) }],
    };
});
// 10. CTR vs Benchmark
server.registerTool("ctr_vs_benchmark", {
    description: "Compare your actual CTR per page against industry benchmarks by position. Flags pages significantly underperforming for their ranking position." + guardrails_js_1.GUARDRAIL_SUFFIX + guardrails_js_1.VISUAL_SUFFIX + guardrails_js_1.POSITION_CAVEAT,
    inputSchema: {
        days: zod_1.z.number().default(28).describe("Number of days to analyse"),
        min_impressions: zod_1.z.number().default(200).describe("Minimum impressions threshold"),
        surface: surfaceParam("Surface to query: web (default), image, video, news, discover. Discover is page-based and supported."),
    },
}, async ({ days, min_impressions, surface }) => {
    const results = await (0, ctr_vs_benchmark_js_1.ctrVsBenchmark)(days, min_impressions, surface);
    const wrapped = (0, guardrails_js_1.withMeta)(results, "ctr_vs_benchmark", { days, min_impressions, surface });
    return {
        content: [{ type: "text", text: JSON.stringify(wrapped, null, 2) }],
    };
});
// 11. Verify Claim
server.registerTool("verify_claim", {
    description: "Verify a specific numeric claim against live GSC data. Use this to self-check your analysis before presenting findings. Pass the claim text, the metric to check, the expected value, and optionally a URL or query to filter by. Returns whether the claim is verified and any discrepancy found.",
    inputSchema: {
        claim: zod_1.z.string().describe("The claim to verify, e.g. 'Homepage gets 500 clicks per month'"),
        metric: zod_1.z.enum(["clicks", "impressions", "ctr", "position"]).describe("Which metric to check"),
        expected_value: zod_1.z.number().describe("The numeric value you claimed"),
        url: zod_1.z.string().optional().describe("Filter to a specific URL"),
        query: zod_1.z.string().optional().describe("Filter to a specific search query"),
        days: zod_1.z.number().default(28).describe("Number of days to check"),
        surface: surfaceParam("Surface to query: web (default), image, video, news, discover. On Discover only page-level data is returned (no queries)."),
    },
}, async ({ claim, metric, expected_value, url, query, days, surface }) => {
    const results = await (0, verify_claim_js_1.verifyClaim)(claim, metric, expected_value, url, query, days, surface);
    return {
        content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
    };
});
// 12. Advanced Search Analytics
server.registerTool("advanced_search_analytics", {
    description: "Run a custom search analytics query with flexible dimensions and filters. Supports country, device, query, and page filtering, plus search type (web/image/video/news/discover/googleNews). For power users who need specific data cuts." + guardrails_js_1.GUARDRAIL_SUFFIX + guardrails_js_1.VISUAL_SUFFIX + guardrails_js_1.POSITION_CAVEAT,
    inputSchema: {
        days: zod_1.z.number().default(28).describe("Number of days to analyse"),
        dimensions: zod_1.z.array(zod_1.z.string()).default(["query"]).describe("Dimensions to group by: query, page, country, device, date"),
        filters: zod_1.z.array(zod_1.z.object({
            dimension: zod_1.z.string().describe("Dimension to filter: query, page, country, device"),
            operator: zod_1.z.string().describe("Operator: contains, notContains, equals, notEquals, includingRegex, excludingRegex"),
            expression: zod_1.z.string().describe("Filter value"),
        })).default([]).describe("Dimension filters to apply"),
        row_limit: zod_1.z.number().default(100).describe("Maximum rows to return (max 500)"),
        order_by: zod_1.z.string().default("clicks").describe("Sort by: clicks, impressions, ctr, position"),
        order_direction: zod_1.z.string().default("descending").describe("Sort direction: ascending, descending"),
        site_url: zod_1.z.string().optional().describe("Override the default site URL"),
        surface: surfaceParam("Surface to query: web (default), image, video, news, discover, googleNews. Dimensions must be valid for the chosen surface."),
    },
}, async ({ days, dimensions, filters, row_limit, order_by, order_direction, site_url, surface }) => {
    const results = await (0, advanced_search_analytics_js_1.advancedSearchAnalytics)(days, dimensions, filters, row_limit, order_by, order_direction, site_url, surface);
    const wrapped = (0, guardrails_js_1.withMeta)(results, "advanced_search_analytics", { days, dimensions, filters, row_limit, order_by, surface });
    return {
        content: [{ type: "text", text: JSON.stringify(wrapped, null, 2) }],
    };
});
// 13. Check Alerts
server.registerTool("check_alerts", {
    description: "Check for SEO alerts: position drops, CTR collapses, click losses, and pages that disappeared from search results. Returns severity-rated alerts so you know what needs attention first." + guardrails_js_1.GUARDRAIL_SUFFIX + guardrails_js_1.VISUAL_SUFFIX + guardrails_js_1.POSITION_CAVEAT,
    inputSchema: {
        days: zod_1.z.number().default(7).describe("Number of days per period to compare"),
        position_drop_threshold: zod_1.z.number().default(20).describe("Alert if position drops more than this many spots"),
        ctr_drop_threshold: zod_1.z.number().default(50).describe("Alert if CTR drops more than this percentage"),
        click_drop_threshold: zod_1.z.number().default(30).describe("Alert if clicks drop more than this percentage"),
        surface: surfaceParam("Surface to query: web (default), image, video, news. Discover is NOT supported here (no query dimension)."),
    },
}, async ({ days, position_drop_threshold, ctr_drop_threshold, click_drop_threshold, surface }) => {
    const results = await (0, check_alerts_js_1.checkAlerts)(days, position_drop_threshold, ctr_drop_threshold, click_drop_threshold, surface);
    const wrapped = (0, guardrails_js_1.withMeta)(results, "check_alerts", { days, position_drop_threshold, ctr_drop_threshold, click_drop_threshold, surface });
    return {
        content: [{ type: "text", text: JSON.stringify(wrapped, null, 2) }],
    };
});
// 14. Content Recommendations
server.registerTool("content_recommendations", {
    description: "Get actionable content recommendations by cross-referencing quick wins, content gaps, and cannibalisation data. Returns prioritised actions: pages to update, content to create, and pages to consolidate." + guardrails_js_1.GUARDRAIL_SUFFIX + guardrails_js_1.VISUAL_SUFFIX,
    inputSchema: {
        days: zod_1.z.number().default(28).describe("Number of days to analyse"),
        max_recommendations: zod_1.z.number().default(10).describe("Maximum number of recommendations"),
    },
}, async ({ days, max_recommendations }) => {
    const results = await (0, content_recommendations_js_1.contentRecommendations)(days, max_recommendations);
    const wrapped = (0, guardrails_js_1.withMeta)(results, "content_recommendations", { days, max_recommendations });
    return {
        content: [{ type: "text", text: JSON.stringify(wrapped, null, 2) }],
    };
});
// 15. Generate Report
server.registerTool("generate_report", {
    description: "Generate a comprehensive markdown performance report. Covers site snapshot, alerts, quick wins, traffic drops, content decay, and recommendations. Saves to disk for weekly reviews or scheduled reporting." + guardrails_js_1.GUARDRAIL_SUFFIX + guardrails_js_1.VISUAL_SUFFIX,
    inputSchema: {
        output_path: zod_1.z.string().optional().describe("File path to save the report (default: ./gsc-report-{date}.md)"),
        days: zod_1.z.number().default(28).describe("Number of days to analyse"),
        include_sections: zod_1.z.array(zod_1.z.string()).optional().describe("Sections: snapshot, alerts, quick_wins, traffic_drops, content_decay, recommendations"),
    },
}, async ({ output_path, days, include_sections }) => {
    const results = await (0, generate_report_js_1.generateReport)(output_path, days, include_sections);
    return {
        content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
    };
});
// 16. Multi-Site Dashboard
server.registerTool("multi_site_dashboard", {
    description: "Health check across multiple GSC properties in one view. Shows clicks, impressions, CTR, and position for each site with period comparison and health status. Agency essential." + guardrails_js_1.GUARDRAIL_SUFFIX + guardrails_js_1.VISUAL_SUFFIX + guardrails_js_1.POSITION_CAVEAT,
    inputSchema: {
        site_urls: zod_1.z.array(zod_1.z.string()).optional().describe("Array of GSC property URLs. Falls back to GSC_SITE_URLS env var."),
        days: zod_1.z.number().default(28).describe("Number of days per period"),
    },
}, async ({ site_urls, days }) => {
    const results = await (0, multi_site_dashboard_js_1.multiSiteDashboard)(site_urls, days);
    const wrapped = (0, guardrails_js_1.withMeta)(results, "multi_site_dashboard", { site_urls, days });
    return {
        content: [{ type: "text", text: JSON.stringify(wrapped, null, 2) }],
    };
});
// 17. Submit URL for Indexing
server.registerTool("submit_url", {
    description: "Submit a URL to Google's Indexing API to request crawling and indexing. Works for notifying Google of new or updated content. Note: Google officially supports this for JobPosting/BroadcastEvent schema but processes all page types." + guardrails_js_1.GUARDRAIL_SUFFIX,
    inputSchema: {
        url: zod_1.z.string().describe("The full URL to submit for indexing"),
        action: zod_1.z.enum(["URL_UPDATED", "URL_DELETED"]).default("URL_UPDATED").describe("URL_UPDATED for new/changed content, URL_DELETED for removed pages"),
    },
}, async ({ url, action }) => {
    const results = await (0, submit_url_js_1.submitUrl)(url, action);
    return {
        content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
    };
});
// 18. Batch Submit URLs
server.registerTool("submit_batch", {
    description: "Submit up to 200 URLs to Google's Indexing API in one go. Daily quota is 200 URL notifications. Use for bulk indexing requests after publishing multiple pages or a site-wide update." + guardrails_js_1.GUARDRAIL_SUFFIX,
    inputSchema: {
        urls: zod_1.z.array(zod_1.z.string()).describe("Array of URLs to submit (max 200)"),
        action: zod_1.z.enum(["URL_UPDATED", "URL_DELETED"]).default("URL_UPDATED").describe("URL_UPDATED for new/changed content, URL_DELETED for removed pages"),
    },
}, async ({ urls, action }) => {
    const results = await (0, submit_url_js_1.submitBatch)(urls, action);
    return {
        content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
    };
});
// 19. Submit Sitemap
server.registerTool("submit_sitemap", {
    description: "Notify Google of a new or updated sitemap. Triggers Google to recrawl the sitemap and discover new pages." + guardrails_js_1.GUARDRAIL_SUFFIX,
    inputSchema: {
        sitemap_url: zod_1.z.string().optional().describe("Full sitemap URL (defaults to {site_url}/sitemap.xml)"),
    },
}, async ({ sitemap_url }) => {
    const results = await (0, submit_sitemap_js_1.submitSitemap)(sitemap_url);
    return {
        content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
    };
});
// 20. List Sitemaps
server.registerTool("list_sitemaps", {
    description: "List all sitemaps submitted for the site, with status, errors, warnings, and indexed page counts." + guardrails_js_1.GUARDRAIL_SUFFIX,
    inputSchema: {},
}, async () => {
    const results = await (0, submit_sitemap_js_1.listSitemaps)();
    const wrapped = (0, guardrails_js_1.withMeta)(results, "list_sitemaps", {});
    return {
        content: [{ type: "text", text: JSON.stringify(wrapped, null, 2) }],
    };
});
// 21. Discover Analysis (isolated)
server.registerTool("discover_analysis", {
    description: "Analyse Google Discover performance in isolation (type=discover). Discover is feed-based, not query-based, so this returns top pages, country split and a daily clicks/impressions trend with a prior-period comparison. No query-level data or position exists for Discover." + guardrails_js_1.GUARDRAIL_SUFFIX + guardrails_js_1.VISUAL_SUFFIX,
    inputSchema: {
        days: zod_1.z.number().default(28).describe("Number of days per period to compare"),
        row_limit: zod_1.z.number().default(50).describe("Max number of top pages to return"),
        site_url: zod_1.z.string().optional().describe("Override the configured property"),
    },
}, async ({ days, row_limit, site_url }) => {
    const results = await (0, discover_analysis_js_1.discoverAnalysis)(days, row_limit, site_url);
    const wrapped = (0, guardrails_js_1.withMeta)(results, "discover_analysis", { days, row_limit, site_url });
    return {
        content: [{ type: "text", text: JSON.stringify(wrapped, null, 2) }],
    };
});
// 22. Image Analysis (isolated)
server.registerTool("image_analysis", {
    description: "Analyse Google Image search performance in isolation (type=image). Returns top image queries, top pages and a prior-period comparison. Separate from web search data." + guardrails_js_1.GUARDRAIL_SUFFIX + guardrails_js_1.VISUAL_SUFFIX,
    inputSchema: {
        days: zod_1.z.number().default(28).describe("Number of days per period to compare"),
        row_limit: zod_1.z.number().default(50).describe("Max number of top queries/pages to return"),
        site_url: zod_1.z.string().optional().describe("Override the configured property"),
    },
}, async ({ days, row_limit, site_url }) => {
    const results = await (0, image_analysis_js_1.imageAnalysis)(days, row_limit, site_url);
    const wrapped = (0, guardrails_js_1.withMeta)(results, "image_analysis", { days, row_limit, site_url });
    return {
        content: [{ type: "text", text: JSON.stringify(wrapped, null, 2) }],
    };
});
// 23. Search Appearance / Merchant Listings (isolated)
server.registerTool("search_appearance", {
    description: "Break down performance by search-appearance / rich-result type (the searchAppearance dimension), e.g. MERCHANT_LISTINGS (Händlereinträge), PRODUCT_SNIPPETS, REVIEW_SNIPPET, RECIPE_FEATURE. Without an appearance argument it lists all appearance types with their metrics. Pass an appearance value to drill into the pages or queries driving that specific type." + guardrails_js_1.GUARDRAIL_SUFFIX + guardrails_js_1.VISUAL_SUFFIX,
    inputSchema: {
        days: zod_1.z.number().default(28).describe("Number of days to analyse"),
        appearance: zod_1.z.string().optional().describe("Appearance type to drill into, e.g. MERCHANT_LISTINGS. Omit for the full breakdown."),
        drill_dimension: zod_1.z.enum(["page", "query"]).default("page").describe("When drilling into an appearance, group by page or query"),
        search_type: zod_1.z.enum(["web", "image", "video", "news", "discover", "googleNews"]).default("web").describe("Surface to query the appearance breakdown for"),
        row_limit: zod_1.z.number().default(50).describe("Max number of drilldown rows to return"),
        site_url: zod_1.z.string().optional().describe("Override the configured property"),
    },
}, async ({ days, appearance, drill_dimension, search_type, row_limit, site_url }) => {
    const results = await (0, search_appearance_js_1.searchAppearance)(days, appearance, drill_dimension, search_type, row_limit, site_url);
    const wrapped = (0, guardrails_js_1.withMeta)(results, "search_appearance", { days, appearance, drill_dimension, search_type, row_limit, site_url });
    return {
        content: [{ type: "text", text: JSON.stringify(wrapped, null, 2) }],
    };
});
// 24. Query Counting
server.registerTool("query_count", {
    description: "Count how many distinct queries a property, a section or a single URL is visible for, split by position group (1-3, 4-10, 11-20, 21-50, 51+). Scope it with url (one page) or url_contains (a path), turn it into a time series with granularity (day/week/month), and narrow it with min_position/max_position. Also reports the anonymized-click gap: clicks the totals contain but no query row explains, because those queries fall below Google's privacy threshold. The query count is a floor, never the complete keyword set." + guardrails_js_1.GUARDRAIL_SUFFIX + guardrails_js_1.VISUAL_SUFFIX,
    inputSchema: {
        days: zod_1.z.number().default(28).describe("Number of days to analyse"),
        url: zod_1.z.string().optional().describe("Count only queries for this exact URL"),
        url_contains: zod_1.z.string().optional().describe("Count only queries for URLs containing this string, e.g. /ratgeber/"),
        granularity: zod_1.z.enum(["none", "day", "week", "month"]).default("none").describe("Return a time series of query counts. One API request per bucket, so day-level is capped at 90 days."),
        min_position: zod_1.z.number().optional().describe("Only count queries at this average position or worse (e.g. 4)"),
        max_position: zod_1.z.number().optional().describe("Only count queries at this average position or better (e.g. 10)"),
        compare_previous: zod_1.z.boolean().default(true).describe("Also count the immediately preceding period of the same length"),
        include_pages: zod_1.z.boolean().default(false).describe("Also rank pages by query count. Expensive: needs the page+query dimension pair, capped at 100k rows."),
        top_pages: zod_1.z.number().default(25).describe("How many pages to return when include_pages is true"),
        surface: surfaceParam("Surface to query: web (default), image, video, news. Discover is NOT supported here (no query dimension)."),
        device: zod_1.z.enum(["MOBILE", "DESKTOP", "TABLET"]).optional().describe("Restrict to one device. Omit for all devices, which is the default. Not available on Discover, which carries no device dimension."),
        country: zod_1.z.string().optional().describe("Restrict to one country as an ISO-3166-1 alpha-3 code, e.g. deu, aut, che. Omit for all countries, which is the default."),
    },
}, async ({ days, url, url_contains, granularity, min_position, max_position, compare_previous, include_pages, top_pages, surface, device, country }) => {
    const results = await (0, query_count_js_1.queryCount)(days, compare_previous, include_pages, top_pages, surface, url, url_contains, granularity, min_position, max_position, device, country);
    const wrapped = (0, guardrails_js_1.withMeta)(results, "query_count", { days, url, url_contains, granularity, min_position, max_position, compare_previous, include_pages, top_pages, surface, device, country });
    return {
        content: [{ type: "text", text: JSON.stringify(wrapped, null, 2) }],
    };
});
// ---------------------------------------------------------------------------
// v2.3 IMAGE SEO TOOLS
//
// These tools all pass type=image to the GSC Search Analytics API, which most
// third-party tools never expose. Paired with the Image SEO technical guide
// on suganthan.com (link in README). All 7 reuse the existing fetchAllRows
// plumbing; the only meaningfully new logic is the join in compare_web_vs_image.
// ---------------------------------------------------------------------------
// 21. Image Keyword Overview
server.registerTool("image_keyword_overview", {
    description: "Top image-search keywords for the site, sorted by impressions, clicks, or position. Filtered to type=image so it returns only what surfaces in Google Images, not web search." + guardrails_js_1.GUARDRAIL_SUFFIX + guardrails_js_1.VISUAL_SUFFIX + guardrails_js_1.POSITION_CAVEAT,
    inputSchema: {
        days: zod_1.z.number().default(90).describe("Number of days to analyse (image search is lower volume, default 90)"),
        min_impressions: zod_1.z.number().default(50).describe("Minimum impressions threshold"),
        row_limit: zod_1.z.number().default(50).describe("Maximum rows to return"),
        order_by: zod_1.z.enum(["impressions", "clicks", "position"]).default("impressions").describe("Sort field"),
        site_url: zod_1.z.string().optional().describe("Override the configured property (e.g. sc-domain:example.com or https://www.example.com/)"),
    },
}, async ({ days, min_impressions, row_limit, order_by, site_url }) => {
    const results = await (0, image_keyword_overview_js_1.imageKeywordOverview)(days, min_impressions, row_limit, order_by, site_url);
    const wrapped = (0, guardrails_js_1.withMeta)(results, "image_keyword_overview", { days, min_impressions, row_limit, order_by, site_url });
    return {
        content: [{ type: "text", text: JSON.stringify(wrapped, null, 2) }],
    };
});
// 22. Image Search Quick Wins
server.registerTool("image_search_quick_wins", {
    description: "Find image-search queries ranking at positions 4-15 with high impressions, sorted by estimated traffic gain if they reach position 3. Uses an image-search CTR baseline calibrated to the lower CTRs typical of Google Images." + guardrails_js_1.GUARDRAIL_SUFFIX + guardrails_js_1.VISUAL_SUFFIX + guardrails_js_1.POSITION_CAVEAT,
    inputSchema: {
        days: zod_1.z.number().default(90).describe("Number of days to analyse"),
        min_impressions: zod_1.z.number().default(500).describe("Minimum impressions threshold"),
        max_position: zod_1.z.number().default(15).describe("Maximum position to include"),
        site_url: zod_1.z.string().optional().describe("Override the configured property (e.g. sc-domain:example.com or https://www.example.com/)"),
    },
}, async ({ days, min_impressions, max_position, site_url }) => {
    const results = await (0, image_search_quick_wins_js_1.imageSearchQuickWins)(days, min_impressions, max_position, site_url);
    const wrapped = (0, guardrails_js_1.withMeta)(results, "image_search_quick_wins", { days, min_impressions, max_position, site_url });
    return {
        content: [{ type: "text", text: JSON.stringify(wrapped, null, 2) }],
    };
});
// 23. Compare Web vs Image
server.registerTool("compare_web_vs_image", {
    description: "For each query, returns side-by-side performance across web and image search. Two GSC API calls joined on query, with an impressions ratio that surfaces where image search carries disproportionate volume relative to web." + guardrails_js_1.GUARDRAIL_SUFFIX + guardrails_js_1.VISUAL_SUFFIX + guardrails_js_1.POSITION_CAVEAT,
    inputSchema: {
        days: zod_1.z.number().default(90).describe("Number of days to analyse"),
        min_combined_impressions: zod_1.z.number().default(100).describe("Minimum combined (web + image) impressions to include the query"),
        row_limit: zod_1.z.number().default(50).describe("Maximum rows to return"),
        site_url: zod_1.z.string().optional().describe("Override the configured property (e.g. sc-domain:example.com or https://www.example.com/)"),
    },
}, async ({ days, min_combined_impressions, row_limit, site_url }) => {
    const results = await (0, compare_web_vs_image_js_1.compareWebVsImage)(days, min_combined_impressions, row_limit, site_url);
    const wrapped = (0, guardrails_js_1.withMeta)(results, "compare_web_vs_image", { days, min_combined_impressions, row_limit, site_url });
    return {
        content: [{ type: "text", text: JSON.stringify(wrapped, null, 2) }],
    };
});
// 24. Image Pages Overview
server.registerTool("image_pages_overview", {
    description: "Pages on the site ranked by image-search performance. Tells you which pages are actually surfacing in Google Images and which are not. Pairs with image_keyword_overview to map ranking queries back to the pages carrying them." + guardrails_js_1.GUARDRAIL_SUFFIX + guardrails_js_1.VISUAL_SUFFIX + guardrails_js_1.POSITION_CAVEAT,
    inputSchema: {
        days: zod_1.z.number().default(90).describe("Number of days to analyse"),
        min_impressions: zod_1.z.number().default(100).describe("Minimum impressions threshold"),
        row_limit: zod_1.z.number().default(50).describe("Maximum rows to return"),
        order_by: zod_1.z.enum(["impressions", "clicks", "position"]).default("clicks").describe("Sort field"),
        site_url: zod_1.z.string().optional().describe("Override the configured property (e.g. sc-domain:example.com or https://www.example.com/)"),
    },
}, async ({ days, min_impressions, row_limit, order_by, site_url }) => {
    const results = await (0, image_pages_overview_js_1.imagePagesOverview)(days, min_impressions, row_limit, order_by, site_url);
    const wrapped = (0, guardrails_js_1.withMeta)(results, "image_pages_overview", { days, min_impressions, row_limit, order_by, site_url });
    return {
        content: [{ type: "text", text: JSON.stringify(wrapped, null, 2) }],
    };
});
// 25. Image Keyword Trends
server.registerTool("image_keyword_trends", {
    description: "Period-over-period trend for image-search queries. Two equal-length windows joined on query, with impressions and position deltas. Negative position delta means the query improved its average rank." + guardrails_js_1.GUARDRAIL_SUFFIX + guardrails_js_1.VISUAL_SUFFIX + guardrails_js_1.POSITION_CAVEAT,
    inputSchema: {
        days: zod_1.z.number().default(28).describe("Length in days of each comparison window (current + prior)"),
        min_combined_impressions: zod_1.z.number().default(100).describe("Minimum combined impressions across both windows"),
        row_limit: zod_1.z.number().default(50).describe("Maximum rows to return"),
        order_by: zod_1.z.enum(["impressions_delta", "position_delta"]).default("impressions_delta").describe("Sort field"),
        site_url: zod_1.z.string().optional().describe("Override the configured property (e.g. sc-domain:example.com or https://www.example.com/)"),
    },
}, async ({ days, min_combined_impressions, row_limit, order_by, site_url }) => {
    const results = await (0, image_keyword_trends_js_1.imageKeywordTrends)(days, min_combined_impressions, row_limit, order_by, site_url);
    const wrapped = (0, guardrails_js_1.withMeta)(results, "image_keyword_trends", { days, min_combined_impressions, row_limit, order_by, site_url });
    return {
        content: [{ type: "text", text: JSON.stringify(wrapped, null, 2) }],
    };
});
// 26. Image Impressions No Clicks
server.registerTool("image_impressions_no_clicks", {
    description: "Surfaces query and page pairs that earn meaningful image-search impressions but effectively zero clicks. The textbook 'thumbnail is not converting' pattern. Defaults tuned for image search, which runs at much higher impression volumes per page than web." + guardrails_js_1.GUARDRAIL_SUFFIX + guardrails_js_1.VISUAL_SUFFIX + guardrails_js_1.POSITION_CAVEAT,
    inputSchema: {
        days: zod_1.z.number().default(90).describe("Number of days to analyse"),
        min_impressions: zod_1.z.number().default(500).describe("Minimum impressions threshold"),
        max_clicks: zod_1.z.number().default(2).describe("Maximum clicks (filter to pages stuck in the impressions-no-clicks pattern)"),
        row_limit: zod_1.z.number().default(50).describe("Maximum rows to return"),
        site_url: zod_1.z.string().optional().describe("Override the configured property (e.g. sc-domain:example.com or https://www.example.com/)"),
    },
}, async ({ days, min_impressions, max_clicks, row_limit, site_url }) => {
    const results = await (0, image_impressions_no_clicks_js_1.imageImpressionsNoClicks)(days, min_impressions, max_clicks, row_limit, site_url);
    const wrapped = (0, guardrails_js_1.withMeta)(results, "image_impressions_no_clicks", { days, min_impressions, max_clicks, row_limit, site_url });
    return {
        content: [{ type: "text", text: JSON.stringify(wrapped, null, 2) }],
    };
});
// 27. Image Content Decay
server.registerTool("image_content_decay", {
    description: "Image-search version of content_decay. Three 30-day windows, flags pages with a consistent decline across all three. Defaults to a lower minimum click threshold than the web equivalent because image search produces lower click volumes overall." + guardrails_js_1.GUARDRAIL_SUFFIX + guardrails_js_1.VISUAL_SUFFIX + guardrails_js_1.POSITION_CAVEAT,
    inputSchema: {
        min_period3_clicks: zod_1.z.number().default(5).describe("Minimum image-search clicks in the oldest 30-day window required for a page to be considered"),
        site_url: zod_1.z.string().optional().describe("Override the configured property (e.g. sc-domain:example.com or https://www.example.com/)"),
    },
}, async ({ min_period3_clicks, site_url }) => {
    const results = await (0, image_content_decay_js_1.imageContentDecay)(min_period3_clicks, site_url);
    const wrapped = (0, guardrails_js_1.withMeta)(results, "image_content_decay", { min_period3_clicks, site_url });
    return {
        content: [{ type: "text", text: JSON.stringify(wrapped, null, 2) }],
    };
});
// 28. Generative AI Conversation Queries
server.registerTool("genai_conversation_queries", {
    description: "Surface AI-conversation exhaust hiding in your regular query data: bare replies to Google's AI ('yes', 'go on'), 'what about X' pivot follow-ups, conversational questions, AI-visibility tracker probes, and full agent prompts logged as queries. Google counts every AI Mode follow-up as a new query and folds AI Mode/AI Overviews into the web search type, so these fragments carry real impressions, positions and clicks. The dedicated Generative AI report has no query dimension; this is the only query-level AI evidence available anywhere. Classifies every match into seven buckets with landing pages, plus a monthly timeline showing when reply-artefacts first appeared on your site. Treat probe and harness buckets as machine traffic, not demand." + guardrails_js_1.GUARDRAIL_SUFFIX + guardrails_js_1.VISUAL_SUFFIX + guardrails_js_1.POSITION_CAVEAT,
    inputSchema: {
        days: zod_1.z.number().default(480).describe("Days to analyse (default 480, the full 16 months GSC retains)"),
        min_impressions: zod_1.z.number().default(1).describe("Minimum impressions for a query to be listed (single-impression rows are evidence, not noise, so the default keeps them)"),
        max_rows_per_bucket: zod_1.z.number().default(50).describe("Maximum rows returned per bucket; totals always cover everything"),
        include_timeline: zod_1.z.boolean().default(true).describe("Include the monthly artefact timeline (one extra API call)"),
        site_url: zod_1.z.string().optional().describe("Override the configured property (e.g. sc-domain:example.com)"),
    },
}, async ({ days, min_impressions, max_rows_per_bucket, include_timeline, site_url }) => {
    const results = await (0, genai_conversation_queries_js_1.genaiConversationQueries)(days, min_impressions, max_rows_per_bucket, include_timeline, site_url);
    const wrapped = (0, guardrails_js_1.withMeta)(results, "genai_conversation_queries", { days, min_impressions, max_rows_per_bucket, include_timeline, site_url });
    return {
        content: [{ type: "text", text: JSON.stringify(wrapped, null, 2) }],
    };
});
// 29. Image Page Audit
server.registerTool("image_page_audit", {
    description: "Fetches pages from YOUR OWN site and audits every image on them for the on-page factors that drive image-search performance: missing/empty/generic/duplicate alt text, non-descriptive filenames, missing width/height attributes, lazy loading on the LCP candidate, srcset coverage, file format and weight, intrinsic dimensions vs Google's ~250x200 indexing minimum, ImageObject and licensable schema, max-image-preview, inline background images, and the metadata inside the image files (camera EXIF and GPS that should be stripped, IPTC Creator/Copyright/Caption that should survive, XMP DigitalSourceType on AI-generated images). Feed it URLs straight from image_impressions_no_clicks or image_search_quick_wins to turn 'which pages fail' into 'why they fail'. Only fetches the URLs given; no third-party service involved. Returns a per-image findings table, page-level checks, and an ordered top_fixes list." + guardrails_js_1.GUARDRAIL_SUFFIX + guardrails_js_1.VISUAL_SUFFIX,
    inputSchema: {
        urls: zod_1.z.array(zod_1.z.string()).min(1).max(5).describe("Page URLs to audit (1-5, from your own site)"),
        fetch_metadata: zod_1.z.boolean().default(true).describe("Also read EXIF/IPTC/XMP metadata from the image files"),
        max_images_per_page: zod_1.z.number().default(12).describe("Maximum images fetched and weighed per page (HTML checks still cover all images)"),
        max_images_reported: zod_1.z.number().default(20).describe("Maximum per-image rows returned per page"),
    },
}, async ({ urls, fetch_metadata, max_images_per_page, max_images_reported }) => {
    const results = await (0, image_page_audit_js_1.imagePageAudit)(urls, fetch_metadata, max_images_per_page, max_images_reported);
    const wrapped = (0, guardrails_js_1.withMeta)(results, "image_page_audit", { urls, fetch_metadata, max_images_per_page, max_images_reported }, "Live fetch of the audited pages (the user's own site)", "All findings come from fetching and parsing the listed pages and image files at call time. Alt text, attributes, bytes, and dimensions are read values, not estimates. Base your analysis only on this data. An empty alt (alt=\"\") is correct for decorative images; do not report it as a defect.");
    return {
        content: [{ type: "text", text: JSON.stringify(wrapped, null, 2) }],
    };
});
async function main() {
    const cmd = process.argv[2];
    if (cmd === "setup") {
        const { runSetup } = await import("./setup.js");
        const code = await runSetup(process.argv.slice(3));
        process.exit(code);
    }
    if (cmd === "--version" || cmd === "-v") {
        console.log("2.5.1");
        process.exit(0);
    }
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
    console.error("GSC MCP server v2.5.1 running on stdio");
}
main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
