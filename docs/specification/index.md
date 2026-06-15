# APIScope Specifications

APIScope Specifications define portable, file-based standards for API development workspaces, request history, and related artifacts. They are the authoritative reference for how APIScope data is structured, versioned, and exchanged across tools.

Implementations — the VS Code extension, Cursor extension, and future CLI, web, and cloud services — should conform to these specifications. When implementation and specification diverge, the specification defines the intended behavior.

## What specifications cover

- On-disk workspace layout under `.apiscope/`
- Data models for collections, requests, environments, history, and drafts
- Collection export interchange format (`.apiscope.json`)
- Versioning and compatibility expectations
- Architecture decisions recorded as ADRs

Specifications describe **what** must be true for interoperability, not **how** a particular repository implements it.

## Principles

| Principle | Meaning |
|-----------|---------|
| **Open** | Publicly documented; any implementer may use them |
| **Tool-agnostic** | No APIScope-branded software required for conformance |
| **File-based** | Plain files on disk; no database required |
| **Human-readable** | JSON text formats, diff-friendly |
| **Backward compatible** | New versions preserve existing workspaces when possible |

## Current specifications

| Specification | Version | Status |
|---------------|---------|--------|
| [Workspace](/specification/workspace/v1/) | v1 | Implemented |
| [History](/specification/history/v2/) | v2 | Implemented |
| [Collection Export](/specification/collection-export/v1/) | v1 | Implemented |
| [Architecture Decisions](/specification/adr/) | — | Index (ADRs planned) |

## Versioning

Each domain is versioned independently:

```text
workspace/v1
history/v2
collection-export/v1
```

A major version (`v1`, `v2`, …) denotes a breaking revision. Minor clarifications within a major version do not change the directory name.

Implementations should declare which specification versions they support.

## Compatibility

- **Read compatibility:** newer tools should read older format versions
- **Write compatibility:** tools default to the oldest format they fully support unless the user opts into a newer version
- **Graceful degradation:** preserve unknown JSON fields on round-trip when feasible
- **Generated vs user artifacts:** generated collections and environments have distinct lifecycle rules

## Future specifications

| Area | Scope (planned) |
|------|-----------------|
| **Sync** | Multi-device workspace synchronization |
| **Mock** | Mock server behavior from workspace data |
| **Plugin** | Scanner, auth, and transport extension points |

## Repository layout (implementation)

The VS Code extension source maps to specifications as follows:

```text
src/
├── core/              Shared types and spec version constants
├── storage/           .apiscope file I/O (ApiScopeStorage, HistoryService, DraftStorage)
├── scanner/           FrameworkScanner interface + registry
├── spring-scanner/    Spring Boot scanner
├── express-scanner/   Express scanner
├── fastapi-scanner/   FastAPI scanner
├── collections/       CollectionManager, scan merge, import/export
├── environment/       Environment variables
├── authentication/    Auth storage + session login
├── request-executor/  HTTP client
└── webview-ui/        React UI
```

## Conformance

A component **targets** a specification version when it documents support and implements the required behavior in the corresponding specification README.

Full validation suites (JSON Schema validators) will be added under each version's `schema/` directory as they mature.
