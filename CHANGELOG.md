# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org).

## Unreleased

### Added

- Biome lint (`pnpm lint`), `exports` map, contributing guide, code of conduct, security policy, issue and PR templates.

### Changed

- Web page loads pdf-lib and pdf.js on demand, so the main chunk drops from 1.1 MB to 237 kB.
- Complete package metadata.

### Fixed

- Lint findings: type-only import, a helper that shadowed the global `escape`, explicit button types.

## 0.1.0 - 2026-11-18

### Added

- Initial release: JSON Resume to ATS-safe PDF, keyword coverage report, `ats-resume` CLI and an in-browser web page.
