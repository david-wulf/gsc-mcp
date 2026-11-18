import { indexing_v3 } from "googleapis";
interface SubmitResult {
    url: string;
    type: string;
    notifyTime: string | null;
    success: boolean;
    error: string | null;
    note: string;
    account?: string;
}
export declare function submitUrl(url: string, action?: "URL_UPDATED" | "URL_DELETED"): Promise<SubmitResult>;
export declare function submitBatch(urls: string[], action?: "URL_UPDATED" | "URL_DELETED"): Promise<{
    results: SubmitResult[];
    summary: {
        total: number;
        succeeded: number;
        failed: number;
        note: string;
    };
}>;
/**
 * Lesend: letzte Meldungen dieser URL an die Indexing API (urlNotifications.getMetadata).
 * Prueft zugleich Inhaberrecht und API-Freischaltung, ohne etwas einzureichen. 404 heisst:
 * die URL wurde noch nie gemeldet - kein Fehler.
 */
export declare function indexingStatus(url: string): Promise<{
    notified: boolean;
    latestUpdate: indexing_v3.Schema$UrlNotification | null;
    latestRemove: indexing_v3.Schema$UrlNotification | null;
    note: string;
    account?: string | undefined;
    url: string;
}>;
export {};
