"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FetchBlockedError = void 0;
exports.isBlockedAddress = isBlockedAddress;
exports.assertPublicUrl = assertPublicUrl;
exports.safeFetch = safeFetch;
exports.readBodyLimited = readBodyLimited;
exports.propertyHostRule = propertyHostRule;
exports.hostMatchesProperties = hostMatchesProperties;
const promises_1 = require("node:dns/promises");
const node_net_1 = require("node:net");
/**
 * Outbound fetch guard for tools that download caller-supplied URLs.
 *
 * The server usually runs on the user's own machine, inside their home or
 * office network. A tool that fetches whatever URL an AI agent hands it can
 * therefore be steered (by a prompt-injected page, mail or document) into
 * reading the router admin page, a NAS or a cloud metadata endpoint, and the
 * response lands back in the chat. safeFetch refuses any URL whose host
 * resolves to a non-public address, follows redirects by hand so every hop is
 * checked, and caps how many bytes a response body may have.
 *
 * Residual gap: the address is checked before fetch() resolves the name
 * again, so a DNS-rebinding host could still answer differently the second
 * time. Closing that needs a custom connect lookup (undici dispatcher), which
 * would add a dependency.
 */
const blocked = new node_net_1.BlockList();
// IPv4: "this network", private, CGNAT (also Tailscale/NetBird), loopback,
// link-local (cloud metadata), IETF protocol assignments, benchmarking,
// documentation, multicast, reserved and broadcast.
for (const [net, prefix] of [
    ["0.0.0.0", 8],
    ["10.0.0.0", 8],
    ["100.64.0.0", 10],
    ["127.0.0.0", 8],
    ["169.254.0.0", 16],
    ["172.16.0.0", 12],
    ["192.0.0.0", 24],
    ["192.0.2.0", 24],
    ["192.168.0.0", 16],
    ["198.18.0.0", 15],
    ["198.51.100.0", 24],
    ["203.0.113.0", 24],
    ["224.0.0.0", 4],
    ["240.0.0.0", 4],
]) {
    blocked.addSubnet(net, prefix, "ipv4");
}
// IPv6: unspecified, loopback, unique-local, link-local, site-local
// (deprecated), multicast, documentation.
for (const [net, prefix] of [
    ["::", 128],
    ["::1", 128],
    ["fc00::", 7],
    ["fe80::", 10],
    ["fec0::", 10],
    ["ff00::", 8],
    ["2001:db8::", 32],
]) {
    blocked.addSubnet(net, prefix, "ipv6");
}
/** IPv4 address embedded in an IPv4-mapped (::ffff:a.b.c.d) or NAT64 (64:ff9b::a.b.c.d) IPv6 address. */
function embeddedIPv4(address) {
    const lower = address.toLowerCase();
    const dotted = lower.match(/^(?:::ffff:|64:ff9b::)(\d+\.\d+\.\d+\.\d+)$/);
    if (dotted)
        return dotted[1];
    const hex = lower.match(/^(?:::ffff:|64:ff9b::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (hex) {
        const hi = parseInt(hex[1], 16);
        const lo = parseInt(hex[2], 16);
        return `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
    }
    return null;
}
/** True when the address is not a public unicast address and must not be fetched. */
function isBlockedAddress(address) {
    const family = (0, node_net_1.isIP)(address);
    if (family === 4)
        return blocked.check(address, "ipv4");
    if (family === 6) {
        const v4 = embeddedIPv4(address);
        if (v4)
            return blocked.check(v4, "ipv4");
        return blocked.check(address, "ipv6");
    }
    return true; // not an IP at all: refuse rather than guess
}
class FetchBlockedError extends Error {
    constructor(message) {
        super(message);
        this.name = "FetchBlockedError";
    }
}
exports.FetchBlockedError = FetchBlockedError;
const defaultResolver = async (hostname) => (await (0, promises_1.lookup)(hostname, { all: true, verbatim: true })).map((a) => a.address);
/** Throws FetchBlockedError unless the URL is http(s) and every address its host resolves to is public. */
async function assertPublicUrl(rawUrl, resolve = defaultResolver) {
    let url;
    try {
        url = new URL(rawUrl);
    }
    catch {
        throw new FetchBlockedError(`Not a valid URL: ${rawUrl}`);
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new FetchBlockedError(`Only http and https URLs are fetched, not ${url.protocol}`);
    }
    // WHATWG URL keeps IPv6 literals in brackets.
    const host = url.hostname.replace(/^\[|\]$/g, "");
    let addresses;
    if ((0, node_net_1.isIP)(host)) {
        addresses = [host];
    }
    else {
        try {
            addresses = await resolve(host);
        }
        catch {
            throw new FetchBlockedError(`Could not resolve ${host}`);
        }
    }
    if (addresses.length === 0)
        throw new FetchBlockedError(`Could not resolve ${host}`);
    const bad = addresses.find(isBlockedAddress);
    if (bad) {
        throw new FetchBlockedError(`Refused to fetch ${url.host}: it resolves to ${bad}, a private, loopback or otherwise non-public address`);
    }
    return url;
}
/** fetch() with the address guard applied to the first URL and every redirect hop. */
async function safeFetch(rawUrl, options) {
    const fetchImpl = options.fetchImpl ?? fetch;
    const maxRedirects = options.maxRedirects ?? 5;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs);
    try {
        let current = rawUrl;
        for (let hop = 0;; hop++) {
            // The caller's host rule runs first, so a foreign host is refused
            // without even being looked up in DNS.
            if (options.checkUrl) {
                let parsed;
                try {
                    parsed = new URL(current);
                }
                catch {
                    throw new FetchBlockedError(`Not a valid URL: ${current}`);
                }
                await options.checkUrl(parsed);
            }
            const url = await assertPublicUrl(current, options.resolve);
            const response = await fetchImpl(url.href, {
                headers: options.headers,
                redirect: "manual",
                signal: controller.signal,
            });
            const location = response.headers.get("location");
            if (response.status >= 300 && response.status < 400 && location) {
                if (hop >= maxRedirects)
                    throw new FetchBlockedError(`More than ${maxRedirects} redirects`);
                await response.body?.cancel();
                current = new URL(location, url).href;
                continue;
            }
            return { response, url: url.href };
        }
    }
    finally {
        clearTimeout(timer);
    }
}
/** Reads a response body, aborting as soon as it exceeds maxBytes. Returns null when it does. */
async function readBodyLimited(response, maxBytes) {
    const declared = Number(response.headers.get("content-length") ?? "0");
    if (declared > maxBytes) {
        await response.body?.cancel();
        return null;
    }
    if (!response.body)
        return Buffer.alloc(0);
    const reader = response.body.getReader();
    const chunks = [];
    let total = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done)
            break;
        total += value.byteLength;
        if (total > maxBytes) {
            await reader.cancel();
            return null;
        }
        chunks.push(value);
    }
    return Buffer.concat(chunks);
}
/**
 * Host part of a Search Console property: "sc-domain:example.com" covers the
 * domain and all subdomains, a URL-prefix property ("https://www.example.com/")
 * covers exactly that host.
 */
function propertyHostRule(siteUrl) {
    if (siteUrl.startsWith("sc-domain:")) {
        const host = siteUrl.slice("sc-domain:".length).trim().toLowerCase().replace(/\.$/, "");
        return host ? { host, subdomains: true } : null;
    }
    try {
        return { host: new URL(siteUrl).hostname.toLowerCase(), subdomains: false };
    }
    catch {
        return null;
    }
}
/** True when hostname belongs to one of the given Search Console properties. */
function hostMatchesProperties(hostname, siteUrls) {
    const host = hostname.toLowerCase().replace(/\.$/, "");
    return siteUrls.some((siteUrl) => {
        const rule = propertyHostRule(siteUrl);
        if (!rule)
            return false;
        return host === rule.host || (rule.subdomains && host.endsWith(`.${rule.host}`));
    });
}
