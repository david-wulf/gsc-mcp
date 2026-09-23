import { inspectUrl, InspectionResult } from "../inspection.js";

interface InspectionSummary {
  url: string;
  indexed: boolean;
  indexingState: string;
  lastCrawlTime: string | null;
  crawlAllowed: boolean;
  indexingAllowed: boolean;
  pageFetchState: string;
  googleCanonical: string | null;
  userCanonical: string | null;
  canonicalMatch: boolean;
  mobileUsability: string;
  verdict: string;
  coverageState: string | null;
  indexingDirective: string | null;
  robotsTxtState: string;
  crawledAs: string | null;
  sitemaps: string[];
  referringUrls: string[];
  richResults: InspectionResult["richResults"];
  amp: InspectionResult["amp"];
  inspectionResultLink: string | null;
  issues: string[];
  summary: string;
  raw?: unknown;
}

export async function inspectUrlTool(url: string, includeRaw = false): Promise<InspectionSummary> {
  const result = await inspectUrl(url);

  let summary: string;

  if (result.indexed && result.issues.length === 0) {
    summary = `This URL is indexed and healthy.${
      result.lastCrawlTime ? ` Last crawled: ${result.lastCrawlTime}.` : ""
    }`;
  } else if (result.indexed && result.issues.length > 0) {
    summary = `This URL is indexed but has ${result.issues.length} issue(s): ${result.issues.join("; ")}.`;
  } else {
    summary = `This URL is NOT indexed. State: ${result.indexingState}. Issues: ${
      result.issues.length > 0 ? result.issues.join("; ") : "No specific issues detected, but the page is not in the index."
    }`;
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
