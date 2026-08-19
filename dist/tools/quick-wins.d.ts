import { SearchType, CtrSource } from "../analytics.js";
interface QuickWin {
    query: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
    opportunity: number;
    /** Woher die Ziel-CTR kam: aus der eigenen Kurve oder aus der Studientabelle. */
    targetCtrSource: CtrSource;
}
export declare function quickWins(days?: number, minImpressions?: number, maxPosition?: number, searchType?: SearchType, device?: string, country?: string): Promise<QuickWin[]>;
export {};
