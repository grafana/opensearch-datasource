# End-to-end fixture data

## What's here

This folder contains a small script that generates a known set of documents — identical on
every run and on every machine — plus the generated documents themselves, used by the
end-to-end tests to assert on exact query results.

| File                      | What it is                                                    |
| ------------------------- | ------------------------------------------------------------- |
| `generate.mjs`            | Generates the two `.ndjson` files below. Run by hand, rarely. |
| `e2e-logs.ndjson`         | 240 log documents, one per minute over four hours.            |
| `e2e-traces.ndjson`       | 80 span documents: 20 traces of 4 spans each.                 |
| `e2e-logs.mapping.json`   | Index settings and field types for `e2e-logs`.                |
| `e2e-traces.mapping.json` | Index settings and field types for `e2e-traces`.              |

The `.ndjson` files are generated output and are committed on purpose, so that running the
tests never requires running the generator first.

## How it gets into OpenSearch

`docker compose up` (that is, `npm run server`) runs an extra `opensearch-loader` container
that waits for the cluster to come up, creates each index from its `*.mapping.json`, and
bulk-loads the matching `*.ndjson`. Grafana is configured not to start until that container
has finished successfully, so the tests can never race an empty cluster.

Two provisioned datasources point at the results: **OpenSearch E2E Logs** (`e2e-logs`) and
**OpenSearch E2E Traces** (`e2e-traces`).

## Caveats

**The data sits at a fixed date in the past: 2026-06-01, 00:00–04:00 UTC.** Every test
therefore has to ask for that exact window, which `tests/e2e/helpers.ts` does through
`FIXTURE_FROM_ISO` / `FIXTURE_TO_ISO`. The flip side is that any Grafana screen defaulting to
a relative range like "last 6 hours" will find nothing here — that is why the variable editor
spec cannot test a `terms` lookup.

**Document counts are written down in two places.** The generator produces them, and
`FIXTURE_LOG_COUNT` / `FIXTURE_TRACE_COUNT` in `tests/e2e/helpers.ts` assert them. Change one
and you must change the other, or the tests fail.

**The mapping files are not optional.** Left to itself, OpenSearch would infer `traceId`,
`traceGroup` and `serviceName` as `text` fields. The Traces query type aggregates on those
fields, which only works on `keyword` fields — so without explicit mappings every trace query
would quietly return zero results instead of failing loudly.

## Regenerating

Only needed if you change what the fixture data contains.

```shell
node tests/e2e/fixtures/generate.mjs   # rewrites the two .ndjson files
npm run server                            # the loader drops and recreates both indices
```

No need to clear the OpenSearch volumes: the loader deletes each index before recreating it,
so restarting always lands on exactly the fixture state rather than indexing the documents a
second time.

The generator uses a fixed random seed (`42`), so running it without editing it produces
exactly the same files — a no-op diff, not a churn of new random values.
