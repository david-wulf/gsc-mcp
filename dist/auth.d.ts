import { searchconsole_v1 } from "googleapis";
import { type SiteEntry } from "./accounts.js";
export type AuthMode = "service_account" | "oauth";
export declare function getAuthMode(): AuthMode;
export declare function withSiteUrl<T>(siteUrl: string | undefined, fn: () => T): T;
/** Property dieses Aufrufs, ohne zu werfen (fuer Metadaten). */
export declare function currentSiteUrl(): string | undefined;
export declare function getConfig(): {
    keyFile: string | undefined;
    inlineJson: string | undefined;
    siteUrl: string;
    siteUrls: string[];
};
/**
 * Client fuer den laufenden Aufruf. Im Service-Account-Modus der Account aus dem
 * Aufruf-Kontext (runForProperty setzt ihn, mit 403-Fallback); ohne Kontext der
 * bevorzugte Account, der die aktuelle Property in sites.list fuehrt.
 */
export declare function getSearchConsoleClient(): Promise<searchconsole_v1.Searchconsole>;
/**
 * Fuehrt einen Aufruf gegen eine Property aus und wechselt bei 403 den Service-Account.
 * Im OAuth-Modus gibt es nur die eine Anmeldung, dann ist das ein einfacher Aufruf.
 */
export declare function runForProperty<T>(siteUrl: string | undefined, fn: () => Promise<T>): Promise<T>;
export interface AccountProperties {
    account: string;
    source: string;
    /** 1 = bevorzugt */
    preference: number;
    properties: SiteEntry[];
    error: string | null;
}
/** Je Account die Properties aus sites.list (frisch abgerufen). Nur client_email, nie Schluessel. */
export declare function listPropertiesPerAccount(): Promise<AccountProperties[]>;
/** Alle Properties, die irgendein konfigurierter Account sieht (zwischengespeichert). */
export declare function allAccessibleSiteUrls(): Promise<string[]>;
