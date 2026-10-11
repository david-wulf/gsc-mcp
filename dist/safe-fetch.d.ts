/** True when the address is not a public unicast address and must not be fetched. */
export declare function isBlockedAddress(address: string): boolean;
export declare class FetchBlockedError extends Error {
    constructor(message: string);
}
export type Resolver = (hostname: string) => Promise<string[]>;
/** Throws FetchBlockedError unless the URL is http(s) and every address its host resolves to is public. */
export declare function assertPublicUrl(rawUrl: string, resolve?: Resolver): Promise<URL>;
export interface SafeFetchOptions {
    timeoutMs: number;
    headers?: Record<string, string>;
    maxRedirects?: number;
    /** Extra per-hop check (e.g. "host belongs to a verified property"); throw to refuse. */
    checkUrl?: (url: URL) => void | Promise<void>;
    resolve?: Resolver;
    fetchImpl?: typeof fetch;
}
export interface SafeFetchResult {
    response: Response;
    /** URL of the final hop after redirects. */
    url: string;
}
/** fetch() with the address guard applied to the first URL and every redirect hop. */
export declare function safeFetch(rawUrl: string, options: SafeFetchOptions): Promise<SafeFetchResult>;
/** Reads a response body, aborting as soon as it exceeds maxBytes. Returns null when it does. */
export declare function readBodyLimited(response: Response, maxBytes: number): Promise<Buffer | null>;
/**
 * Host part of a Search Console property: "sc-domain:example.com" covers the
 * domain and all subdomains, a URL-prefix property ("https://www.example.com/")
 * covers exactly that host.
 */
export declare function propertyHostRule(siteUrl: string): {
    host: string;
    subdomains: boolean;
} | null;
/** True when hostname belongs to one of the given Search Console properties. */
export declare function hostMatchesProperties(hostname: string, siteUrls: string[]): boolean;
