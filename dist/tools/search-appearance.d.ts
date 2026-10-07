import { SearchType } from "../analytics.js";
interface AppearanceRow {
    appearance: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
}
interface DrillRow {
    key: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
}
interface SearchAppearanceResult {
    surface: SearchType;
    mode: "breakdown" | "drilldown";
    period: {
        startDate: string;
        endDate: string;
    };
    appearanceBreakdown: AppearanceRow[];
    drilldown?: {
        appearance: string;
        dimension: "page" | "query";
        rows: DrillRow[];
    };
    note: string;
}
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
export declare function searchAppearance(days?: number, appearance?: string, drillDimension?: "page" | "query", searchType?: SearchType, rowLimit?: number): Promise<SearchAppearanceResult>;
export {};
