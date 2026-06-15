# Commands Reference

All APIScope commands are available from the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`) under the **APIScope** category.

## Panel & navigation

| Command | Description |
|---------|-------------|
| **APIScope: Open APIScope** | Open the main panel |
| **APIScope: Open Global Authentication** | Open the Authentication tab |
| **APIScope: Manage Environments** | Open the Environments tab |
| **APIScope: Open History Tab** | Open the History tab |
| **APIScope: Open Scan Tab** | Open the Scan tab |
| **APIScope: Open Source** | Jump to source code for a scanned request |

## Scanning

| Command | Description |
|---------|-------------|
| **APIScope: Scan Endpoints** | Scan workspace and refresh Generated Collection |
| **APIScope: Rescan Project** | Full rescan with dirty-state confirmation |

## Authentication

| Command | Description |
|---------|-------------|
| **APIScope: Session Login** | Form login against `{{baseUrl}}/login` and capture cookies |

## Collections tree

| Command | Description |
|---------|-------------|
| **APIScope: Refresh Collections** | Reload collections from disk |
| **APIScope: New Collection** | Create a user collection |
| **APIScope: Import Collection…** | Import a `.apiscope.json` file |
| **APIScope: Export Collection…** | Export a collection to `.apiscope.json` |
| **APIScope: New Folder** | Add folder in selected collection |
| **APIScope: New Request** | Add request in user collection |
| **APIScope: Duplicate Collection** | Copy a collection |
| **APIScope: Delete Collection** | Remove a user collection |
| **APIScope: Rename Collection** | Rename a user collection |
| **APIScope: Rename Folder** | Rename a folder |
| **APIScope: Delete Folder** | Remove a folder |
| **APIScope: Rename Request** | Rename a request |
| **APIScope: Duplicate Request** | Copy a request |
| **APIScope: Delete Request** | Remove a request |

## Keyboard shortcuts

| Action | macOS | Windows / Linux |
|--------|-------|-----------------|
| Send request | `⌘↵` | `Ctrl+Enter` |

Shortcuts are disabled while a modal dialog is open.

## Activation

The extension activates when:

- You open the APIScope view or run an APIScope command
- The workspace contains `pom.xml` or `build.gradle` (Spring projects)

Other frameworks activate on first explicit scan or panel open.
