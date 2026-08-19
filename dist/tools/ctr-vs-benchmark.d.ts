import { SearchType, CtrSource } from "../analytics.js";
interface CtrBenchmarkResult {
    page: string;
    clicks: number;
    impressions: number;
    actualCtr: number;
    position: number;
    benchmarkCtr: number;
    /** Woher der Vergleichswert kam: aus der eigenen Kurve oder aus der Studientabelle. */
    benchmarkSource: CtrSource;
    gap: number;
    verdict: string;
}
export declare function ctrVsBenchmark(days?: number, minImpressions?: number, searchType?: SearchType): Promise<CtrBenchmarkResult[]>;
export {};
