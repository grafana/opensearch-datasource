# Change Log

All notable changes to this project will be documented in this file.

## 2.8.2
* Add ad hoc filters before sending Lucene queries to backend by @fridgepoet in https://github.com/grafana/opensearch-datasource/pull/225

## 2.8.1
* Fix template variable interpolation of queries going to the backend by @fridgepoet in https://github.com/grafana/opensearch-datasource/pull/220

## 2.8.0
* Fix: Take into account raw_data query's Size and Order  by @fridgepoet in https://github.com/grafana/opensearch-datasource/pull/210
* Backend: Default to timeField if no field is specified in date histogram aggregation by @fridgepoet in https://github.com/grafana/opensearch-datasource/pull/215
* Backend: Change query sort to respect sort order by @fridgepoet in https://github.com/grafana/opensearch-datasource/pull/211
* Backend: Add raw_document query support by @fridgepoet in https://github.com/grafana/opensearch-datasource/pull/214

## v2.7.1

* Dependency update

## v2.7.0
* Add raw_data query support to backend by @fridgepoet in https://github.com/grafana/opensearch-datasource/pull/203

## v2.6.2

* Backend: Convert tables to data frames by @fridgepoet in https://github.com/grafana/opensearch-datasource/pull/186
* Refactor PPL and Lucene time series response processing to return DataFrames by @idastambuk in https://github.com/grafana/opensearch-datasource/pull/188
* Backend: Use int64 type instead of string for from/to date times by @fridgepoet in https://github.com/grafana/opensearch-datasource/pull/191


## v2.6.1

* Backend: Fix SigV4 when creating client by @fridgepoet in https://github.com/grafana/opensearch-datasource/pull/183

## v2.6.0

* Ability to select order (Desc/Asc) for "raw data" metrics aggregations by @lvta0909 in https://github.com/grafana/opensearch-datasource/pull/88
* Backend: Set field.Config.DisplayNameFromDS instead of frame.name by @fridgepoet in https://github.com/grafana/opensearch-datasource/pull/180

## v2.5.1

* Fix backend pipeline aggregation query parsing and data frame building in https://github.com/grafana/opensearch-datasource/pull/168

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
