interface PeriodTotals {
    clicks: number;
    impressions: number;
    ctr: number;
}
interface DiscoverPage {
    page: string;
    clicks: number;
    impressions: number;
    ctr: number;
}
interface DiscoverAnalysisResult {
    surface: "discover";
    period: {
        startDate: string;
        endDate: string;
    };
    totals: PeriodTotals;
    change: {
        clicksPercent: number;
        impressionsPercent: number;
    };
    topPages: DiscoverPage[];
    byCountry: Array<{
        country: string;
        clicks: number;
        impressions: number;
        ctr: number;
    }>;
    dailyTrend: Array<{
        date: string;
        clicks: number;
        impressions: number;
    }>;
    note: string;
}
/**
 * Isolated Google Discover performance. Discover is NOT query-based, so the API
 * only supports page / country / date dimensions here. Position/CTR-vs-position
 * benchmarks from web tools do not apply.
 */
export declare function discoverAnalysis(days?: number, rowLimit?: number): Promise<DiscoverAnalysisResult>;
export {};
