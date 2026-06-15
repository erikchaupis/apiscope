# Getting Started

APIScope is a VS Code / Cursor extension that discovers API endpoints from your source code and lets you send HTTP requests without leaving the editor.

## Install

Install APIScope from the VS Code Marketplace or Open VSX, or load it from source:

1. Clone [github.com/erikchaupis/apiscope](https://github.com/erikchaupis/apiscope)
2. Run `npm run install:all && npm run build`
3. Press **F5** to open the Extension Development Host

## Open APIScope

After opening a workspace with a supported project:

1. Click the **APIScope** icon in the activity bar (left sidebar).
2. Or run **APIScope: Open APIScope** from the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`).

![APIScope sidebar header with brand icon](/images/activity-bar-icon.png)

The **Collections** sidebar opens on the left. Shortcut rows at the top link to **Environments**, **Global Authentication**, **History**, and **Scan**. Below them, each collection shows as a tree with controller folders and color-coded HTTP method badges on every request.

![Collections sidebar — shortcuts, generated collection tree, and method badges](/images/activity-bar-collections.png)

The main panel opens with a request editor, response viewer, and tabs for **Environments**, **History**, **Scan**, and **Authentication**.

![Main APIScope panel — request editor and response](/images/hero-main-panel.png)

## First scan

1. Open a sample project such as `sample-projects/spring-demo`, `sample-projects/files-api-nodejs`, or `sample-projects/jwt-api-fastapi`.
2. Run **APIScope: Scan Endpoints** from the Command Palette, or use the **Scan** tab.
3. APIScope detects the framework, reads route definitions, and creates a **Generated Collection**.

![Scan tab — framework, controllers, endpoints, and change summary](/images/scan-summary.png)

Endpoints are grouped by controller or router file. Each scanned request includes a **source link** — click **Open Source** to jump to the implementing code.

![Generated Collection — controller folders with GET/POST method badges](/images/collections-tree.png)

## Send your first request

1. Click a request in the collections sidebar or main panel.
2. Confirm the URL uses `{{baseUrl}}` — APIScope resolves this from the active environment.
3. Press **Send** or use `⌘↵` (macOS) / `Ctrl+Enter` (Windows/Linux).

![Request editor with response — GET /api/tickets](/images/request-editor.png)

The response appears beside the request editor with status, timing, headers, and body. JSON responses are pretty-printed automatically.

## Workspace data

APIScope stores everything under `.apiscope/` in your project root:

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

See the [Workspace Specification](/specification/workspace/v1/) for the full layout.

By default, generated collections, environments, scans, history, drafts, and downloads are listed in `.apiscope/.gitignore` so local testing data does not pollute your repository.

## Sample projects

| Project | Framework | Path |
|---------|-----------|------|
| Spring Demo | Spring Boot | `sample-projects/spring-demo` |
| Spring Auth Session | Spring Boot + form login | `sample-projects/spring-auth-session` |
| Files API | Express (Node.js) | `sample-projects/files-api-nodejs` |
| JWT API | FastAPI | `sample-projects/jwt-api-fastapi` |

## Next steps

- [Collections](/guide/collections) — user collections, import/export, folders
- [Scanning](/guide/scanning) — rescan, dirty state, supported annotations
- [Environments](/guide/environments) — variables and `{{baseUrl}}`
- [Runtime Variables](/guide/runtime-variables) — in-memory values from pre/post extraction and scripts
- [Authentication](/guide/authentication) — session login and per-request auth
- [Themes](/guide/themes) — APIScope Light, Solar, Classic palettes
