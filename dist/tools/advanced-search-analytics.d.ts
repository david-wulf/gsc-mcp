import { SearchAnalyticsRow, SearchType, DataState } from "../analytics.js";
interface Filter {
    dimension: string;
    operator: string;
    expression: string;
}
/** Most rows a single call returns. Larger lists are read page by page with start_row. */
export declare const MAX_PAGE_SIZE = 500;
interface OutputRow {
    keys: string[];
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
}
interface AdvancedSearchResult {
    rows: OutputRow[];
    /** Rows the whole query matched, across all pages. */
    totalRows: number;
    /** Zero-based offset of the first returned row within totalRows. */
    startRow: number;
    returnedRows: number;
    hasMore: boolean;
    /** Pass this as start_row to get the next page; null on the last page. */
    nextStartRow: number | null;
    /** Set when row_limit was above MAX_PAGE_SIZE and got lowered. */
    rowLimitCapped: string | null;
    dimensions: string[];
    period: {
        startDate: string;
        endDate: string;
        days: number;
    };
    dataState: DataState;
    filtersApplied: Filter[];
    searchType: string;
}
export interface AdvancedSearchOptions {
    days?: number;
    startDate?: string;
    endDate?: string;
    dimensions?: string[];
    filters?: Filter[];
    rowLimit?: number;
    startRow?: number;
    orderBy?: string;
    orderDirection?: string;
    searchType?: SearchType;
    dataState?: DataState;
}
export interface Page {
    rows: SearchAnalyticsRow[];
    totalRows: number;
    startRow: number;
    hasMore: boolean;
    nextStartRow: number | null;
    rowLimit: number;
    rowLimitCapped: string | null;
}
/**
 * Sorts all rows and cuts out one page. The order is total — ties on the sort
 * metric fall back to the row keys — so consecutive start_row calls page
 * through one fixed list: no row appears twice, none goes missing.
 */
export declare function sortAndPage(rows: SearchAnalyticsRow[], orderBy?: string, orderDirection?: string, startRow?: number, rowLimit?: number): Page;
export declare function advancedSearchAnalytics(options?: AdvancedSearchOptions): Promise<AdvancedSearchResult>;
export {};
