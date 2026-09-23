import { InspectionResult } from "../inspection.js";
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
export declare function inspectUrlTool(url: string, includeRaw?: boolean): Promise<InspectionSummary>;
export {};
