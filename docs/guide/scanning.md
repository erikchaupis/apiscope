# Scanning Endpoints

APIScope discovers REST endpoints by parsing your project source code. No Swagger or OpenAPI file is required.

## Supported frameworks

| Framework | `frameworkId` | What is scanned |
|-----------|---------------|-----------------|
| Spring Boot | `spring` | `@RestController`, `@RequestMapping`, `@GetMapping`, `@PostMapping`, … |
| Express | `express` | `app.get()`, `router.post()`, etc. in JS/TS files |
| FastAPI | `fastapi` | `@app.get`, `@router.post`, APIRouter mounts |

Scanners plug in via the `FrameworkScanner` interface. Additional frameworks can be added without changing core code.

## Run a scan

1. Open a workspace containing a supported project.
2. Run **APIScope: Scan Endpoints** or use the **Scan** tab → **Scan Now**.
3. APIScope detects the framework, parses routes, and merges results into the Generated Collection.

On first open, APIScope may scan automatically if no Generated Collection exists yet.

![Scan tab — Spring Boot, 3 controllers, 13 endpoints](/images/scan-summary.png)

## Scan summary

After each scan, `scans/last-scan.json` records:

- Framework id and label
- Controller / router count and endpoint count
- Added, updated, and removed endpoint labels
- Timestamp

The Scan tab displays this summary with color-coded `+` / `~` / `-` labels.

## Rescan

**APIScope: Rescan Project** (or right-click Generated Collection → **Rescan**) runs a full rescan.

If the Generated Collection has unsaved edits (`isDirty`), APIScope asks for confirmation before merging.

<!-- Screenshot: scan-rescan-warning.png -->

Merge rules preserve user-added folders and requests where possible. Endpoints removed from source are dropped from the generated tree.

## Source linkage

Each scanned request stores:

| Field | Example | Purpose |
|-------|---------|---------|
| `sourceFile` | `UserController.java` | Relative path to source |
| `sourceKey` | `UserController:GET:/users` | Stable identity for merge |
| `path` | `/users` | Route path template |
| `line` | `42` | Optional line number |

Use **Open Source** (sidebar context menu or **APIScope: Open Source**) to navigate to the endpoint definition.

<!-- Screenshot: open-source.png -->

## Base URL detection

During scan, APIScope also detects a default base URL for the **Generated Environment**:

- **Spring:** `server.port` from `application.properties` or `application.yml`
- **Express:** port from `listen()` call or `PORT` env default
- **FastAPI:** Uvicorn host/port from project files

The result is stored as `{{baseUrl}}` in `environments/generated/environment.json`.

## Validation scripts

The repository includes sample validation scripts:

```bash
npm run validate:spring-sample
npm run validate:express-sample
npm run validate:fastapi-sample
```

These verify scanner output against the sample projects under `sample-projects/`.
