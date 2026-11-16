import { SearchAnalyticsRow, SearchType, DataState, DateRange, FilterList } from "../analytics.js";
/**
 * Branded vs. non-branded split of a property (Search Analytics API update
 * 2026-11, dimension brandedClassification).
 *
 * Google classifies each query itself; this tool only reads that split. It
 * answers: how much of the search traffic comes from people who already know
 * the brand, how that share moves over time, and which queries sit on each
 * side. The property total is fetched separately, so the part no query row
 * explains (anonymized queries) stays visible instead of silently vanishing.
 */
export type BrandedGranularity = "none" | "day" | "week" | "month";
interface Metrics {
    clicks: number;
    impressions: number;
    /** Percent, two decimals. */
    ctr: number;
    /** Impression-weighted average position, one decimal. */
    position: number;
}
interface SplitTotals {
    property: Metrics;
    branded: Metrics & {
        clickShare: number;
        impressionShare: number;
    };
    nonBranded: Metrics & {
        clickShare: number;
        impressionShare: number;
    };
    /** Property total minus both classes: queries without a classification, mostly anonymized ones. */
    unclassified: {
        clicks: number;
        impressions: number;
    };
}
interface SeriesPoint {
    bucket: string;
    startDate: string;
    endDate: string;
    branded: Metrics;
    nonBranded: Metrics;
    /** Branded share of classified clicks in this bucket, percent. */
    brandedClickShare: number;
}
interface QueryRow {
    query: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
}
export interface BrandedAnalysisResult {
    period: DateRange;
    eligible: boolean;
    current: SplitTotals;
    previous: {
        period: DateRange;
        totals: SplitTotals;
    } | null;
    change: {
        brandedClicks: number;
        brandedClicksPercent: number | null;
        nonBrandedClicks: number;
        nonBrandedClicksPercent: number | null;
        brandedClickSharePoints: number;
    } | null;
    series: SeriesPoint[] | null;
    topQueries: {
        branded: QueryRow[];
        nonBranded: QueryRow[];
    } | null;
    scope: {
        searchType: SearchType;
        urlContains: string | null;
        filterLists: FilterList[];
        dataState: DataState;
    };
    notes: string[];
}
/** Bucket key for a YYYY-MM-DD date: the day, the ISO week's Monday, or the month. */
export declare function bucketOf(date: string, granularity: Exclude<BrandedGranularity, "none">): string;
/**
 * Builds the series from rows grouped by [date, brandedClassification].
 * Buckets are clipped to the window, so a partial first or last week/month
 * says so through its startDate/endDate.
 */
export declare function buildSeries(rows: SearchAnalyticsRow[], granularity: Exclude<BrandedGranularity, "none">): SeriesPoint[];
/** Combines the property total and the two classes into one totals block. */
export declare function splitTotals(propertyRows: SearchAnalyticsRow[], splitRows: SearchAnalyticsRow[]): SplitTotals;
export declare function brandedAnalysis(options?: {
    days?: number;
    startDate?: string;
    endDate?: string;
    comparePrevious?: boolean;
    granularity?: BrandedGranularity;
    topQueries?: number;
    urlContains?: string;
    searchType?: SearchType;
    devices?: string[];
    countries?: string[];
    dataState?: DataState;
}): Promise<BrandedAnalysisResult>;
export {};
