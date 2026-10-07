# Agents

AI agents and scripts can read and change Hearth's configuration in three ways: through the agent API, through the MCP server, or by editing the files in the data directory. All three end up in the same files, and Hearth handles edits from any of them the same way as edits from the editor.

## Access token

The agent API and the MCP server take a Home Assistant access token as a bearer token. Create a long-lived access token in your Home Assistant profile under Security. Hearth accepts any token Home Assistant accepts for the dashboard, versions and validation. Changing settings or custom CSS needs a token of a Home Assistant administrator, and so does reloading the open screens, which fires a Home Assistant event. Hearth asks Home Assistant who a token belongs to and remembers the answer for a minute.

The editor in the browser follows the same rules with the token of its own Home Assistant connection. See [access](configuration.md#access).

These endpoints are not available through Ingress. With the Home Assistant app, set a port in the app configuration and use that port. With Docker or Node, use the port Hearth listens on.

## MCP server

The MCP server is at `/_api/mcp` and uses the Streamable HTTP transport. It refuses requests from a browser page on another origin. To add it to Claude Code:

```sh
claude mcp add --transport http hearth http://homeassistant.local:8099/_api/mcp \
  --header "Authorization: Bearer <token>"
```

Other clients take the same URL and header.

| Tool                 | Does                                                                                     |
| -------------------- | ---------------------------------------------------------------------------------------- |
| `get_dashboard`      | Returns `hearth.yaml` as YAML text.                                                      |
| `get_schema`         | Returns the JSON Schema outline, or the fields of one card or widget type.               |
| `validate_dashboard` | Checks a complete document without saving it.                                            |
| `save_dashboard`     | Validates and saves a complete document. `refresh: true` reloads every open screen.      |
| `get_settings`       | Returns the server settings from `configuration.yaml`. The access token is not returned. |
| `update_settings`    | Changes server settings. Omitted fields keep their value, `null` clears one. Admin only. |
| `get_custom_css`     | Returns the custom CSS.                                                                  |
| `save_custom_css`    | Replaces the custom CSS. No earlier version is kept. Admin only.                         |
| `list_versions`      | Lists earlier versions of `hearth.yaml`.                                                 |
| `get_version`        | Returns one earlier version. Save its content to restore it.                             |
| `refresh_screens`    | Reloads every open screen.                                                               |

## Agent API

The API takes and returns JSON. Every request needs the `Authorization: Bearer <token>` header.

| Request                               | Body or query                                                      | Answer                                          |
| ------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------- |
| `GET /_api/agent/dashboard`           | `?format=yaml` for the YAML text                                   | `{ revision, config }`                          |
| `PUT /_api/agent/dashboard`           | `{ revision, config }` or `{ revision, yaml }`, `force`, `refresh` | `{ revision }`                                  |
| `POST /_api/agent/validate`           | `{ config }` or `{ yaml }`                                         | `{ valid, issues }`                             |
| `GET /_api/agent/settings`            |                                                                    | `{ revision, locale, ..., token_set }`          |
| `PATCH /_api/agent/settings`          | `{ revision, locale?, custom_js?, motion?, haptics?, token? }`     | `{ revision }`                                  |
| `GET /_api/agent/css`, `PUT` the same | `{ css, refresh? }` for `PUT`                                      | `{ css }`, `{ saved }`                          |
| `GET /_api/agent/versions`            | `?name=<version>` for one version's text                           | `{ revision, versions }` or `{ name, content }` |
| `POST /_api/agent/refresh`            |                                                                    | `{ refreshed }`                                 |

A save answers 409 with the current `revision` when the file changed since you read it, and 422 with a list of `issues` when the document is invalid. Read the file again and reapply your change after a conflict. `force: true` saves over a newer revision.

For example, to rename the first page:

```sh
HEARTH=http://homeassistant.local:8099
AUTH="Authorization: Bearer $TOKEN"
curl -s -H "$AUTH" "$HEARTH/_api/agent/dashboard" \
  | jq '{revision, config: (.config | .rooms[0].name = "Kitchen"), refresh: true}' \
  | curl -s -X PUT -H "$AUTH" -H 'Content-Type: application/json' -d @- \
      "$HEARTH/_api/agent/dashboard"
```

## Schema

`GET /_api/schema` returns a JSON Schema of `hearth.yaml` and needs no token. Editors that use the YAML language server, such as VS Code with the YAML extension, validate the file with it when its first line is:

```yaml
# yaml-language-server: $schema=http://homeassistant.local:8099/_api/schema
```

The schema does not cover every rule. Unique ids, theme values and some rules that span several fields are checked only on save. `validate_dashboard` and `/_api/agent/validate` run the same checks as a save.

## Editing the files

The files are described under [data directory](configuration.md#data-directory). With the Home Assistant app they are in the app's config folder, which the SSH and Samba apps show as `/addon_configs/<id>_ha_hearth`. The `<id>` part depends on the app repository. The files belong to root; when the SSH app logs you in as another user, such as `hassio`, edit them with `sudo`.

Hearth notices a file that changed outside Hearth the next time it reads it. It keeps the version it last wrote under Settings > Versions and moves the file to the next revision. A browser that loaded the earlier revision gets a conflict when it saves, so it cannot overwrite your edit without asking.

When editing `hearth.yaml` by hand:

- Keep `version: 5`. Leave `revision` as it is; Hearth sets it.
- Give every page, card, stack, widget and alert rule an `id` that is unique among its kind.
- A file that does not parse or does not validate locks the editor and shows the error on every screen until it is fixed. Check it with `validate_dashboard` or `/_api/agent/validate` first.

Open screens show a change after a reload. Fire the `HEARTH` event with `event: refresh` (see [alerts](alerts.md#home-assistant-events)), or call `refresh_screens`.
