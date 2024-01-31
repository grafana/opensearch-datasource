# Change Log

All notable changes to this project will be documented in this file.

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
- Use  github app for issue commands workflow by @katebrenner in [#312](https://github.com/grafana/opensearch-datasource/pull/312)

## 2.13.1

- Backend: Fix Lucene logs so it only uses date_histogram by @fridgepoet in #277
- Backend: Remove _doc from sort array in query building, Remove limit from response processing by @fridgepoet in #278

## 2.13.0
- [Explore] Migrate Lucene metric queries to the backend by @fridgepoet as part of https://github.com/grafana/opensearch-datasource/issues/197
  - The Lucene metric query type has been refactored to execute through the backend in the **Explore view only**. Existing Lucene metric queries in Dashboards are unchanged and execute through the frontend. Please report any anomalies observed in Explore by [reporting an issue](https://github.com/grafana/opensearch-datasource/issues/new?assignees=&labels=datasource%2FOpenSearch%2Ctype%2Fbug&projects=&template=bug_report.md).

## 2.12.0

* Get filter values with correct time range (requires Grafana 10.2.x) by @iwysiu in https://github.com/grafana/opensearch-datasource/pull/265
* Backend (alerting/expressions only) Lucene metrics: Parse MinDocCount as int or string by @fridgepoet in https://github.com/grafana/opensearch-datasource/pull/268
* Backend (alerting/expressions only) Lucene metrics: Fix replacement of _term to _key in terms order by @fridgepoet in https://github.com/grafana/opensearch-datasource/pull/270
* Backend (alerting/expressions only) Lucene metrics: Remove "size":500 from backend processTimeSeriesQuery by @fridgepoet in https://github.com/grafana/opensearch-datasource/pull/269

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
