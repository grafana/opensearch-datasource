# Change Log

All notable changes to this project will be documented in this file.

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
- Fixed timestamps in the backend beeing handled wrong (#31)
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
