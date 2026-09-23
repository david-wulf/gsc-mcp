"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inspectUrlTool = inspectUrlTool;
const inspection_js_1 = require("../inspection.js");
async function inspectUrlTool(url, includeRaw = false) {
    const result = await (0, inspection_js_1.inspectUrl)(url);
    let summary;
    if (result.indexed && result.issues.length === 0) {
        summary = `This URL is indexed and healthy.${result.lastCrawlTime ? ` Last crawled: ${result.lastCrawlTime}.` : ""}`;
    }
    else if (result.indexed && result.issues.length > 0) {
        summary = `This URL is indexed but has ${result.issues.length} issue(s): ${result.issues.join("; ")}.`;
    }
    else {
        summary = `This URL is NOT indexed. State: ${result.indexingState}. Issues: ${result.issues.length > 0 ? result.issues.join("; ") : "No specific issues detected, but the page is not in the index."}`;
    }
    return {
        url,
        indexed: result.indexed,
        indexingState: result.indexingState,
        lastCrawlTime: result.lastCrawlTime,
        crawlAllowed: result.crawlAllowed,
        indexingAllowed: result.indexingAllowed,
        pageFetchState: result.pageFetchState,
        googleCanonical: result.googleCanonical,
        userCanonical: result.userCanonical,
        canonicalMatch: result.canonicalMatch,
        mobileUsability: result.mobileUsability,
        verdict: result.verdict,
        coverageState: result.coverageState,
        indexingDirective: result.indexingDirective,
        robotsTxtState: result.robotsTxtState,
        crawledAs: result.crawledAs,
        sitemaps: result.sitemaps,
        referringUrls: result.referringUrls,
        richResults: result.richResults,
        amp: result.amp,
        inspectionResultLink: result.inspectionResultLink,
        issues: result.issues,
        summary,
        ...(includeRaw ? { raw: result.raw } : {}),
    };
}
