import { searchconsole_v1 } from "googleapis";
/**
 * Mehrere Service-Accounts in einer Instanz.
 *
 * Quellen: GSC_SERVICE_ACCOUNT_JSON und jede Variable GSC_SERVICE_ACCOUNT_JSON_<NAME>
 * (kompletter Schluessel als Zeichenkette), ersatzweise GSC_KEY_FILE. Die Reihenfolge
 * ist die Vorzugsreihenfolge: GSC_ACCOUNT_ORDER (Komma-Liste aus client_email oder
 * deren Teil vor dem "@") zieht genannte Accounts nach vorn, der Rest folgt in der
 * Reihenfolge GSC_SERVICE_ACCOUNT_JSON, dann die Varianten alphabetisch.
 *
 * Je Aufruf nimmt der Server den bevorzugten Account, der die Property in sites.list
 * fuehrt, und wiederholt den Aufruf mit dem naechsten, wenn Google mit 403 ablehnt.
 * Nach aussen gehen nur client_email und Variablenname, nie Schluesseldaten.
 */
export interface GscAccount {
    /** client_email aus dem Schluessel */
    email: string;
    /** Herkunft: Name der Umgebungsvariable oder "GSC_KEY_FILE" */
    source: string;
    credentials: Record<string, unknown>;
}
export declare function parseServiceAccountJson(raw: string): Record<string, unknown>;
/** Namen der Variablen mit Inline-Schluessel, in Grundreihenfolge. */
export declare function inlineAccountVars(env?: NodeJS.ProcessEnv): string[];
export declare function hasServiceAccountSource(env?: NodeJS.ProcessEnv): boolean;
/** Liest alle konfigurierten Accounts. Wirft nur, wenn ein Schluessel kaputt ist. */
export declare function loadServiceAccounts(env?: NodeJS.ProcessEnv): GscAccount[];
export declare function getServiceAccounts(): GscAccount[];
type ScopeProvider = () => string[];
/** auth.ts setzt hier die Scopes der Instanz (vermeidet einen Import-Zyklus). */
export declare function setScopeProvider(fn: ScopeProvider): void;
export declare function clientFor(account: GscAccount): searchconsole_v1.Searchconsole;
export declare function withAccount<T>(account: GscAccount, fn: () => T): T;
export declare function currentAccount(): GscAccount | undefined;
export interface SiteEntry {
    siteUrl: string;
    permissionLevel: string | null;
}
type SiteLister = (account: GscAccount) => Promise<SiteEntry[]>;
export declare function sitesOf(account: GscAccount, fresh?: boolean): Promise<SiteEntry[]>;
/**
 * Accounts fuer eine Property in Versuchsreihenfolge: zuerst die, deren sites.list die
 * Property fuehrt (in Vorzugsreihenfolge), danach die uebrigen. Kann ein Account seine
 * Liste nicht abrufen, steht er bei den uebrigen - der eigentliche Aufruf entscheidet.
 */
export declare function accountsFor(siteUrl: string | undefined): Promise<GscAccount[]>;
/** Google lehnt ab, weil dieser Account keine Rechte an der Property hat. */
export declare function isPermissionError(err: unknown): boolean;
/** Alle Accounts wurden versucht; der Wrapper wiederholt dann nicht noch einmal. */
export declare class AccountsExhaustedError extends Error {
    readonly tried: string[];
    readonly status = 403;
    readonly exhausted = true;
    constructor(siteUrl: string | undefined, attempts: Array<{
        email: string;
        error: unknown;
    }>);
}
/** Erste Zeile der Google-Meldung, gekuerzt. Enthaelt nie Schluesseldaten. */
export declare function shortReason(err: unknown): string;
/**
 * Fuehrt fn mit dem passenden Account aus. Lehnt Google mit 403 ab, folgt der naechste
 * Account; sind alle durch, kommt ein AccountsExhaustedError mit den versuchten
 * client_emails. Andere Fehler gehen unveraendert durch. Mit nur einem Account ist das
 * ein einfacher Aufruf.
 */
export declare function runWithAccountFallback<T>(siteUrl: string | undefined, fn: () => Promise<T>): Promise<T>;
/** Nur fuer Tests: sites.list ersetzen und Zwischenspeicher leeren. */
export declare const _testing: {
    setSiteLister(fn: SiteLister | null): void;
    setAccounts(accounts: GscAccount[] | null): void;
};
export {};
