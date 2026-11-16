/**
 * GSC search types. The API defaults to "web" when type is omitted, which is
 * why every legacy tool only ever sees web data. Set this explicitly to query
 * Discover, Image, Video or News surfaces in isolation.
 */
export type SearchType = "web" | "image" | "video" | "news" | "discover" | "googleNews" | "webMultimodal";
/**
 * Dimensions the API actually allows per surface. Used for a friendly guard so
 * an invalid combination fails with a clear message instead of an opaque 400.
 * (searchAppearance is special: it must be the ONLY grouping dimension.)
 *
 * webMultimodal (API update 2026-11): Google Lens, Circle to Search and image
 * uploads in Search. brandedClassification (same update) splits query-based
 * surfaces into BRANDED / NON_BRANDED; Discover and Google News carry no
 * queries, so they have no brand split either.
 */
export declare const ALLOWED_DIMENSIONS: Record<SearchType, string[]>;
/**
 * Branded / non-branded classification (Search Analytics API update, 2026-11).
 * Google classifies each query itself; the values are BRANDED and NON_BRANDED.
 * Data exists from this day on, and only for eligible properties (top-level
 * properties with enough query volume). Other properties get no rows at all —
 * an empty answer there means "not classified", never "no brand traffic".
 */
export declare const BRANDED_DATA_START = "2026-02-21";
export declare const BRANDED_VALUES: readonly ["BRANDED", "NON_BRANDED"];
export type BrandedValue = (typeof BRANDED_VALUES)[number];
export type BrandedChoice = "branded" | "non_branded";
export declare const BRANDED_CAVEAT: string;
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
        /**
         * Exact-match lists (API update 2026-11): several countries or devices in
         * one request, e.g. DACH = [deu, aut, che]. Only country and device.
         */
        filterLists?: FilterList[];
    }>;
    rowLimit?: number;
    /** Hard cap on rows fetched across all pages. Omit for no cap. */
    maxRows?: number;
    /**
     * Upstream's spelling of the same surface filter. `searchType` above is this
     * fork's older name for it; fetchAllRows reads whichever is set, so upstream
     * tools (the image suite, genai) merge without touching their call sites.
     */
    type?: SearchType;
    /**
     * "all" (default) includes fresh, not yet finalised days and matches the GSC
     * dashboard; "final" returns finalised data only.
     */
    dataState?: DataState;
}
export type DataState = "final" | "all";
export interface DimensionFilter {
    dimension: string;
    operator: string;
    expression: string;
}
export interface FilterList {
    dimension: "country" | "device";
    expressions: string[];
}
/** Filter for one side of the brand split; undefined means both sides. */
export declare function brandedFilter(branded?: BrandedChoice): DimensionFilter[];
/**
 * Normalises and checks filters before they reach the API, so the rules of the
 * 2026-11 update fail with a clear message instead of an opaque 400:
 * - brandedClassification takes only `equals` with BRANDED or NON_BRANDED,
 * - it cannot be combined with a query filter in the same request,
 * - the same dimension may not appear in both filters and filterLists.
 * Returns the filters with brandedClassification values upper-cased.
 */
export declare function normaliseFilters(filters: DimensionFilter[], filterLists?: FilterList[], searchType?: SearchType): DimensionFilter[];
/**
 * Builds filterLists for several devices and/or countries (API update
 * 2026-11). A single value works too; it is the same as an equals filter.
 */
export declare function deviceCountryLists(devices?: string[], countries?: string[], searchType?: SearchType): FilterList[];
/** Note for a response whose window starts before brand data exists. */
export declare function brandedWindowNote(startDate: string): string | null;
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
export interface DateRange {
    startDate: string;
    endDate: string;
    /** Inclusive length of the range in days. */
    days: number;
}
/**
 * Resolves the reporting window of a tool call. An explicit start_date/end_date
 * pair (YYYY-MM-DD, both inclusive) wins over `days`, so a calendar month can be
 * queried exactly; without it the window is the last `days` days ending
 * yesterday, as before. Both dates must be given together.
 */
export declare function resolveDateRange(days: number, startDate?: string, endDate?: string): DateRange;
/** The range of the same length that ends the day before `range` starts. */
export declare function precedingDateRange(range: DateRange): DateRange;
export declare function getPriorDateRange(days: number): {
    startDate: string;
    endDate: string;
};
/**
 * Fetches all rows from the Search Analytics API with automatic pagination.
 * Uses dataState: 'all' so data matches the GSC dashboard exactly.
 */
export declare function fetchAllRows(params: QueryParams): Promise<SearchAnalyticsRow[]>;
