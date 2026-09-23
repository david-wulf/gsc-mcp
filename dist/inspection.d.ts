export interface InspectionResult {
    indexed: boolean;
    indexingState: string;
    lastCrawlTime: string | null;
    crawlAllowed: boolean;
    robotsTxtState: string;
    indexingAllowed: boolean;
    pageFetchState: string;
    googleCanonical: string | null;
    userCanonical: string | null;
    canonicalMatch: boolean;
    mobileUsability: string;
    verdict: string;
    coverageState: string | null;
    indexingDirective: string | null;
    crawledAs: string | null;
    sitemaps: string[];
    referringUrls: string[];
    richResults: {
        verdict: string;
        types: {
            type: string;
            itemCount: number;
            issues: string[];
        }[];
    } | null;
    amp: {
        verdict: string | null;
        indexStatusVerdict: string | null;
        ampUrl: string | null;
    } | null;
    inspectionResultLink: string | null;
    issues: string[];
    raw: unknown;
}
export declare function inspectUrl(url: string): Promise<InspectionResult>;
