// Regenerates the end-to-end fixture data. Run with `node tests/e2e/fixtures/generate.mjs`.
//
// The dataset is deterministic: the same SEED and window always produce byte-identical
// output, so tests can assert on exact document counts and aggregate values. Anything
// changed here must be mirrored in tests/e2e/fixtures/README.md and the FIXTURE_*
// constants in the specs.

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SEED = 42;
const FROM = Date.parse('2026-06-01T00:00:00.000Z');
const TO = Date.parse('2026-06-01T04:00:00.000Z');

const outDir = dirname(fileURLToPath(import.meta.url));

// mulberry32 — small, seedable, and stable across Node versions.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (rand, xs) => xs[Math.floor(rand() * xs.length)];
const hex = (rand, n) =>
  Array.from({ length: n }, () => '0123456789abcdef'[Math.floor(rand() * 16)]).join('');

const SERVICES = ['checkout', 'catalog', 'payments', 'shipping'];
const HOSTS = ['host-01', 'host-02', 'host-03', 'host-04'];

function bulk(index, docs) {
  return docs.map((doc) => `{"index":{"_index":"${index}"}}\n${JSON.stringify(doc)}`).join('\n') + '\n';
}

// e2e-logs: one document per minute across the window, so a 10m date_histogram
// always yields 24 non-empty buckets.
function logs() {
  const rand = rng(SEED);
  const docs = [];
  for (let t = FROM; t < TO; t += 60_000) {
    const level = pick(rand, ['info', 'info', 'info', 'warn', 'error']);
    const service = pick(rand, SERVICES);
    docs.push({
      '@timestamp': new Date(t).toISOString(),
      level,
      service,
      host: pick(rand, HOSTS),
      message: `${level} ${service} request completed`,
      status_code: pick(rand, [200, 200, 200, 201, 301, 404, 500]),
      bytes: 200 + Math.floor(rand() * 9800),
      response_time_ms: Math.round(rand() * 2000) / 10,
      client_ip: `10.0.${Math.floor(rand() * 256)}.${Math.floor(rand() * 256)}`,
    });
  }
  return docs;
}

// e2e-traces: Data Prepper span documents. Each trace is one root span plus three
// children, which is what the Traces query type aggregates over.
function traces() {
  const rand = rng(SEED);
  const docs = [];
  const step = Math.floor((TO - FROM) / 20);
  for (let i = 0; i < 20; i++) {
    const traceId = hex(rand, 32);
    const rootService = SERVICES[i % SERVICES.length];
    const traceGroup = `/api/${rootService}`;
    const start = FROM + i * step;
    const traceDurationNanos = (50 + Math.floor(rand() * 450)) * 1_000_000;
    // statusCode 2 is the OTel "error" status; the Traces query counts these per trace.
    const statusCode = rand() < 0.2 ? 2 : 0;
    const rootSpanId = hex(rand, 16);

    const span = (spanId, parentSpanId, serviceName, name, offsetNanos, durationNanos) => ({
      traceId,
      spanId,
      parentSpanId,
      name,
      kind: parentSpanId === '' ? 'SPAN_KIND_SERVER' : 'SPAN_KIND_CLIENT',
      serviceName,
      traceGroup,
      traceGroupFields: {
        endTime: new Date(start + traceDurationNanos / 1_000_000).toISOString(),
        durationInNanos: traceDurationNanos,
        statusCode,
      },
      startTime: new Date(start + offsetNanos / 1_000_000).toISOString(),
      endTime: new Date(start + (offsetNanos + durationNanos) / 1_000_000).toISOString(),
      durationInNanos: durationNanos,
      status: { code: statusCode },
      events: [],
      'resource.attributes.service@name': serviceName,
      'span.attributes.http@method': pick(rand, ['GET', 'POST']),
      'span.attributes.http@status_code': statusCode === 2 ? 500 : 200,
    });

    docs.push(span(rootSpanId, '', rootService, traceGroup, 0, traceDurationNanos));
    for (let c = 0; c < 3; c++) {
      const childService = SERVICES[(i + c + 1) % SERVICES.length];
      const offset = Math.floor((traceDurationNanos / 4) * c);
      docs.push(
        span(hex(rand, 16), rootSpanId, childService, `${childService}.handle`, offset, Math.floor(traceDurationNanos / 4))
      );
    }
  }
  return docs;
}

const datasets = { 'e2e-logs': logs(), 'e2e-traces': traces() };
for (const [index, docs] of Object.entries(datasets)) {
  writeFileSync(join(outDir, `${index}.ndjson`), bulk(index, docs));
  console.log(`${index}: ${docs.length} documents`);
}
