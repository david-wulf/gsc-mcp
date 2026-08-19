import { SearchType, CtrSource } from "../analytics.js";
interface CtrOpportunity {
    page: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
    expectedCtr: number;
    ctrGap: number;
    potentialExtraClicks: number;
    /** Woher die Erwartung kam: aus der eigenen Kurve oder aus der Studientabelle. */
    expectedCtrSource: CtrSource;
}
export declare function ctrOpportunities(days?: number, minImpressions?: number, searchType?: SearchType, device?: string, country?: string): Promise<CtrOpportunity[]>;
export {};
