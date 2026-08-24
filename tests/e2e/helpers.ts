import { ExplorePage } from '@grafana/plugin-e2e';
import type { Locator, Page } from '@playwright/test';

export const PLUGIN_ID = 'grafana-opensearch-datasource';
export const PROVISIONING_FILE = 'aws-opensearch.yaml';

/**
 * `GRAFANA_URL` is injected only by the Cloud cron workflow (playwright-cloud). Local runs
 * and PR CI leave it unset, so its presence reliably means we are on the shared Cloud
 * instance, where `provisioning/datasources/aws-opensearch.yaml` is never applied and the
 * fixture indices do not exist.
 */
export const isCloudRun = !!process.env.GRAFANA_URL;

/** Keep in sync with tests/e2e/fixtures/generate.mjs. */
export const FIXTURE_FROM_ISO = '2026-06-01T00:00:00.000Z';
export const FIXTURE_TO_ISO = '2026-06-01T04:00:00.000Z';
export const FIXTURE_LOG_COUNT = 240;
export const FIXTURE_TRACE_COUNT = 20;

export const LOGS_DATASOURCE_UID = 'opensearch-e2e-logs';
export const TRACES_DATASOURCE_UID = 'opensearch-e2e-traces';
export const LOGS_INDEX = 'e2e-logs';

/**
 * The managed OpenSearch data source provisioned on the shared Cloud instance. Override
 * when a run needs to target a different one.
 */
export const CLOUD_DATASOURCE_UID = process.env.DS_INSTANCE_UID ?? 'opensearch-ds-m';
/** Index written by the data generator attached to the Cloud instance. */
export const CLOUD_INDEX = process.env.DS_INSTANCE_INDEX ?? 'grafana-logs';

/** For the pages that pick a datasource by name rather than by UID. */
export const DATASOURCE_NAME = isCloudRun ? '[managed_data_source] - OpenSearch (PDC)' : 'OpenSearch E2E Logs';

/**
 * Grafana 12 and earlier render the plugin's config and query fields with a `<label>` that
 * carries no `for`, so `getByLabel` resolves nothing; newer versions wire it up. Matching the
 * input by DOM position works on every version in the CI matrix. Two shapes occur: a bare
 * input after the label, and a switch wrapped in a div.
 */
export const fieldFor = (page: Page, label: string): Locator =>
  page.locator(`label:text-is("${label}") + input, label:text-is("${label}") + div input`);

/**
 * Grafana 10.x gives every Select option the accessible name "Select option" and keeps the
 * real text in a nested span, so `getByRole('option', { name })` finds nothing there. Newer
 * versions expose the text as the name. Filtering on text content works on both.
 */
export const selectOption = (page: Page, name: string): Locator => page.getByRole('option').filter({ hasText: name });

type TimeRange = { from: string; to: string };

/**
 * Builds an Explore URL with the query and time range fully encoded. This fires exactly one
 * query on load, which stays deterministic under parallel workers — unlike driving the
 * datasource picker and time picker through the UI.
 */
export function exploreUrl(
  datasourceUid: string,
  query: Record<string, unknown> = {},
  range: TimeRange = { from: FIXTURE_FROM_ISO, to: FIXTURE_TO_ISO }
): string {
  const panes = JSON.stringify({
    explore: {
      datasource: datasourceUid,
      queries: [{ refId: 'A', datasource: { type: PLUGIN_ID, uid: datasourceUid }, ...query }],
      range,
    },
  });
  return `/explore?orgId=1&schemaVersion=1&panes=${encodeURIComponent(panes)}`;
}

const dateHistogram = { id: '2', type: 'date_histogram', settings: { interval: 'auto' } };

export const luceneQuery = {
  // The bucket agg deliberately carries no `field`, so the backend falls back to whichever
  // time field the datasource is configured with.
  metric: (query = '') => ({
    queryType: 'lucene',
    luceneQueryType: 'Metric',
    query,
    metrics: [{ id: '1', type: 'count' }],
    bucketAggs: [dateHistogram],
  }),
  logs: (query = '') => ({
    queryType: 'lucene',
    luceneQueryType: 'Logs',
    query,
    metrics: [{ id: '1', type: 'logs' }],
    bucketAggs: [],
  }),
  rawData: (query = '') => ({
    queryType: 'lucene',
    luceneQueryType: 'RawData',
    query,
    metrics: [{ id: '1', type: 'raw_data', settings: { size: '500' } }],
    bucketAggs: [],
  }),
  rawDocument: (query = '') => ({
    queryType: 'lucene',
    luceneQueryType: 'RawDocument',
    query,
    metrics: [{ id: '1', type: 'raw_document', settings: { size: '500' } }],
    bucketAggs: [],
  }),
  traces: (query = '') => ({
    queryType: 'lucene',
    luceneQueryType: 'Traces',
    query,
    metrics: [{ id: '1', type: 'count' }],
    bucketAggs: [dateHistogram],
  }),
};

export const pplQuery = (query: string, format: 'table' | 'logs' | 'time_series' = 'table') => ({
  queryType: 'PPL',
  query,
  format,
});

export type QueryResponseBody = {
  results?: Record<string, { frames?: unknown[]; error?: string; status?: number }>;
};

/**
 * `waitForQueryDataResponse` resolves with the raw Response, and Chrome may already have
 * evicted the CDP body buffer by then. Reading the body inside the predicate — while the
 * buffer is guaranteed live — is the only race-free option.
 *
 * Can be removed once @grafana/plugin-e2e exposes body reading natively.
 */
export function waitForQueryDataResponseWithBody(explorePage: ExplorePage) {
  let body: QueryResponseBody | null = null;
  const responsePromise = explorePage.waitForQueryDataResponse(async (response) => {
    if (!response.ok()) {
      return false;
    }
    const parsed: QueryResponseBody | null = await response.json().catch(() => null);
    if (!Array.isArray(parsed?.results?.A?.frames)) {
      return false;
    }
    body = parsed;
    return true;
  });
  return { responsePromise, getBody: () => body };
}

type Frame = { schema?: { fields?: Array<{ name: string }> }; data?: { values?: unknown[][] } };

/** Total rows across every frame in refId A. */
export function rowCount(body: QueryResponseBody | null): number {
  const frames = (body?.results?.A?.frames ?? []) as Frame[];
  return frames.reduce((total, frame) => total + (frame.data?.values?.[0]?.length ?? 0), 0);
}

/** Field names across every frame in refId A. */
export function fieldNames(body: QueryResponseBody | null): string[] {
  const frames = (body?.results?.A?.frames ?? []) as Frame[];
  return frames.flatMap((frame) => frame.schema?.fields?.map((field) => field.name) ?? []);
}
