# APIScope

<p align="center">
  <img src="media/logo.png" alt="APIScope" width="80" />
</p>

<p align="center">
  <img src="docs/public/images/hero-main-panel.png" alt="APIScope main panel — collections tree, request editor, and JSON response" width="900" />
</p>

APIScope is a source-code-aware API client for VS Code and Cursor. It reads your application source code and turns controllers, routers, and endpoint definitions into a ready-to-use API client — inside your editor. A practical alternative when you want to work directly from the codebase rather than specs or hand-maintained collections.

- Discover and test APIs directly from source code
- Scan Spring Boot, Express, and FastAPI applications
- Automatically generate API collections from source code
- Source-code-first — works alongside OpenAPI and Swagger when those are part of your workflow
- Collections stay in sync when you rescan
- Useful for internal APIs, legacy systems, and codebases where the source is the best reference

**Documentation:** [getapiscope.com](https://getapiscope.com)

## Why APIScope?

When the codebase is the most accurate picture of your API — or when you simply prefer working from source — exploring endpoints often means reading code in one place and rebuilding requests elsewhere.

APIScope offers a direct path: scan application source code, generate collections from controllers, routers, and endpoint definitions, and send requests without leaving the editor.

```text
Source Code → APIScope → Send Request
```

## Ideal For

- Backend developers exploring unfamiliar codebases
- Projects where source code reflects the current API surface
- Internal enterprise APIs
- Legacy applications
- Developers who live inside VS Code or Cursor

## See it in action

The **Collections** sidebar gives quick access to scanned endpoints, environments, authentication, history, and scan. Requests show color-coded HTTP method badges; generated collections use a sparkle icon:

![Collections sidebar — shortcuts, generated collection tree, and method badges](docs/public/images/activity-bar-collections.png)

Scan your workspace to discover endpoints grouped by controller or router:

![Scan tab — framework, controllers, endpoints, and change summary](docs/public/images/scan-summary.png)

Send requests with headers, body, scripts, and response tests:

![Request editor with response — GET /api/tickets](docs/public/images/request-post-script.png)

## Features

- **Discover endpoints directly from source code** — Spring Boot, Express, and FastAPI scanners
- **Generate ready-to-use API collections automatically** — grouped by controller or router, refreshed on rescan
- **Keep your own collections separate** — create, import, and export user collections that rescans never overwrite
- **Switch environments without retyping URLs** — `{{baseUrl}}` variables with tier badges (LOCAL, DEV, PROD, …)
- **Configure global authentication per environment** — session, bearer, basic, and API key; credentials stored in VS Code Secret Storage
- **Send and inspect requests in one panel** — headers, JSON/multipart body, scripts, and response tests
- **Replay past requests and draft new ones** — execution history and ad-hoc draft tabs
- **Handle file downloads from API responses** — binary preview and persistence

## Supported frameworks

| Framework | Detection | Base URL |
|-----------|-----------|----------|
| Spring Boot | `@RestController`, `@GetMapping`, … | `server.port` from `application.properties` / `.yml` |
| Express (Node.js) | Route definitions in JS/TS | Port from `process.env.PORT` or app listen call |
| FastAPI (Python) | `@app.get`, router decorators | Uvicorn / app config |

## Quick start

1. Install APIScope from the [VS Code Marketplace](https://marketplace.visualstudio.com/) or [Open VSX](https://open-vsx.org/).
2. Open a project that contains a supported framework.
3. Click the **APIScope** icon in the activity bar, then run **Scan Endpoints**.
4. Select a request from the **Generated Collection** and press **Send** (`⌘↵` on macOS, `Ctrl+Enter` on Windows/Linux).

See the [Getting Started guide](https://getapiscope.com/guide/getting-started) for a full walkthrough, including sample projects.

## Commands

| Command | Description |
|---------|-------------|
| `APIScope: Open APIScope` | Open the main panel |
| `APIScope: Scan Endpoints` | Scan workspace and refresh collections |
| `APIScope: Open Global Authentication` | Configure session, bearer, basic, or API key auth |

Full list: [getapiscope.com/guide/commands](https://getapiscope.com/guide/commands)

## Workspace data

APIScope stores collections, environments, history, and scans in a portable `.apiscope/` directory beside your project:

```text
.apiscope/
├── config.json
├── collections/
├── environments/
├── scans/
├── history/
├── drafts/
└── downloads/
```

See the [Workspace Specification](https://getapiscope.com/specification/workspace/v1/) for details.

## Documentation

- [User guide](https://getapiscope.com/guide/getting-started) — install, scan, send requests, authenticate
- [Specifications](https://getapiscope.com/specification/) — `.apiscope/` workspace and history formats

## Development

To build from source, run the docs site locally, or explore the architecture, see [DEVELOPMENT.md](DEVELOPMENT.md).

## License

Apache-2.0
