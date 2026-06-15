# Runtime Variables

Runtime variables are **in-memory values** generated or extracted during request execution. They are available across requests in the same APIScope session but are **never saved to disk** — they clear when you close VS Code or Cursor.

Use them to chain requests: generate test data, extract tokens from responses, and reuse values in the next call without editing environment files.

## Viewing runtime variables

Open the **Environments** tab and select the active environment. Below **Environment Variables**, the **Runtime Variables (Memory Only)** section lists every value currently in memory.

![Runtime variables in the Environments tab](/images/runtime-variables-environments.png)

From each row you can:

- **Copy Value** — paste into another field or tool
- **Promote to Environment Variable** — move the value into the selected environment (persisted to disk)
- **Delete Variable** — remove a single runtime entry

Use **Clear Runtime Variables** to wipe the entire runtime store at once.

## How values are created

Runtime variables come from three sources on the request editor:

| Source | When it runs | Persists to disk |
|--------|--------------|------------------|
| Pre-request variables | Before send | No — stored in runtime |
| Post-request extraction | After response | No — stored in runtime |
| Pre/post scripts (`env.set`) | Before or after send | No — stored in runtime |

### Pre-request variables

On the **Variables → Pre** tab, add generators that produce a fresh value on every send:

![Pre-request variables — UUID, timestamp, random email](/images/request-pre-variables.png)

Supported types: UUID, Timestamp, Random Number, Random String, Random Email, and Static Value. Reference them with `{{variableName}}` in the URL, headers, or body.

### Post-request extraction

On the **Variables → Post** tab, map response fields into runtime variables for later requests:

![Post-request extraction — Response Body → emailres](/images/request-post-variables.png)

Click **+ Extract Variable** to add a mapping from the response body, a header, or a cookie. Each extraction can be enabled or disabled independently.

### Scripts

Pre- and post-request scripts can read and write runtime variables through the `env` API:

![Pre-request script — env.set("authenticated", "true")](/images/request-pre-script.png)

```javascript
env.get("token");           // Request → Runtime → Environment
env.set("authenticated", "true");
env.unset("token");
env.clear();
```

Open **Documentation** in the script panel for the full APIScope script API.

## Variable resolution

When APIScope substitutes `{{name}}` or scripts call `env.get()`, values resolve in this order (highest priority last):

1. **Environment variables** — persisted in `.apiscope/environments/`
2. **Runtime variables** — memory only
3. **Request-scoped pre variables** — generated for the current send

A request-scoped pre variable with the same name overrides a runtime value, which in turn overrides an environment variable.

## Example flow

Using the **POST Echo** request in a Spring Boot sample:

1. **Pre** tab generates `uuid`, `date`, and `email` before send
2. **Post** tab extracts `emailres` from the response body field `email`
3. **Pre** script sets `authenticated` to `"true"`
4. The **Environments** tab shows all five runtime values after send

Subsequent requests in the same session can reference `{{uuid}}`, `{{emailres}}`, or `{{authenticated}}` without re-running the echo call.

## Related

- [Environments](/guide/environments) — persisted variables and `{{baseUrl}}`
- [Sending Requests](/guide/requests) — full request editor, scripts, and tests
