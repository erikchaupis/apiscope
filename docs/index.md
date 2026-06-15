---
layout: home

hero:
  name: APIScope
  text: Source-code-aware API client
  tagline: Discover REST endpoints from your codebase, generate collections automatically, and test with browser-like authentication — inside VS Code and Cursor.
  image:
    src: /logo.png
    alt: APIScope logo
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: Specifications
      link: /specification/
    - theme: alt
      text: View on GitHub
      link: https://github.com/erikchaupis/apiscope

features:
  - icon: 🔍
    title: Scan from source
    details: Spring Boot, Express, and FastAPI scanners discover endpoints without Swagger or OpenAPI files.
  - icon: 📁
    title: Generated Collection
    details: Endpoints appear grouped by controller or router, with links back to source code.
  - icon: 💾
    title: Local-first workspace
    details: Collections, environments, history, and scans live in a portable `.apiscope/` directory beside your project.
  - icon: 🔐
    title: Session authentication
    details: Programmatic form login captures cookies and JWTs — credentials stay in VS Code Secret Storage, never on disk.
  - icon: ⚡
    title: Full request editor
    details: Headers, query params, JSON and multipart bodies, pre/post scripts, response tests, and file download handling.
  - icon: 📋
    title: Open specifications
    details: File formats are documented for interoperability across extensions, CLI, and future tools.
---

## See it in action

![APIScope main panel — collections tree, request editor, and JSON response](/images/hero-main-panel.png)

The **Collections** sidebar gives quick access to scanned endpoints, environments, authentication, history, and scan. Requests show color-coded HTTP method badges; generated collections use a sparkle icon:

![Collections sidebar — shortcuts, generated collection tree, and method badges](/images/activity-bar-collections.png)

## Supported frameworks

| Framework | Detection | Base URL |
|-----------|-----------|----------|
| Spring Boot | `@RestController`, `@GetMapping`, … | `server.port` from `application.properties` / `.yml` |
| Express (Node.js) | Route definitions in JS/TS | Port from `process.env.PORT` or app listen call |
| FastAPI (Python) | `@app.get`, router decorators | Uvicorn / app config |

## Quick start

1. Install the APIScope extension in VS Code or Cursor.
2. Open a project that contains a supported framework.
3. Click the **APIScope** icon in the activity bar, then run **Scan Endpoints**.
4. Select a request from the **Generated Collection** and press **Send** (`⌘↵` on macOS, `Ctrl+Enter` on Windows/Linux).

See the [Getting Started guide](/guide/getting-started) for a full walkthrough.

## Documentation

- [User guide](/guide/getting-started) — install, scan, send requests, authenticate
- [Specifications](/specification/) — `.apiscope/` workspace and history formats

## Development

The extension source lives on [GitHub](https://github.com/erikchaupis/apiscope). To build locally:

```bash
npm run install:all
npm run build
npx vitepress build docs
```

Press **F5** to launch the Extension Development Host with a sample workspace under `sample-projects/`.
