# Collection Export Specification v1

**Version:** 1  
**Status:** Implemented in VS Code extension v0.1.x  
**File extension:** `.apiscope.json`  
**Spec version constant:** `"1"`

## Purpose

This specification defines the interchange format for exporting and importing a single APIScope collection. One file contains the collection metadata, tree hierarchy, and all request definitions.

## Document structure

```json
{
  "specVersion": "1",
  "exportedAt": "2026-06-12T20:00:00.000Z",
  "collection": {
    "id": "collection-001",
    "name": "My API Tests",
    "type": "user",
    "createdAt": "2026-06-01T10:00:00.000Z",
    "updatedAt": "2026-06-12T19:30:00.000Z",
    "isDirty": false,
    "tree": { "root": [], "nodes": {} },
    "requests": {
      "req-custom-GET-users": {
        "id": "req-custom-GET-users",
        "displayName": "List users",
        "method": "GET",
        "url": "{{baseUrl}}/users",
        "headers": [],
        "queryParams": []
      }
    }
  }
}
```

## Top-level fields

| Field | Required | Description |
|-------|----------|-------------|
| `specVersion` | yes | Must be `"1"` |
| `exportedAt` | yes | ISO 8601 export timestamp |
| `collection` | yes | Full collection payload |

## Collection payload

| Field | Required | Description |
|-------|----------|-------------|
| `id` | yes | Original collection id (remapped on import) |
| `name` | yes | Display name |
| `type` | yes | `user` or `generated` |
| `createdAt` | yes | ISO 8601 |
| `updatedAt` | yes | ISO 8601 |
| `isDirty` | no | Dirty flag from source |
| `tree` | yes | Full `TreeDocument` (see Workspace v1) |
| `requests` | yes | Map of request id → stored request object |

## Import behavior

On import, conforming implementations:

1. Validate `specVersion === "1"`
2. Assign a new collection id (`collection-NNN`)
3. Remap all request ids to avoid collisions
4. Resolve name conflicts (append `(Imported)` suffix if needed)
5. Strip `sourceKey` / source linkage from exported requests
6. Write files under `.apiscope/collections/{newId}/`

Imported collections are always type `user`.

## Export behavior

On export, conforming implementations:

1. Serialize collection metadata, tree, and all requests
2. Omit or clear scanner-specific source keys for portability
3. Suggest filename from collection name: `my-api-tests.apiscope.json`

## File naming

Suggested pattern: `{slugified-collection-name}.apiscope.json`

Non-alphanumeric characters in the collection name become hyphens.

## Conformance

Implementers must:

1. Read and write `specVersion: "1"` documents
2. Include complete `tree` and `requests` maps
3. Remap ids on import without data loss
4. Reject documents with unsupported spec versions with a clear error

## Related documents

- [Workspace v1](/specification/workspace/v1/) — on-disk collection layout
- [Architecture Decisions](/specification/adr/)
