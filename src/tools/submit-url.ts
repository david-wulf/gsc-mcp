import { google, indexing_v3 } from "googleapis";
import { getAuthMode } from "../auth.js";
import { authenticateWithOAuth, getScopeTier } from "../oauth.js";
import { currentAccount, indexingClientFor, runForUrl } from "../accounts.js";

/**
 * Indexing API. Im Service-Account-Modus dieselbe Schluesselquelle wie die uebrigen
 * Werkzeuge (GSC_SERVICE_ACCOUNT_JSON, GSC_SERVICE_ACCOUNT_JSON_<NAME>, ersatzweise
 * GSC_KEY_FILE) und dieselbe Rueckfall-Logik: je URL zuerst der Account, der eine passende
 * Property als Inhaber fuehrt; bei 403 der naechste (accounts.ts, runForUrl).
 * Bis v2.9.0 las dieser Weg nur GSC_KEY_FILE und scheiterte im Gateway immer.
 */
async function withIndexingClient<T>(
  url: string,
  fn: (client: indexing_v3.Indexing) => Promise<T>
): Promise<T> {
  if (getAuthMode() === "oauth") {
    if (getScopeTier() === "readonly") {
      throw new Error(
        "URL submission needs full access, but this install is in read only mode (GSC_SCOPES=readonly). " +
        "Re-run `npx suganthan-gsc-mcp setup --reauth` and choose full access, then try again."
      );
    }
    const oauth2Client = await authenticateWithOAuth();
    return fn(google.indexing({ version: "v3", auth: oauth2Client }));
  }
  return runForUrl(url, () => {
    const account = currentAccount();
    if (!account) {
      throw new Error(
        "No service account configured for the Indexing API (GSC_SERVICE_ACCOUNT_JSON or GSC_KEY_FILE)."
      );
    }
    return fn(indexingClientFor(account));
  });
}

interface SubmitResult {
  url: string;
  type: string;
  notifyTime: string | null;
  success: boolean;
  error: string | null;
  note: string;
  account?: string;
}

export async function submitUrl(
  url: string,
  action: "URL_UPDATED" | "URL_DELETED" = "URL_UPDATED"
): Promise<SubmitResult> {
  try {
    let account: string | undefined;
    const response = await withIndexingClient(url, (indexing) => {
      account = currentAccount()?.email;
      return indexing.urlNotifications.publish({ requestBody: { url, type: action } });
    });

    return {
      url,
      type: action,
      notifyTime: response.data.urlNotificationMetadata?.latestUpdate?.notifyTime || null,
      success: true,
      error: null,
      note:
        "Google has been notified. The Indexing API officially supports JobPosting and BroadcastEvent schema types, but processes requests for all page types. Priority is not guaranteed for non-job pages.",
      ...(account && { account }),
    };
  } catch (err: any) {
    return {
      url,
      type: action,
      notifyTime: null,
      success: false,
      error: err.message || String(err),
      note:
        "Submission failed. The service account must be an Owner of a Search Console property covering the URL (Full user is not enough), and the Web Search Indexing API must be enabled in its Google Cloud project.",
    };
  }
}

export async function submitBatch(
  urls: string[],
  action: "URL_UPDATED" | "URL_DELETED" = "URL_UPDATED"
): Promise<{ results: SubmitResult[]; summary: { total: number; succeeded: number; failed: number; note: string } }> {
  if (urls.length > 200) {
    throw new Error(
      `Google's Indexing API has a daily quota of 200 requests. You provided ${urls.length} URLs. Please reduce to 200 or fewer.`
    );
  }

  const results: SubmitResult[] = [];

  for (const url of urls) {
    const result = await submitUrl(url, action);
    results.push(result);

    // Small delay to avoid rate limiting
    if (urls.length > 10) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  const succeeded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  return {
    results,
    summary: {
      total: urls.length,
      succeeded,
      failed,
      note: `Daily quota is 200 URL notifications. ${succeeded} submitted successfully, ${failed} failed.`,
    },
  };
}

/**
 * Lesend: letzte Meldungen dieser URL an die Indexing API (urlNotifications.getMetadata).
 * Prueft zugleich Inhaberrecht und API-Freischaltung, ohne etwas einzureichen. 404 heisst:
 * die URL wurde noch nie gemeldet - kein Fehler.
 */
export async function indexingStatus(url: string) {
  let account: string | undefined;
  const data = await withIndexingClient(url, async (indexing) => {
    account = currentAccount()?.email;
    try {
      const res = await indexing.urlNotifications.getMetadata({ url });
      return res.data;
    } catch (err: any) {
      if (Number(err?.code ?? err?.status ?? err?.response?.status) === 404) return null;
      throw err;
    }
  });
  return {
    url,
    ...(account && { account }),
    notified: data !== null,
    latestUpdate: data?.latestUpdate ?? null,
    latestRemove: data?.latestRemove ?? null,
    note:
      data === null
        ? "Access works, but Google has no Indexing API notification on record for this URL."
        : "Last notifications Google has on record for this URL via the Indexing API.",
  };
}
