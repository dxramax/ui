# ui

This repository is the standalone home for the publishable shared BL UI runtime
package originally extracted from `engine/packages/business/ui`.

The package sources continue to use `/home/dxramax/projects/engine` as the
builder and canonical business-source reference during local development.

It currently includes:

- object guard support modules:
  - `system/object_guard/object_guard.functions.bl`
  - `system/object_guard/object_guard.classes.bl`
  - `system/object_guard/object_guard.tables.bl`
- runtime object support modules required by the UI runtime:
  - `system/runtime_object/runtime_object.functions.bl`
  - `system/runtime_object/runtime_object.types.bl`
- runtime UI support modules:
  - `system/ui/runtime.bl`
  - `system/ui/runtime_ui.metadata.functions.bl`
  - `system/ui/runtime_ui.binding.functions.bl`
  - `system/ui/runtime_ui.execution.functions.bl`
  - `system/ui/runtime_ui.controls.functions.bl`
  - `system/ui/runtime_ui.functions.bl`
  - `system/ui/runtime_ui.types.bl`
  - `system/ui/runtime_ui.messages.bl`
  - `system/ui/runtime_ui_session.functions.bl`
  - `system/ui/runtime_ui.tables.bl`
  - `system/ui/runtime_ui_dispatch.functions.bl`

This package is intentionally `source-only`.

It publishes only the reusable runtime UI modules. Business-specific forms such as customer and company code stay in the main `business` sources and are not part of this package.

Exports:

- `./object-guard/functions`
- `./object-guard/classes`
- `./object-guard/tables`
- `./runtime`
- `./runtime-object/functions`
- `./runtime-object/types`
- `./runtime/functions`
- `./runtime/types`
- `./runtime/messages`
- `./runtime/session`
- `./runtime/tables`
- `./runtime/dispatch`

Standalone workflow:

```sh
cd /home/dxramax/projects/ui
node ./scripts/nzm.mjs pack
node ./scripts/nzm.mjs publish --registry https://packages.nezam.ai
```

The wrapper resolves `ENGINE_REPO_ROOT` from the environment, or falls back to
`/home/dxramax/projects/engine`.

Direct publish with an explicit token file:

```sh
cd /home/dxramax/projects/ui
ENGINE_REPO_ROOT=/home/dxramax/projects/engine \
node ./scripts/nzm.mjs publish \
  --registry https://packages.nezam.ai \
  --token-file /run/secrets/packages-publish-token
```

The same pack and publish commands also work from a deep package subdirectory,
for example:

```sh
cd /home/dxramax/projects/ui/src/system/ui
node ../../../scripts/nzm.mjs pack
node ../../../scripts/nzm.mjs publish --registry https://packages.nezam.ai
```

Direct publish with an environment-provided token file:

```sh
cd /home/dxramax/projects/ui
NEZAM_PUBLISH_TOKEN_FILE=/run/secrets/packages-publish-token \
  node ./scripts/nzm.mjs publish --registry https://packages.nezam.ai
```

Direct publish with the standard mounted secret path:

```sh
cd /home/dxramax/projects/ui
node ./scripts/nzm.mjs publish --registry https://packages.nezam.ai
```

This works when `/run/secrets/packages-publish-token` is present on the machine.

Consume the published package from the registry from an engine package:

```sh
cd packages/ui-widgets
node ../package-manager/src/cli.js add ui --source registry --range 0.1.2 --registry https://packages.nezam.ai
node ../package-manager/src/cli.js install
```

The same registry dependency flow works for other consumers such as `packages/ui-erp`.

Consumers that want a single BL import surface can now use the aggregate
runtime export instead of importing each runtime module separately.

## Object Guard Usage

The published `object_guard` surface is intended for keyed persisted business
objects that must not be edited concurrently.

Current BL API surface:

- `object_guard_acquire(...)`
- `object_guard_release(...)`
- `object_guard_refresh(...)`
- `object_guard_assert_owner(...)`
- `object_guard_cleanup_expired()`

Recommended edit-form pattern:

```bl
using ui.object-guard.functions;

function edit_bid_bond_on_load(current: BidBond, context: Json) {
  let request = Runtime.json_parse("{}");
  request["target"] = {
    "object_type": "BidBond",
    "object_key": "{\"bg_code\":\"" + current.bg_code + "\"}",
    "object_label": current.bg_code
  };
  request["owner"] = {
    "session_id": Runtime.json_to_str(context["session_id"]),
    "form_instance_id": Runtime.json_to_str(context["form_instance_id"]),
    "user_id": Runtime.json_to_str(context["user_id"]),
    "tenant_id": Runtime.json_to_str(context["tenant_id"])
  };
  let guard = object_guard_acquire(request);
  if (guard["ok"] != true) {
    return;
  }
}

function edit_bid_bond_on_unload(current: BidBond, context: Json) {
  let request = Runtime.json_parse("{}");
  request["target"] = {
    "object_type": "BidBond",
    "object_key": "{\"bg_code\":\"" + current.bg_code + "\"}",
    "object_label": current.bg_code
  };
  request["owner"] = {
    "session_id": Runtime.json_to_str(context["session_id"]),
    "form_instance_id": Runtime.json_to_str(context["form_instance_id"]),
    "user_id": Runtime.json_to_str(context["user_id"]),
    "tenant_id": Runtime.json_to_str(context["tenant_id"])
  };
  object_guard_release(request);
}
```

Current runtime policy:

- same user in a different browser tab or different session is treated as a
  different owner and conflicts
- same session reopening the same guarded object is treated as refresh/reentry,
  not as a second competing owner
- guarded `/ui/apply` requests must carry the same `object_guard` target payload
  so backend mutation can re-assert ownership before persist

Current lease defaults:

- default lease TTL: `90` seconds
- normal close releases immediately through `/ui/session/close`
- active edit sessions refresh through `/ui/session/sync`
- lost browser recovery relies on lease expiry plus backend ownership checks

Current canonical configuration layer:

- the default lease lives in
  `system/object_guard/object_guard.functions.bl` via
  `object_guard_default_ttl_seconds()`
- per-request overrides can be supplied through `ttl_seconds` on acquire/refresh

Phase-1 scope note:

- admin or ops force-release is still deferred follow-up, not part of the
  published phase-1 contract

BL toolbar buttons can now declare first-class menus with authored `on click`
syntax on both the button and its menu options:

```bl
button Paste {
  label: "Paste";
  icon: "clipboard";
  shortcut: "Ctrl+V";
  on click {
    paste(form);
  }

  menu {
    option Values {
      label: "Paste Values";
      description: "Keep values only";
      shortcut: "Ctrl+Shift+V";
      on click {
        paste_values(form);
      }
    }

    separator;

    option Formatting {
      label: "Formatting";
      enabled: false;

      menu {
        option NumberFormat {
          label: "Number Format";
          visible: true;
          on click {
            paste_number_format(form);
          }
        }
      }
      }
    }
  }
```

Supported button/menu option metadata now includes `label`, `description`,
`icon`, `shortcut`, `enabled`, `visible`, and nested `menu` blocks.
