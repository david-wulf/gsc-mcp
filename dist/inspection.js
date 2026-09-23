"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inspectUrl = inspectUrl;
const auth_js_1 = require("./auth.js");
async function inspectUrl(url) {
    const client = await (0, auth_js_1.getSearchConsoleClient)();
    const { siteUrl } = (0, auth_js_1.getConfig)();
    const response = await client.urlInspection.index.inspect({
        requestBody: {
            inspectionUrl: url,
            siteUrl,
        },
    });
    const result = response.data.inspectionResult;
    const indexStatus = result?.indexStatusResult;
    const mobileResult = result?.mobileUsabilityResult;
    const richResult = result?.richResultsResult;
    const ampResult = result?.ampResult;
    const issues = [];
    if (indexStatus?.robotsTxtState === "DISALLOWED") {
        issues.push("Blocked by robots.txt");
    }
    if (indexStatus?.indexingState === "INDEXING_NOT_ALLOWED") {
        issues.push("Noindex tag detected");
    }
    if (indexStatus?.pageFetchState && indexStatus.pageFetchState !== "SUCCESSFUL") {
        issues.push(`Page fetch failed: ${indexStatus.pageFetchState}`);
    }
    const googleCanonical = indexStatus?.googleCanonical || null;
    const userCanonical = indexStatus?.userCanonical || null;
    if (googleCanonical && userCanonical && googleCanonical !== userCanonical) {
        issues.push(`Canonical mismatch: Google chose ${googleCanonical}, you declared ${userCanonical}`);
    }
    if (mobileResult?.verdict === "VERDICT_HAS_ISSUES") {
        const mobileIssues = mobileResult.issues || [];
        for (const issue of mobileIssues) {
            issues.push(`Mobile: ${issue.message || issue.issueType}`);
        }
    }
    const richTypes = (richResult?.detectedItems || []).map((d) => ({
        type: d.richResultType || "Unknown",
        itemCount: (d.items || []).length,
        issues: (d.items || []).flatMap((it) => (it.issues || []).map((is) => `${is.severity}: ${is.issueMessage}`)),
    }));
    for (const t of richTypes) {
        for (const is of t.issues) {
            if (is.startsWith("ERROR"))
                issues.push(`Rich result ${t.type}: ${is}`);
        }
    }
    return {
        indexed: indexStatus?.coverageState === "Submitted and indexed" ||
            indexStatus?.verdict === "PASS",
        indexingState: indexStatus?.coverageState || "Unknown",
        lastCrawlTime: indexStatus?.lastCrawlTime || null,
        crawlAllowed: indexStatus?.robotsTxtState !== "DISALLOWED",
        robotsTxtState: indexStatus?.robotsTxtState || "Unknown",
        indexingAllowed: indexStatus?.indexingState !== "INDEXING_NOT_ALLOWED",
        pageFetchState: indexStatus?.pageFetchState || "Unknown",
        googleCanonical,
        userCanonical,
        canonicalMatch: googleCanonical === userCanonical || (!googleCanonical && !userCanonical),
        mobileUsability: mobileResult?.verdict || "Unknown",
        verdict: indexStatus?.verdict || "Unknown",
        coverageState: indexStatus?.coverageState || null,
        indexingDirective: indexStatus?.indexingState || null,
        crawledAs: indexStatus?.crawledAs || null,
        sitemaps: indexStatus?.sitemap || [],
        referringUrls: indexStatus?.referringUrls || [],
        richResults: richResult ? { verdict: richResult.verdict || "Unknown", types: richTypes } : null,
        amp: ampResult
            ? {
                verdict: ampResult.verdict || null,
                indexStatusVerdict: ampResult.ampIndexStatusVerdict || null,
                ampUrl: ampResult.ampUrl || null,
            }
            : null,
        inspectionResultLink: result?.inspectionResultLink || null,
        issues,
        raw: result ?? null,
    };
}
