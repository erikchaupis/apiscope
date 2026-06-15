# Development

Guide for building APIScope from source and working on the extension.

## Prerequisites

- Node.js 18+
- VS Code or Cursor

## Build

```bash
npm run install:all
npm run build
```

Press **F5** to launch the Extension Development Host with a sample project under `sample-projects/`.

## Package a VSIX

Use [@vscode/vsce](https://github.com/microsoft/vscode-vsce) to produce a `.vsix` installable in VS Code, Cursor, or Open VSX.

### 1. Build

```bash
npm run install:all
npm run build
```

`vsce package` also runs the `vscode:prepublish` script, which calls `npm run build` — but building first catches compile errors before packaging.

### 2. Create the VSIX

```bash
npx @vscode/vsce package
```

This writes `api-scope-<version>.vsix` in the repo root (for example `api-scope-1.0.0.vsix`, from `name` and `version` in `package.json`). The file is gitignored.

### 3. Verify contents

Confirm the webview assets are included (required for the UI to load):

```bash
npm run verify:package
```

To inspect the full file list:

```bash
npx @vscode/vsce ls
```

Packaging respects [`.vscodeignore`](.vscodeignore): extension output under `dist/`, built webview assets under `webview-ui/dist/`, and `media/` are included; source, sample projects, and dev tooling are excluded.

### 4. Install locally

**VS Code / Cursor — command line:**

```bash
code --install-extension api-scope-1.0.0.vsix
```

On Cursor, use the `cursor` CLI if available:

```bash
cursor --install-extension api-scope-1.0.0.vsix
```

**VS Code / Cursor — UI:** Extensions view → `…` menu → **Install from VSIX…** → select the file.

Reload the window after installing.

### 5. Publish (optional)

**Visual Studio Marketplace** — create a [publisher](https://marketplace.visualstudio.com/manage), then:

```bash
npx @vscode/vsce login <publisher>
npx @vscode/vsce publish
```

**Open VSX** — use [ovsx](https://github.com/eclipse/openvsx):

```bash
npx ovsx publish api-scope-1.0.0.vsix -p <OPEN_VSX_TOKEN>
```

Bump `version` in `package.json` before each marketplace release.

## Sample projects

| Project | Framework | Path |
|---------|-----------|------|
| Spring Demo | Spring Boot | `sample-projects/spring-demo` |
| Spring Auth Session | Spring Boot + form login | `sample-projects/spring-auth-session` |
| Files API | Express (Node.js) | `sample-projects/files-api-nodejs` |
| JWT API | FastAPI | `sample-projects/jwt-api-fastapi` |

## Architecture

```text
src/
├── core/              Shared types
├── storage/           .apiscope file I/O
├── scanner/           FrameworkScanner interface
├── spring-scanner/    Spring Boot
├── express-scanner/   Express
├── fastapi-scanner/   FastAPI
├── collections/       CollectionManager + import/export
├── environment/       Environment variables
├── authentication/    Session auth + secret storage
├── request-executor/  HTTP client
└── webview-ui/        React UI
```

## Documentation site

The public site at [getapiscope.com](https://getapiscope.com) is a [VitePress](https://vitepress.dev/) app under `docs/`.

### Layout

```text
docs/
├── .vitepress/
│   ├── config.ts          Site config, nav, sidebar
│   └── theme/             Custom theme (brand.css)
├── guide/                 User guide pages
├── specification/         File format specs
├── index.md               Home page
├── public/
│   ├── CNAME              Custom domain (getapiscope.com)
│   ├── logo.png
│   └── images/            Screenshots for guide pages and README
└── package.json
```

### Commands

Run these from the repo root:

| Command | Description |
|---------|-------------|
| `npm run docs:install` | Install VitePress dependencies (`docs/package.json`) |
| `npm run docs:dev` | Start local dev server with hot reload (default: http://localhost:5173) |
| `npm run docs:build` | Build static site to `docs/.vitepress/dist/` |
| `npm run docs:preview` | Serve the production build locally for a final check |

Typical workflow:

```bash
npm run docs:install   # first time, or after docs/package.json changes
npm run docs:dev       # edit pages under docs/ and preview live
npm run docs:build     # verify the site builds cleanly
npm run docs:preview   # optional — preview the built output
```

### Adding content

- **Guide pages** — add or edit Markdown under `docs/guide/`, then register the page in the sidebar in `docs/.vitepress/config.ts`.
- **Specifications** — add pages under `docs/specification/` and update the spec sidebar in the same config file.
- **Home page** — edit `docs/index.md` (hero, features, screenshots).
- **Screenshots** — save PNGs in `docs/public/images/` and reference them in Markdown as `/images/your-screenshot.png`. The same images are used by the root `README.md`.

### Deploy

Pushes to `main` that touch `docs/**` trigger [`.github/workflows/docs.yml`](.github/workflows/docs.yml), which builds the site and deploys to GitHub Pages.

**Base path:** the site is served at [getapiscope.com](https://getapiscope.com) via GitHub Pages with a custom domain (`docs/public/CNAME`). CI and local dev both use `base: /`.

Preview a production build locally:

```bash
npm run docs:build
npm run docs:preview
```

To deploy manually, build the site and upload `docs/.vitepress/dist/` to your static host.

## License

Apache-2.0
