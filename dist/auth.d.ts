import { searchconsole_v1 } from "googleapis";
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
export declare function getSearchConsoleClient(): Promise<searchconsole_v1.Searchconsole>;
