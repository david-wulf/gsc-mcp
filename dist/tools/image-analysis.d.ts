interface PeriodTotals {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
}
interface ImageAnalysisResult {
    surface: "image";
    period: {
        startDate: string;
        endDate: string;
    };
    totals: PeriodTotals;
    change: {
        clicksPercent: number;
        impressionsPercent: number;
        position: number;
    };
    topQueries: Array<{
        query: string;
        clicks: number;
        impressions: number;
        ctr: number;
        position: number;
    }>;
    topPages: Array<{
        page: string;
        clicks: number;
        impressions: number;
        ctr: number;
        position: number;
    }>;
    note: string;
}
/**
 * Isolated Google Image search performance. Image search supports the same
 * dimensions as web (query, page, country, device, date).
 */
export declare function imageAnalysis(days?: number, rowLimit?: number): Promise<ImageAnalysisResult>;
export {};
