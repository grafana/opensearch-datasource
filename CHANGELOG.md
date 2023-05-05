# Change Log

All notable changes to this project will be documented in this file.

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
