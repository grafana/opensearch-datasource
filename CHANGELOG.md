# Change Log

All notable changes to this project will be documented in this file.

## 2.21.1

- Fix: build each query response separately [#489](https://github.com/grafana/opensearch-datasource/pull/489)
- Bump the all-node-dependencies group across 1 directory with 4 updates [#482](https://github.com/grafana/opensearch-datasource/pull/482)
- Bump the all-github-action-dependencies group with 4 updates [#479](https://github.com/grafana/opensearch-datasource/pull/479)

## 2.21.0

- Migrate Health check to run through the backend [#485](https://github.com/grafana/opensearch-datasource/pull/485)
- Add PDC support [#437](https://github.com/grafana/opensearch-datasource/pull/437)

## 2.20.0

- Chore: update dependencies [#476](https://github.com/grafana/opensearch-datasource/pull/476)
- Migrate Annotation Queries to run through the backend [#477](https://github.com/grafana/opensearch-datasource/pull/477)
- Upgrade grafana-plugin-sdk-go (deps): Bump github.com/grafana/grafana-plugin-sdk-go from 0.252.0 to 0.256.0 [#475](https://github.com/grafana/opensearch-datasource/pull/475)
- Docs: Improve provisioning example in README.md [#444](https://github.com/grafana/opensearch-datasource/pull/444)
- Upgrade grafana-plugin-sdk-go (deps): Bump github.com/grafana/grafana-plugin-sdk-go from 0.250.2 to 0.252.0 [#474](https://github.com/grafana/opensearch-datasource/pull/474)
- Migrate getting fields to run through the backend [#473](https://github.com/grafana/opensearch-datasource/pull/473)
- Migrate getTerms to run through the backend [#471](https://github.com/grafana/opensearch-datasource/pull/471)

## 2.19.1

- Chore: Update plugin.json keywords in [#469](https://github.com/grafana/opensearch-datasource/pull/469)
- Fix: handle empty trace group and last updated values in [#445](https://github.com/grafana/opensearch-datasource/pull/445)
- Dependabot updates in [#463](https://github.com/grafana/opensearch-datasource/pull/463)
  - Bump dompurify from 2.4.7 to 2.5.6
  - Bump path-to-regexp from 1.8.0 to 1.9.0
  - Bump braces from 3.0.2 to 3.0.3
- Chore: Add Combine PRs workflow to the correct directory in [#462](https://github.com/grafana/opensearch-datasource/pull/462)
- Chore: Add Combine PRs action in [#461](https://github.com/grafana/opensearch-datasource/pull/461)

## 2.19.0

- Reroute service map trace queries to the backend in [#459](https://github.com/grafana/opensearch-datasource/pull/459)
- Use resource handler to get version in [#452](https://github.com/grafana/opensearch-datasource/pull/452)
- Bump grafana-aws-sdk to 0.31.2 in [#456](https://github.com/grafana/opensearch-datasource/pull/456)
- Bump grafana-plugin-sdk-go to 0.250.2 in [#456](https://github.com/grafana/opensearch-datasource/pull/456)

## 2.18.0

- Add errorsource to errors in [#449](https://github.com/grafana/opensearch-datasource/pull/449)
- Trace View: Add name and attributes into event object in [#448](https://github.com/grafana/opensearch-datasource/pull/448)

## 2.17.4

- Bugfix: Update aws/aws-sdk-go to support Pod Identity credentials in [#447](https://github.com/grafana/opensearch-datasource/pull/447)
- Bump webpack from 5.89.0 to 5.94.0 in [#446](https://github.com/grafana/opensearch-datasource/pull/446)

## 2.17.3

- Bump fast-loops from 1.1.3 to 1.1.4 in [#438](https://github.com/grafana/opensearch-datasource/pull/438)
- Bump ws from 8.15.1 to 8.18.0 in [#439](https://github.com/grafana/opensearch-datasource/pull/439)
- Bump micromatch from 4.0.5 to 4.0.8 in [#441](https://github.com/grafana/opensearch-datasource/pull/441)
- Chore: Rename datasource file [#430](https://github.com/grafana/opensearch-datasource/pull/430)
- Chore: Add pre-commit hook in [#429](https://github.com/grafana/opensearch-datasource/pull/429)

## 2.17.2

- Fix serviceMap when source node doesn't have stats in [#428](https://github.com/grafana/opensearch-datasource/pull/428)

## 2.17.1

- Use tagline to detect OpenSearch in compatibility mode in [#419](https://github.com/grafana/opensearch-datasource/pull/419)
- Fix: use older timestamp format for older elasticsearch in [#415](https://github.com/grafana/opensearch-datasource/pull/415)

## 2.17.0

- Clear version error when serverless toggled in [#411](https://github.com/grafana/opensearch-datasource/pull/411)
- chore: refactor interval calculation in [#412](https://github.com/grafana/opensearch-datasource/pull/412)

## 2.16.1

- Send all queries to backend if feature toggle is enabled in [#409](https://github.com/grafana/opensearch-datasource/pull/409)

## 2.16.0

- Bugfix: Pass docvalue_fields for elasticsearch in the backend flow in [#404](https://github.com/grafana/opensearch-datasource/pull/404)
- Use application/x-ndjson content type for multisearch requests in [#403](https://github.com/grafana/opensearch-datasource/pull/403)
- Refactor ad hoc variable processing in [#399](https://github.com/grafana/opensearch-datasource/pull/399)

## 2.15.4

- Chore: Improve error message by handling `caused_by.reason` error messages in [#401](https://github.com/grafana/opensearch-datasource/pull/401)

## 2.15.3

- Fix: Add fields to frame if it does not already exist when grouping by multiple terms in [#392](https://github.com/grafana/opensearch-datasource/pull/392)

## 2.15.2

- security: bump grafana-plugin-sdk-go to address CVEs by @njvrzm in https://github.com/grafana/opensearch-datasource/pull/395

## 2.15.1

- Revert Lucene and PPL migration to backend [#8b1e396](https://github.com/grafana/opensearch-datasource/commit/8b1e3960c5b3643ddd6db569acfe8e6ed153b0b8)

## 2.15.0

- Trace analytics: Implement Service Map feature for traces in [#366](https://github.com/grafana/opensearch-datasource/pull/366), [#362](https://github.com/grafana/opensearch-datasource/pull/362), [#358](https://github.com/grafana/opensearch-datasource/pull/358)
- Backend Migration: Run all Lucene queries and PPL logs and table queries on the backend in [#375](https://github.com/grafana/opensearch-datasource/pull/375)
- Backend Migration: migrate ppl timeseries to backend in [#367](https://github.com/grafana/opensearch-datasource/pull/367)
- Traces: Direct all trace queries to the BE in [#355](https://github.com/grafana/opensearch-datasource/pull/355)
- Fix flaky tests in [#369](https://github.com/grafana/opensearch-datasource/pull/369)

## 2.14.7

- Fix: data links not working in explore for Trace List queries [#353](https://github.com/grafana/opensearch-datasource/pull/353)
- Chore: add temporary node graph toggle [#350](https://github.com/grafana/opensearch-datasource/pull/350)
- Chore: update keywords in plugin.json [#347](https://github.com/grafana/opensearch-datasource/pull/347)

## 2.14.6

- Annotation Editor: Fix query editor to support new react annotation handling in [#342](https://github.com/grafana/opensearch-datasource/pull/342)

## 2.14.5

- Bugfix: Forward http headers to enable OAuth for backend queries in [#345](https://github.com/grafana/opensearch-datasource/pull/345)
- Allow to use script in query variable by @loru88 in [#344](https://github.com/grafana/opensearch-datasource/pull/344)
- Chore: run go mod tidy #338 [#338](https://github.com/grafana/opensearch-datasource/pull/338)
- Chore: adds basic description and link to github by @sympatheticmoose in [#337](https://github.com/grafana/opensearch-datasource/pull/337)

## 2.14.4

- Fix: Move "Build a release" in CONTRIBUTING.md out of TLS section in [#324](https://github.com/grafana/opensearch-datasource/pull/324)
- Backend Migration: Add data links to responses from the backend in [#326](https://github.com/grafana/opensearch-datasource/pull/326)

## 2.14.3

- Update grafana-aws-sdk to 0.22.0 in [#323](https://github.com/grafana/opensearch-datasource/pull/323)

## 2.14.2

- Support time field with nanoseconds by Christian Norbert Menges <christian.norbert.menges@sap.com> in [#321](https://github.com/grafana/opensearch-datasource/pull/321)
- Refactor tests to remove Enzyme and use react-testing-library in [#319](https://github.com/grafana/opensearch-datasource/pull/319)

## 2.14.1

- Upgrade Grafana dependencies and create-plugin config in [#315](https://github.com/grafana/opensearch-datasource/pull/315)

## 2.14.0

- Backend refactor and clean by @fridgepoet in [#283](https://github.com/grafana/opensearch-datasource/pull/283)
- Backend: Add trace list query building by @fridgepoet in [#284](https://github.com/grafana/opensearch-datasource/pull/284)
- Migrate to create-plugin and support node 18 by @kevinwcyu in [#286](https://github.com/grafana/opensearch-datasource/pull/286)
- PPL: Execute Explore PPL Table format queries through the backend by @iwysiu in [#289](https://github.com/grafana/opensearch-datasource/pull/289)
- Bump semver from 7.3.7 to 7.5.2 by @dependabot in [#292](https://github.com/grafana/opensearch-datasource/pull/292)
- Bump go.opentelemetry.io/contrib/instrumentation/net/http/httptrace/otelhttptrace from 0.37.0 to 0.44.0 by @dependabot in [#293](https://github.com/grafana/opensearch-datasource/pull/293)
- Bump @babel/traverse from 7.18.6 to 7.23.2 by @dependabot in [#297](https://github.com/grafana/opensearch-datasource/pull/297)
- Backend: Refactor trace spans (query building + response processing) by @idastambuk in [#257](https://github.com/grafana/opensearch-datasource/pull/257)
- Refactor Response Parser by @sarahzinger in [#309](https://github.com/grafana/opensearch-datasource/pull/309)
- Upgrade dependencies by @fridgepoet in [#307](https://github.com/grafana/opensearch-datasource/pull/307)
- All trace list requests go through backend by @sarahzinger in [#310](https://github.com/grafana/opensearch-datasource/pull/310)
- Use github app for issue commands workflow by @katebrenner in [#312](https://github.com/grafana/opensearch-datasource/pull/312)

## 2.13.1

- Backend: Fix Lucene logs so it only uses date_histogram by @fridgepoet in #277
- Backend: Remove \_doc from sort array in query building, Remove limit from response processing by @fridgepoet in #278

## 2.13.0

- [Explore] Migrate Lucene metric queries to the backend by @fridgepoet as part of https://github.com/grafana/opensearch-datasource/issues/197
  - The Lucene metric query type has been refactored to execute through the backend in the **Explore view only**. Existing Lucene metric queries in Dashboards are unchanged and execute through the frontend. Please report any anomalies observed in Explore by [reporting an issue](https://github.com/grafana/opensearch-datasource/issues/new?assignees=&labels=datasource%2FOpenSearch%2Ctype%2Fbug&projects=&template=bug_report.md).

## 2.12.0

- Get filter values with correct time range (requires Grafana 10.2.x) by @iwysiu in https://github.com/grafana/opensearch-datasource/pull/265
- Backend (alerting/expressions only) Lucene metrics: Parse MinDocCount as int or string by @fridgepoet in https://github.com/grafana/opensearch-datasource/pull/268
- Backend (alerting/expressions only) Lucene metrics: Fix replacement of \_term to \_key in terms order by @fridgepoet in https://github.com/grafana/opensearch-datasource/pull/270
- Backend (alerting/expressions only) Lucene metrics: Remove "size":500 from backend processTimeSeriesQuery by @fridgepoet in https://github.com/grafana/opensearch-datasource/pull/269

## 2.11.0

- [Explore] Migrate PPL log queries to the backend by @kevinwcyu in https://github.com/grafana/opensearch-datasource/pull/259
  - The PPL Logs query type has been refactored to execute through the backend in the **Explore view only**. Existing PPL Logs queries in Dashboards are unchanged and execute through the frontend. Please report any anomalies observed in Explore by [reporting an issue](https://github.com/grafana/opensearch-datasource/issues/new?assignees=&labels=datasource%2FOpenSearch%2Ctype%2Fbug&projects=&template=bug_report.md).

## 2.10.2

- Dependencies update

## 2.10.1

- Backend: Refactor http client so that it is reused

## 2.10.0

- [Explore] Migrate Lucene log queries to the backend by @fridgepoet in https://github.com/grafana/opensearch-datasource/pull/228
  - The Lucene Logs query type has been refactored to execute through the backend in the **Explore view only**. Existing Lucene Logs queries in Dashboards are unchanged and execute through the frontend. Please report any anomalies observed in Explore by [reporting an issue](https://github.com/grafana/opensearch-datasource/issues/new?assignees=&labels=datasource%2FOpenSearch%2Ctype%2Fbug&projects=&template=bug_report.md).
- Apply ad-hoc filters to PPL queries before sending it to the backend by @kevinwcyu in https://github.com/grafana/opensearch-datasource/pull/244

## 2.9.1

- upgrade @grafana/aws-sdk to fix bug in temp credentials

## 2.9.0

- Update grafana-aws-sdk to v0.19.1 to add `il-central-1` to the opt-in region list

## 2.8.3

- Fix: convert ad-hoc timestamp filters to UTC for PPL queries in https://github.com/grafana/opensearch-datasource/pull/237

## 2.8.2

- Add ad hoc filters before sending Lucene queries to backend by @fridgepoet in https://github.com/grafana/opensearch-datasource/pull/225

## 2.8.1

- Fix template variable interpolation of queries going to the backend by @fridgepoet in https://github.com/grafana/opensearch-datasource/pull/220

## 2.8.0

- Fix: Take into account raw_data query's Size and Order by @fridgepoet in https://github.com/grafana/opensearch-datasource/pull/210
- Backend: Default to timeField if no field is specified in date histogram aggregation by @fridgepoet in https://github.com/grafana/opensearch-datasource/pull/215
- Backend: Change query sort to respect sort order by @fridgepoet in https://github.com/grafana/opensearch-datasource/pull/211
- Backend: Add raw_document query support by @fridgepoet in https://github.com/grafana/opensearch-datasource/pull/214

## v2.7.1

- Dependency update

## v2.7.0

- Add raw_data query support to backend by @fridgepoet in https://github.com/grafana/opensearch-datasource/pull/203

## v2.6.2

- Backend: Convert tables to data frames by @fridgepoet in https://github.com/grafana/opensearch-datasource/pull/186
- Refactor PPL and Lucene time series response processing to return DataFrames by @idastambuk in https://github.com/grafana/opensearch-datasource/pull/188
- Backend: Use int64 type instead of string for from/to date times by @fridgepoet in https://github.com/grafana/opensearch-datasource/pull/191

## v2.6.1

- Backend: Fix SigV4 when creating client by @fridgepoet in https://github.com/grafana/opensearch-datasource/pull/183

## v2.6.0

- Ability to select order (Desc/Asc) for "raw data" metrics aggregations by @lvta0909 in https://github.com/grafana/opensearch-datasource/pull/88
- Backend: Set field.Config.DisplayNameFromDS instead of frame.name by @fridgepoet in https://github.com/grafana/opensearch-datasource/pull/180

## v2.5.1

- Fix backend pipeline aggregation query parsing and data frame building in https://github.com/grafana/opensearch-datasource/pull/168

## v2.5.0

### Features and Enhancements:

- OpenSearch version detection added [#120](https://github.com/grafana/opensearch-datasource/issues/120)

### Bug Fixes:

- Fix query editor misalignment (#163)
- Fix use case when a panel has queries of different types (#141)

## v2.4.1

### Bug Fixes:

- Security: Upgrade Go in build process to 1.20.4
- Update grafana-plugin-sdk-go version to 0.161.0

## v2.4.0

### Features and Enhancements:

- Support for Trace Analytics [#122](https://github.com/grafana/opensearch-datasource/pull/122), @idastambuk, @katebrenner, @iwysiu, @sarahzinger

### Bug Fixes:

- Update Backend Dependencies [#148](https://github.com/grafana/opensearch-datasource/pull/148), @fridgepoet
- Fix view of nested array field in table column [#128](https://github.com/grafana/opensearch-datasource/pull/128), [@z0h3](https://github.com/z0h3)

## v2.3.0

- Add 'Use time range' option, skip date type field validation by @z0h3 in https://github.com/grafana/opensearch-datasource/pull/125
- Create httpClient with grafana-plugin-sdk-go methods by @fridgepoet in https://github.com/grafana/opensearch-datasource/pull/118

## v2.2.0

- Fix moving_avg modes to correctly parse coefficients as floats (`alpha`, `beta`, and `gamma`) (#99)
- Use grafana-aws-sdk v0.12.0 to update opt-in regions list (#102)

## v2.1.0

### Enhancements

- Add option to query OpenSearch serverless (#92)

## v2.0.4

### Bug fixes

- Backend: Fix index being read from the wrong place (#80)

## v2.0.3

### Bug fixes

- Fixed missing custom headers (#73)

## v2.0.2

### Enhancements

- Upgrade of `grafana-aws-skd` to `0.11.0` (#69)

## v2.0.1

### Bug fixes

- Fixed timestamps in the backend being handled wrong (#31)
- Fixed timestamps in the frontend being assumed as local, whereas they should be UTC (#21, #66)

## v2.0.0

### Features and enhancements

- Upgrade of `@grafana/data`, `@grafana/ui`, `@grafana/runtime`, `@grafana/toolkit` to 9.0.2 (#46)

### Breaking Changes

- Use `SIGV4ConnectionConfig` from `@grafana/ui` (#48)

## v1.2.0

### Features and enhancements

- Upgrade of `@grafana/data`, `@grafana/ui`, `@grafana/runtime`, `@grafana/toolkit` to 8.5.5 (#35, #41)
- Upgrade of further frontend and backend dependencies (#42, #43)

## v1.1.2

### Bug fixes

- Improve error handling
- Fix alias pattern not being correctly handled by Query Editor

## v1.1.0

### New features

- Add support for Elasticsearch databases (2f9e802)

## v1.0.0

- First Release
