/**
 * GSC search types. The API defaults to "web" when type is omitted, which is
 * why every legacy tool only ever sees web data. Set this explicitly to query
 * Discover, Image, Video or News surfaces in isolation.
 */
export type SearchType = "web" | "image" | "video" | "news" | "discover" | "googleNews";
/**
 * Dimensions the API actually allows per surface. Used for a friendly guard so
 * an invalid combination fails with a clear message instead of an opaque 400.
 * (searchAppearance is special: it must be the ONLY grouping dimension.)
 */
export declare const ALLOWED_DIMENSIONS: Record<SearchType, string[]>;
export interface SearchAnalyticsRow {
    keys: string[];
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
}
export interface QueryParams {
    startDate: string;
    endDate: string;
    dimensions: string[];
    /** Surface to query. Omit for "web" (the API default). */
    searchType?: SearchType;
    dimensionFilterGroups?: Array<{
        filters: Array<{
            dimension: string;
            operator: string;
            expression: string;
        }>;
    }>;
    rowLimit?: number;
    /** Hard cap on rows fetched across all pages. Omit for no cap. */
    maxRows?: number;
}
/**
 * Validates that the requested dimensions are legal for the chosen surface.
 * Throws a descriptive error instead of letting the API return a generic 400.
 */
export declare function assertValidDimensions(searchType: SearchType, dimensions: string[]): void;
/**
 * CTR-Erwartung pro Position.
 *
 * Die Studientabelle unten stammt aus einer branchenweiten Auswertung fremder
 * Seiten. Sie ist nur der Rueckfall: gemessen an einer Content-Property liegt die
 * echte CTR auf Position 1 bei 3,5 % gegen die 28,5 % der Tabelle - Faktor 8. Wer
 * dagegen bewertet, stempelt fast jede Seite als unterdurchschnittlich und sagt
 * damit etwas ueber die Studie, nicht ueber die Seite.
 *
 * Deshalb bauen die Tools ihre Kurve aus den Zeilen, die sie ohnehin schon geholt
 * haben, und greifen nur dann auf die Tabelle zurueck, wenn ein Rang zu wenig
 * Volumen fuer eine belastbare Messung hat.
 */
export declare const STUDY_CTR_BY_POSITION: number[];
export declare function studyCtrAt(position: number): number;
export type CtrSource = "measured" | "study";
export interface ClickCurve {
    /** Rang -> gemessene CTR als Anteil (0-1). */
    byRank: Map<number, number>;
    /** Woraus die Kurve gebaut wurde, damit das Ergebnis einordbar bleibt. */
    basis: string;
    ranksMeasured: number;
    impressionsConsidered: number;
}
/**
 * Baut die CTR-pro-Rang-Kurve aus bereits geholten Zeilen.
 *
 * CTR je Rang ist Summe der Klicks durch Summe der Impressionen, nie ein Mittel
 * aus Verhaeltnissen - sonst zaehlt eine Zeile mit drei Impressionen so viel wie
 * eine mit dreissigtausend. Auf ungefilterten Zeilen aufrufen: baut man die Kurve
 * erst nach einem Impressionsfilter, ist sie nach oben verzerrt.
 */
export declare function buildClickCurve(rows: SearchAnalyticsRow[], basis: string, minImpressionsPerRank?: number): ClickCurve;
/** Gemessene CTR fuer diesen Rang, sonst die Studientabelle. */
export declare function expectedCtr(position: number, curve?: ClickCurve): {
    ctr: number;
    source: CtrSource;
};
/** Devices as the API spells them in dimension filters. */
export declare const DEVICES: readonly ["MOBILE", "DESKTOP", "TABLET"];
export type Device = (typeof DEVICES)[number];
/**
 * Dimension filters for device and country.
 *
 * Both are optional, and unset means unfiltered - every tool keeps returning
 * all devices and all countries unless asked otherwise.
 *
 * Discover has no device dimension (see ALLOWED_DIMENSIONS), so filtering by
 * device there is impossible rather than merely empty. That fails loudly.
 */
export declare function deviceCountryFilters(device?: string, country?: string, searchType?: SearchType): Array<{
    dimension: string;
    operator: string;
    expression: string;
}>;
export declare function getDateRange(days: number): {
    startDate: string;
    endDate: string;
};
export declare function getPriorDateRange(days: number): {
    startDate: string;
    endDate: string;
};
/**
 * Fetches all rows from the Search Analytics API with automatic pagination.
 * Uses dataState: 'all' so data matches the GSC dashboard exactly.
 */
export declare function fetchAllRows(params: QueryParams, siteUrlOverride?: string): Promise<SearchAnalyticsRow[]>;
