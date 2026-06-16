# Changelog

## 1.0.1

- Lazy `.apiscope` folder — created only when needed (collections, scan, etc.), not on project open
- Spring request bodies — Java records and validation annotations (`@NotBlank`, `@Email`, `@Size`, etc.)
- Spring controllers with multiple POST/PUT methods get the correct body per endpoint

## 1.0.0

- Scan and test APIs from source for **Spring Boot**, **Node.js / Express**, and **FastAPI**
- Generated collections, environments, request editor, auth, and history
- Portable `.apiscope/` workspace beside your project
