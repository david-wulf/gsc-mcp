// Offline tests for several service accounts in one instance: account order,
// choice by sites.list and the 403 fallback. No key leaves the process and no
// request reaches Google (sites.list is replaced). Run with `npm test`.
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";

import {
  loadServiceAccounts,
  inlineAccountVars,
  accountsFor,
  runWithAccountFallback,
  isPermissionError,
  currentAccount,
  AccountsExhaustedError,
  accountsForUrl,
  runForUrl,
  _testing,
} from "../dist/accounts.js";

const key = (email) => JSON.stringify({ type: "service_account", client_email: email, private_key: "dummy" });
const NEW = "david-wulf-mcp@conductive-set-378119.iam.gserviceaccount.com";
const OLD = "david-gsc-mcp@searchconsole-mcp.iam.gserviceaccount.com";
const acc = (email) => ({ email, source: "test", credentials: {} });
const forbidden = (msg = "User does not have sufficient permission for site 'x'.") =>
  Object.assign(new Error(msg), { code: 403 });

afterEach(() => {
  _testing.setAccounts(null);
  _testing.setSiteLister(null);
});

test("inlineAccountVars: base variable first, then the named ones", () => {
  const env = {
    GSC_SERVICE_ACCOUNT_JSON_ZWEI: "x",
    GSC_SERVICE_ACCOUNT_JSON: "x",
    GSC_SERVICE_ACCOUNT_JSON_DAVID_WULF_MCP: "x",
    GSC_SERVICE_ACCOUNT_JSON_LEER: "  ",
    GSC_SERVICE_ACCOUNT_JSONX: "x",
  };
  assert.deepEqual(inlineAccountVars(env), [
    "GSC_SERVICE_ACCOUNT_JSON",
    "GSC_SERVICE_ACCOUNT_JSON_DAVID_WULF_MCP",
    "GSC_SERVICE_ACCOUNT_JSON_ZWEI",
  ]);
});

test("loadServiceAccounts: GSC_ACCOUNT_ORDER puts the named account first", () => {
  const env = {
    GSC_SERVICE_ACCOUNT_JSON: key(OLD),
    GSC_SERVICE_ACCOUNT_JSON_DAVID_WULF_MCP: key(NEW),
    GSC_ACCOUNT_ORDER: "david-wulf-mcp, david-gsc-mcp",
  };
  const accounts = loadServiceAccounts(env);
  assert.deepEqual(accounts.map((a) => a.email), [NEW, OLD]);
  assert.equal(accounts[0].source, "GSC_SERVICE_ACCOUNT_JSON_DAVID_WULF_MCP");
  // without an order: variable order
  assert.deepEqual(loadServiceAccounts({ ...env, GSC_ACCOUNT_ORDER: "" }).map((a) => a.email), [OLD, NEW]);
});

test("loadServiceAccounts: duplicate keys count once, broken JSON names the variable only", () => {
  const env = { GSC_SERVICE_ACCOUNT_JSON: key(OLD), GSC_SERVICE_ACCOUNT_JSON_B: key(OLD) };
  assert.equal(loadServiceAccounts(env).length, 1);
  assert.throws(
    () => loadServiceAccounts({ GSC_SERVICE_ACCOUNT_JSON_B: "{geheim" }),
    (err) => err.message.includes("GSC_SERVICE_ACCOUNT_JSON_B") && !err.message.includes("geheim")
  );
});

test("loadServiceAccounts: single-line key with real line breaks still parses", () => {
  const raw = JSON.stringify({ client_email: OLD, private_key: "a\\nb" }).replace("\\n", "\n");
  assert.equal(loadServiceAccounts({ GSC_SERVICE_ACCOUNT_JSON: raw })[0].email, OLD);
});

test("isPermissionError: 403 and the Google wording, not other errors", () => {
  assert.equal(isPermissionError(forbidden()), true);
  assert.equal(isPermissionError(new Error("You do not own this site, or the inspected URL is not part of this property.")), true);
  assert.equal(isPermissionError(Object.assign(new Error("x"), { response: { status: 403 } })), true);
  assert.equal(isPermissionError(Object.assign(new Error("Quota"), { code: 429 })), false);
  assert.equal(isPermissionError(new Error("socket hang up")), false);
  assert.equal(isPermissionError(Object.assign(forbidden(), { exhausted: true })), false);
});

test("accountsFor: the preferred account that lists the property comes first", async () => {
  _testing.setAccounts([acc(NEW), acc(OLD)]);
  _testing.setSiteLister(async (a) =>
    a.email === NEW
      ? [{ siteUrl: "sc-domain:davidwulf.de", permissionLevel: "siteOwner" }]
      : [{ siteUrl: "sc-domain:homeandsmart.de", permissionLevel: "siteFullUser" }]
  );
  assert.deepEqual((await accountsFor("sc-domain:davidwulf.de")).map((a) => a.email), [NEW, OLD]);
  assert.deepEqual((await accountsFor("sc-domain:homeandsmart.de")).map((a) => a.email), [OLD, NEW]);
  // unknown to both: preference order
  assert.deepEqual((await accountsFor("sc-domain:example.com")).map((a) => a.email), [NEW, OLD]);
});

test("accountsFor: an account whose sites.list fails is tried last", async () => {
  _testing.setAccounts([acc(NEW), acc(OLD)]);
  _testing.setSiteLister(async (a) => {
    if (a.email === NEW) throw forbidden("Search Console API has not been used in project");
    return [{ siteUrl: "sc-domain:x.de", permissionLevel: "siteOwner" }];
  });
  assert.deepEqual((await accountsFor("sc-domain:x.de")).map((a) => a.email), [OLD, NEW]);
});

test("runWithAccountFallback: 403 on the first account retries with the next", async () => {
  _testing.setAccounts([acc(NEW), acc(OLD)]);
  _testing.setSiteLister(async () => []);
  const seen = [];
  const result = await runWithAccountFallback("sc-domain:homeandsmart.de", async () => {
    seen.push(currentAccount().email);
    if (currentAccount().email === NEW) throw forbidden();
    return "daten";
  });
  assert.equal(result, "daten");
  assert.deepEqual(seen, [NEW, OLD]);
});

test("runWithAccountFallback: all refuse -> error names every account, no retry outside", async () => {
  _testing.setAccounts([acc(NEW), acc(OLD)]);
  _testing.setSiteLister(async () => []);
  await assert.rejects(
    runWithAccountFallback("sc-domain:fremd.de", async () => { throw forbidden(); }),
    (err) => {
      assert.ok(err instanceof AccountsExhaustedError);
      assert.ok(err.message.includes(NEW) && err.message.includes(OLD));
      assert.ok(err.message.includes("sc-domain:fremd.de"));
      assert.equal(isPermissionError(err), false);
      return true;
    }
  );
});

test("runWithAccountFallback: other errors are not retried", async () => {
  _testing.setAccounts([acc(NEW), acc(OLD)]);
  _testing.setSiteLister(async () => []);
  let calls = 0;
  await assert.rejects(
    runWithAccountFallback("sc-domain:x.de", async () => { calls++; throw new Error("socket hang up"); }),
    /socket hang up/
  );
  assert.equal(calls, 1);
});

test("runWithAccountFallback: nested fallback (sitemap variants) does not multiply calls", async () => {
  _testing.setAccounts([acc(NEW), acc(OLD)]);
  _testing.setSiteLister(async () => []);
  let calls = 0;
  await assert.rejects(
    runWithAccountFallback("sc-domain:x.de", () =>
      runWithAccountFallback("sc-domain:x.de", async () => { calls++; throw forbidden(); })
    )
  );
  assert.equal(calls, 2);
});

test("accountsForUrl: owner of a covering property first, then other access, then the rest", async () => {
  const third = "dritter@x.iam.gserviceaccount.com";
  _testing.setAccounts([acc(third), acc(OLD), acc(NEW)]);
  _testing.setSiteLister(async (a) => {
    if (a.email === NEW) return [{ siteUrl: "sc-domain:davidwulf.de", permissionLevel: "siteOwner" }];
    if (a.email === OLD) return [{ siteUrl: "sc-domain:davidwulf.de", permissionLevel: "siteFullUser" }];
    return [{ siteUrl: "sc-domain:example.com", permissionLevel: "siteOwner" }];
  });
  assert.deepEqual(
    (await accountsForUrl("https://www.davidwulf.de/kontakt/")).map((a) => a.email),
    [NEW, OLD, third]
  );
  // not a URL: preference order unchanged
  assert.deepEqual((await accountsForUrl("kein url")).map((a) => a.email), [third, OLD, NEW]);
});

test("runForUrl: falls back on 403 and names the owner requirement when all refuse", async () => {
  _testing.setAccounts([acc(NEW), acc(OLD)]);
  _testing.setSiteLister(async () => []);
  const seen = [];
  await assert.rejects(
    runForUrl("https://davidwulf.de/", async () => {
      seen.push(currentAccount().email);
      throw forbidden("Permission denied. Failed to verify the URL ownership.");
    }),
    (err) => err.message.includes("Owner") && err.message.includes(NEW) && err.message.includes(OLD)
  );
  assert.deepEqual(seen, [NEW, OLD]);
});
