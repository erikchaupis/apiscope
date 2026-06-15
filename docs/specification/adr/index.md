# Architecture Decision Records

Architecture Decision Records (ADRs) capture **context**, **decision**, and **consequences** for choices that affect multiple specifications and implementations.

ADRs explain **why** standards exist. Specifications describe **what** is required.

## Format

Each ADR is a markdown file:

```text
ADR-NNN-short-title.md
```

Recommended sections: Title, Status, Context, Decision, Consequences.

## Index

| ID | Title | Topic | Status |
|----|-------|-------|--------|
| **ADR-001** | Storage Model | File layout under `.apiscope/`, tree/request separation, index manifests | Planned |
| **ADR-002** | Generated Collection | Scanned collection lifecycle, rescan merge, dirty state | Planned |
| **ADR-003** | Environment Model | Variable resolution, generated vs user environments | Planned |
| **ADR-004** | History Structure | History v2 day-based layout, privacy, replay | Planned |

Individual ADR files will be added as decisions are formally recorded.

## Relationship to specifications

| Document | Answers |
|----------|---------|
| Specification | What is required for conformance |
| JSON Schema (future) | Machine-validatable field rules |
| ADR | Why the design was chosen |

**Example:** ADR-002 explains merge policy rationale; [Workspace v1](/specification/workspace/v1/) states observable outcomes.

## Contributing

New ADRs should address decisions with multi-spec or long-term impact, reference affected specification paths, and avoid restating entire specifications.
