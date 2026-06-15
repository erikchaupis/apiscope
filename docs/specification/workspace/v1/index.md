# APIScope Workspace Specification v1

**Version:** 1  
**Status:** Implemented in VS Code extension v0.1.x  
**Compatibility target:** APIScope Workspace Specification v1

## Purpose

This specification defines the on-disk structure of an **APIScope Workspace**: collections, requests, environments, scan metadata, history, drafts, downloads, and UI configuration for a project.

An APIScope Workspace is **local-first**. It lives beside project source code and requires no external database.

## Workspace root

An APIScope Workspace is rooted at `.apiscope/` relative to a project workspace root.

```text
.apiscope/
├── config.json
├── .gitignore
├── collections/
├── environments/
├── scans/
├── history/
├── drafts/
└── downloads/
```

The `.apiscope/` directory is the boundary of APIScope-owned project data.

### Default `.gitignore`

New workspaces include a `.gitignore` that excludes local runtime data:

```text
collections/auto-generated/
environments/
scans/
history/
drafts/
downloads/
```

Teams may remove entries to commit shared environments or collection templates.

---

## `config.json`

Workspace-level configuration. Current schema version: **`version: 2`**.

```json
{
  "version": 2,
  "activeCollectionId": "auto-generated",
  "activeEnvironmentId": "generated",
  "lastScan": "2026-06-12T18:43:14.639Z",
  "ui": {
    "theme": "solar",
    "expandedCollectionIds": ["auto-generated"],
    "expandedFolderIds": ["auto-generated:folder-server"],
    "collectionsPanelCollapsed": true,
    "expandedHistoryDays": ["2026-06-12"],
    "expandedHistorySignatures": ["2026-06-12:GET /download/json"]
  }
}
```

| Field | Role |
|-------|------|
| `version` | Config schema version (`2`) |
| `activeCollectionId` | Selected collection |
| `activeEnvironmentId` | Selected environment |
| `lastScan` | ISO timestamp of last scan |
| `ui` | Tool-assistive UI state (optional on read): expanded tree nodes, panel layout, `theme`, etc. |

`config.json` improves UX but is not the authoritative source for collection or request content.

---

## `collections/`

```text
collections/
├── index.json
├── auto-generated/
│   ├── collection.json
│   ├── tree.json
│   └── requests/
│       └── req-server-GET-health.json
└── collection-001/
    ├── collection.json
    ├── tree.json
    └── requests/
        └── req-custom-POST-login.json
```

### Collections index

`collections/index.json`:

```json
{
  "collections": [
    {
      "id": "auto-generated",
      "name": "Generated Collection",
      "type": "generated"
    },
    {
      "id": "collection-001",
      "name": "My API Tests",
      "type": "user"
    }
  ]
}
```

### Collection metadata

`collection.json`:

```json
{
  "id": "auto-generated",
  "name": "Generated Collection",
  "type": "generated",
  "createdAt": "2026-06-12T18:43:14.619Z",
  "updatedAt": "2026-06-12T18:43:52.863Z",
  "isDirty": true
}
```

| Field | Values | Notes |
|-------|--------|-------|
| `type` | `generated` \| `user` | Controls rescan behavior |
| `isDirty` | boolean | User edits in generated collection |

### Tree model

`tree.json` separates hierarchy from request content:

```json
{
  "root": [
    { "kind": "folder", "id": "folder-server" },
    { "kind": "request", "id": "req-server-GET-health" }
  ],
  "nodes": {
    "folder-server": {
      "name": "server",
      "children": [
        { "kind": "request", "id": "req-server-GET-health" }
      ]
    }
  }
}
```

Every request id in the tree must have a matching file in `requests/`.

### Request files

`requests/{requestId}.json`:

```json
{
  "id": "req-server-GET-health",
  "displayName": "Health",
  "method": "GET",
  "url": "{{baseUrl}}/health",
  "headers": [
    { "key": "Accept", "value": "application/json", "enabled": true }
  ],
  "queryParams": [],
  "path": "/health",
  "sourceKey": "server:GET:/health",
  "sourceFile": "server.js"
}
```

Scanned requests include `sourceKey`, `sourceFile`, and optionally `line`. User requests omit source fields.

Supported methods: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`.

---

## `environments/`

```text
environments/
├── index.json
├── generated/
│   └── environment.json
└── environment-001/
    └── environment.json
```

### Environment file

```json
{
  "id": "generated",
  "name": "Generated Environment",
  "source": "generated",
  "environmentType": "LOCAL",
  "variables": [
    { "name": "baseUrl", "value": "http://localhost:3002" }
  ]
}
```

| Field | Values |
|-------|--------|
| `source` | `generated` \| `user` |
| `environmentType` | `LOCAL`, `DEV`, `UAT`, `STAGING`, `PROD`, `CUSTOM` |

Variable substitution uses `{{name}}` syntax in URLs, headers, and bodies.

---

## `scans/`

```text
scans/
└── last-scan.json
```

```json
{
  "framework": "express",
  "controllers": 1,
  "endpoints": 10,
  "lastScan": "2026-06-12T18:43:14.639Z",
  "added": 10,
  "updated": 0,
  "removed": 0,
  "addedLabels": ["+ GET /health"],
  "updatedLabels": [],
  "removedLabels": []
}
```

---

## `history/`

History storage is specified in [History v2](/specification/history/v2/). Workspace v1 reserves the `history/` directory.

---

## `drafts/`

Ad-hoc unsaved requests. Spec version: `draft/v1`.

```text
drafts/
└── draft-001.json
```

Each file is a self-contained draft document with method, URL, headers, body, and timestamps.

---

## `downloads/`

Persisted and ephemeral file download storage.

```text
downloads/
├── .counter.json
├── .temp/
└── 2026/06/12/
    └── download-001.pdf
```

| Path | Purpose |
|------|---------|
| `YYYY/MM/DD/` | Persisted downloads linked from history |
| `.temp/` | Ephemeral previews (auto-cleaned) |

---

## Authentication data

Credentials, session cookies, and bearer tokens are **not** stored under `.apiscope/`. Implementations must use platform secret storage (VS Code Secret Storage API).

---

## Artifact summary

| Artifact | Scope |
|----------|-------|
| `config.json` | Workspace preferences |
| `collections/index.json` | Collection manifest |
| `collection.json` | Per-collection metadata |
| `tree.json` | Per-collection hierarchy |
| `requests/*.json` | Per-request definitions |
| `environments/index.json` | Environment manifest |
| `environment.json` | Per-environment variables |
| `scans/last-scan.json` | Last scan summary |
| `history/` | Execution history (see History v2) |
| `drafts/*.json` | Unsaved requests |
| `downloads/` | Response file storage |

---

## Conformance

Implementers targeting **Workspace Specification v1** must:

1. Use the `.apiscope/` root layout above
2. Store collections with separate `collection.json`, `tree.json`, and `requests/` artifacts
3. Distinguish `generated` and `user` types in collection metadata
4. Never write credentials to `.apiscope/`
5. Preserve unknown JSON fields on read/write when possible

---

## Related documents

- [History v2](/specification/history/v2/)
- [Collection Export v1](/specification/collection-export/v1/)
- [Architecture Decisions](/specification/adr/)
