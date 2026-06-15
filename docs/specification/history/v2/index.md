# APIScope History Specification v2

**Version:** 2  
**Status:** Implemented in VS Code extension v0.1.x  
**Spec version constant:** `history/v2`  
**Legacy:** `history/v1` (flat index — migrated on read)

## Purpose

This specification defines the on-disk **request execution history** format for APIScope. History records what was executed, with resolved URLs, timing, and optional response capture.

History is separate from the [Workspace Specification](/specification/workspace/v1/): the workspace describes what *can* be called; history describes what *was* called.

## Layout

```text
history/
├── index.json
└── YYYY/MM/DD/
    ├── index.json
    └── hist-NNN/
        ├── meta.json
        ├── request.json
        └── response.json    # optional
```

Day paths use zero-padded segments: `2026/06/12`.

---

## Global index

`history/index.json`:

```json
{
  "specVersion": "history/v2",
  "days": ["2026/06/12"],
  "lastEntryId": "hist-001"
}
```

| Field | Role |
|-------|------|
| `specVersion` | Must be `"history/v2"` |
| `days` | Day paths, newest first |
| `lastEntryId` | Most recent entry id |

---

## Daily index

`history/YYYY/MM/DD/index.json`:

```json
{
  "date": "2026-06-12",
  "entries": [
    {
      "id": "hist-001",
      "timestamp": "2026-06-12T18:43:20.282Z",
      "method": "GET",
      "url": "http://localhost:3002/download/json",
      "signature": "GET /download/json",
      "path": "/download/json",
      "statusCode": 200,
      "durationMs": 38,
      "environmentId": "generated",
      "captureResponse": false
    }
  ]
}
```

The daily index powers the History sidebar. Full payloads live in per-entry directories.

---

## Entry directory

Each execution is stored at `history/YYYY/MM/DD/{entryId}/`.

Entry ids follow the pattern `hist-NNN` (zero-padded counter).

### `meta.json`

```json
{
  "timestamp": "2026-06-12T18:43:20.282Z",
  "signature": "GET /download/json",
  "environmentId": "generated",
  "source": {
    "kind": "collection",
    "collectionId": "auto-generated",
    "requestId": "req-server-GET-download-json"
  },
  "captureResponse": false,
  "durationMs": 38
}
```

**Source kinds:**

| `kind` | Fields | Meaning |
|--------|--------|---------|
| `collection` | `collectionId`, `requestId` | Sent from a saved request |
| `draft` | `draftId` | Sent from a draft tab |
| `adhoc` | — | One-off execution |

Optional `error` field when no HTTP response was received (network failure).

### `request.json`

Resolved request as sent:

```json
{
  "method": "GET",
  "url": "http://localhost:3002/download/json",
  "headers": [
    { "key": "Accept", "value": "application/json", "enabled": true }
  ],
  "queryParams": [],
  "resolvedUrl": "http://localhost:3002/download/json"
}
```

### `response.json`

Present when `captureResponse` is `true`:

```json
{
  "statusCode": 200,
  "statusText": "OK",
  "headers": { "content-type": "application/json" },
  "body": "{ \"ok\": true }",
  "durationMs": 38
}
```

For file responses, `fileResponse` metadata references a path under `.apiscope/downloads/`:

```json
{
  "fileResponse": {
    "persist": true,
    "relativePath": ".apiscope/downloads/2026/06/12/download-001.pdf",
    "fileName": "report.pdf",
    "contentType": "application/pdf",
    "sizeBytes": 4096
  }
}
```

---

## Legacy format (`history/v1`)

Older workspaces may have a flat `history/index.json` with an `entries` array and `specVersion: "history/v1"`. Conforming implementations migrate to v2 layout on read.

---

## Drafts (related)

Unsaved requests use spec version `draft/v1` under `.apiscope/drafts/`. Drafts are not history entries but may become the source of future executions.

---

## Privacy

History may contain resolved auth headers, tokens, and response bodies. Tools should:

- Gitignore history by default in new workspaces
- Support selective export with redaction (future)
- Never sync history to cloud without explicit user consent

---

## Conformance

Implementers targeting **History Specification v2** must:

1. Write `specVersion: "history/v2"` in the global index
2. Organize entries by day under `YYYY/MM/DD/`
3. Split each entry into `meta.json`, `request.json`, and optional `response.json`
4. Record `source.kind` for traceability
5. Migrate or read legacy `history/v1` flat indexes

---

## Related documents

- [Workspace v1](/specification/workspace/v1/)
- [Architecture Decisions — ADR-004](/specification/adr/)
