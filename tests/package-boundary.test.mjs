import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { assertUiConsumerManifestContract } from './consumer-contract-helper.mjs';
import { expectedUiBlFiles, expectedUiPackageFiles } from './inventory-contract-helper.mjs';
import {
  expectedUiExportKeys,
  expectedUiExports,
  expectedUiPackageMetadata
} from './manifest-contract-helper.mjs';
import {
  collectMessageDefinitions,
  collectNamedMatches,
  collectRuntimeUiHttpRoutes,
  listPackageBlFiles,
  listPackageFiles
} from './package-boundary-helper.mjs';
import {
  listPackedBusinessUiEntries,
  packBusinessUiArtifact,
  readPackedBusinessUiFile
} from './packed-artifact-helper.mjs';
import { runBusinessUiNoAuthPublish } from './publish-boundary-helper.mjs';
import {
  assertRuntimeUiRoutesPresent,
  expectedRuntimeUiHttpRoutes
} from './route-contract-helper.mjs';
import {
  businessUiPackageRoot,
  businessUiSourceManifestPath,
  readBusinessUiOwnExportSource,
  readBusinessUiOwnPackage,
  resolveBusinessUiSourceExportPath
} from './source-package-helper.mjs';

const packageRoot = businessUiPackageRoot;
const manifestPath = businessUiSourceManifestPath;

test('business/ui keeps a stable source-only package contract for shared UI runtime modules', () => {
  const { manifest: pkg } = readBusinessUiOwnPackage();

  assertUiConsumerManifestContract(pkg);
  assert.equal(pkg.description, expectedUiPackageMetadata.description);
  assert.equal(pkg.license, expectedUiPackageMetadata.license);
  assert.deepEqual(pkg.keywords, expectedUiPackageMetadata.keywords);
  assert.deepEqual(pkg.authors, expectedUiPackageMetadata.authors);
  assert.equal(pkg.repository?.directory, undefined);

  assert.deepEqual(Object.keys(pkg.exports || {}), expectedUiExportKeys);

  for (const exportKey of Object.keys(pkg.exports || {})) {
    const exportPath = resolveBusinessUiSourceExportPath(manifestPath, pkg, exportKey);
    assert.equal(fs.existsSync(exportPath), true, `expected file ${exportPath}`);
  }

  assert.equal(pkg.exports['./customer'], undefined);
  assert.equal(pkg.exports['./companycode'], undefined);
});

test('business/ui source tree keeps the exact package-local file inventory', () => {
  assert.deepEqual(listPackageFiles(packageRoot), expectedUiPackageFiles);
});

test('business/ui bl source inventory stays intentional and contract-backed', () => {
  const { manifest: pkg } = readBusinessUiOwnPackage();
  const exportedBlPaths = Object.values(pkg.exports || {})
    .filter((entry) => entry?.kind === 'bl-module')
    .map((entry) => String(entry.path))
    .sort();
  const publicBlPaths = expectedUiExportKeys
    .filter((exportKey) => exportKey !== './readme')
    .map((exportKey) => String(pkg.exports?.[exportKey]?.path || ''))
    .sort();

  assert.deepEqual(listPackageBlFiles(packageRoot), expectedUiBlFiles);
  assert.deepEqual(exportedBlPaths, publicBlPaths);
});

test('business/ui manifest keeps the exact export path mapping for the packaged runtime surface', () => {
  const { manifest: pkg } = readBusinessUiOwnPackage();

  assert.deepEqual(pkg.exports, expectedUiExports);
});

test('business/ui manifest keeps export and readme paths inside the package root', () => {
  const { manifest: pkg } = readBusinessUiOwnPackage();

  assert.equal(pkg.readme?.path, 'README.md');
  assert.equal(pkg.exports?.['./readme']?.path, 'README.md');

  for (const [exportKey, entry] of Object.entries(pkg.exports || {})) {
    const relativePath = String(entry?.path || '');
    const resolvedPath = resolveBusinessUiSourceExportPath(manifestPath, pkg, exportKey);

    assert.notEqual(relativePath.trim(), '');
    assert.equal(path.isAbsolute(relativePath), false);
    assert.equal(relativePath.includes('..'), false);
    assert.equal(resolvedPath.startsWith(`${packageRoot}${path.sep}`) || resolvedPath === path.join(packageRoot, 'README.md'), true);
  }

  for (const artifact of pkg.artifacts || []) {
    assert.equal(typeof artifact.id, 'string');
    assert.notEqual(artifact.id.trim(), '');
    assert.equal(typeof artifact.kind, 'string');
    assert.notEqual(artifact.kind.trim(), '');
    assert.equal(artifact.required, true);
    assert.equal(artifact.public, true);
  }
});

test('business/ui readme stays aligned with the packaged source-only contract', () => {
  const { manifest: pkg, source: readmeSource } = readBusinessUiOwnExportSource('./readme');

  assert.match(readmeSource, /standalone home/i);
  assert.match(readmeSource, /source-only/i);
  assert.match(readmeSource, /customer and company code stay in the main `business` sources/i);
  assert.match(readmeSource, /system\/runtime_object\/runtime_object\.functions\.bl/);
  assert.match(readmeSource, /system\/runtime_object\/runtime_object\.types\.bl/);
  assert.match(readmeSource, /system\/ui\/runtime\.bl/);
  assert.match(readmeSource, /system\/ui\/runtime_ui\.functions\.bl/);
  assert.match(readmeSource, /system\/ui\/runtime_ui\.messages\.bl/);
  assert.match(readmeSource, /system\/ui\/runtime_ui_session\.functions\.bl/);
  assert.match(readmeSource, /system\/ui\/runtime_ui_dispatch\.functions\.bl/);
  assert.match(readmeSource, /node \.\/scripts\/nzm\.mjs pack/);
  assert.match(
    readmeSource,
    /cd packages\/ui-widgets[\s\S]*node \.\.\/package-manager\/src\/cli\.js add ui --source registry --range 0\.1\.2 --registry https:\/\/packages\.nezam\.ai[\s\S]*node \.\.\/package-manager\/src\/cli\.js install/
  );
  assert.match(readmeSource, /The same registry dependency flow works for other consumers such as `packages\/ui-erp`\./);
  assert.match(readmeSource, /single BL import surface/i);
  assert.match(
    readmeSource,
    /cd \/home\/dxramax\/projects\/ui\/src\/system\/ui[\s\S]*node \.\.\/\.\.\/\.\.\/scripts\/nzm\.mjs pack/
  );
  assert.match(
    readmeSource,
    /cd \/home\/dxramax\/projects\/ui\/src\/system\/ui[\s\S]*node \.\.\/\.\.\/\.\.\/scripts\/nzm\.mjs publish --registry https:\/\/packages\.nezam\.ai/
  );
  assert.match(readmeSource, /packages\.nezam\.ai/);

  for (const exportKey of Object.keys(pkg.exports || {})) {
    if (exportKey === './readme') {
      continue;
    }
    assert.match(
      readmeSource,
      new RegExp(exportKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    );
  }
});

test('business/ui aggregate runtime export re-exports the packaged runtime surface', () => {
  const { source: runtimeSource } = readBusinessUiOwnExportSource('./runtime');

  assert.match(runtimeSource, /export \* from "ui\/runtime-object\/functions"/);
  assert.match(runtimeSource, /export \* from "ui\/runtime-object\/types"/);
  assert.match(runtimeSource, /export \* from "ui\/runtime\/functions"/);
  assert.match(runtimeSource, /export \* from "ui\/runtime\/types"/);
  assert.match(runtimeSource, /export \* from "ui\/runtime\/messages"/);
  assert.match(runtimeSource, /export \* from "ui\/runtime\/session"/);
  assert.match(runtimeSource, /export \* from "ui\/runtime\/tables"/);
  assert.match(runtimeSource, /export \* from "ui\/runtime\/dispatch"/);
});

test('business/ui runtime export keeps the canonical ui-widget route surface', () => {
  const { source: runtimeFunctionsSource } = readBusinessUiOwnExportSource('./runtime/functions');

  assertRuntimeUiRoutesPresent(runtimeFunctionsSource, expectedRuntimeUiHttpRoutes);
});

test('business/ui runtime app lookup accepts canonical normalized app aliases', () => {
  const runtimeMetadataSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );

  assert.match(runtimeMetadataSource, /private function runtime_ui_resolve_node_normalized_symbol_name\(node_json: Json\): string \{/);
  assert.match(runtimeMetadataSource, /return Runtime\.json_to_str\(\s*runtime_ui_property_value\(identifier_node_json, "normalized_symbol_name"\)\s*\);/);
  assert.match(runtimeMetadataSource, /private function runtime_ui_matches_app_id\(app_node_json: Json, app_id: string\): bool \{/);
  assert.match(runtimeMetadataSource, /let canonical_app_id = Runtime\.json_to_str\(\s*runtime_ui_published_property_value\(app_node_json, "app_id"\)\s*\);/s);
  assert.match(runtimeMetadataSource, /if \(canonical_app_id == normalized_app_id\) \{\s*return true;\s*\}/);
  assert.match(runtimeMetadataSource, /let normalized_symbol_name = runtime_ui_resolve_node_normalized_symbol_name\(app_node_json\);/);
  assert.match(runtimeMetadataSource, /if \("app\." \+ normalized_symbol_name == normalized_app_id\) \{\s*return true;\s*\}/);
  assert.match(runtimeMetadataSource, /return "app\/" \+ normalized_symbol_name == normalized_app_id;/);
  assert.match(runtimeMetadataSource, /let app_nodes = ast\.list_nodes_by_kind\("appDeclaration"\) \?\? \[\];/);
  assert.match(runtimeMetadataSource, /if \(runtime_ui_matches_app_id\(app_node_json, normalized_app_id\)\) \{\s*return app_node_json;\s*\}/);
  assert.match(runtimeMetadataSource, /return null;/);
});

test('business/ui runtime metadata resolves state-field names from the declaration node before identifier fallbacks', () => {
  const runtimeMetadataSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );

  assert.match(runtimeMetadataSource, /private function runtime_ui_build_state_field_metadata\(state_node_json: Json\): Json \{/);
  assert.match(runtimeMetadataSource, /let value_type = runtime_ui_find_first_descendant_symbol_name\(type_expression_node_id\);/);
  assert.match(runtimeMetadataSource, /let field_name = runtime_ui_resolve_node_symbol_name\(state_node_json\);/);
  assert.match(runtimeMetadataSource, /if \(field_name == "" \|\| field_name == value_type\) \{\s*let descendant_symbol_names = runtime_ui_collect_descendant_symbol_names\(state_node_id\);/s);
  assert.match(runtimeMetadataSource, /if \(\s*normalized_descendant_symbol_name == ""\s*\|\|\s*normalized_descendant_symbol_name == value_type\s*\) \{\s*continue;\s*\}/s);
  assert.match(runtimeMetadataSource, /if \(field_name == "" \|\| field_name == value_type\) \{\s*let identifier_node_id = runtime_ui_find_child_node_id_by_kind\(state_node_id, "identifier"\);\s*field_name = runtime_ui_direct_node_symbol_name\(ast\.node_to_json\(identifier_node_id\)\);\s*\}/s);
});

test('business/ui runtime pagination matcher accepts canonical limiter field names even when value_type metadata is absent', () => {
  const runtimeMetadataSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );

  assert.match(runtimeMetadataSource, /private function runtime_ui_find_matching_pagination_state_field_name\(\s*state_fields: Json,\s*control_id: string\s*\): string \{/);
  assert.match(runtimeMetadataSource, /let state_field_value_type = Runtime\.json_to_str\(state_field\["value_type"\]\);/);
  assert.match(runtimeMetadataSource, /let matches_limiter_name = normalized_field_name == "limiter";/);
  assert.match(
    runtimeMetadataSource,
    /if \(\s*!matches_limiter_name\s*&& normalized_control_base != ""\s*&& normalized_field_name == normalized_control_base \+ "limiter"\s*\) \{\s*matches_limiter_name = true;\s*\}/s
  );
  assert.match(runtimeMetadataSource, /if \(state_field_value_type != "Limiter" && !matches_limiter_name\) \{\s*continue;\s*\}/);
});

test('business/ui master form metadata falls back to collected declaration state fields before completing controls', () => {
  const runtimeMetadataSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );

  assert.match(runtimeMetadataSource, /private function runtime_ui_build_master_form_metadata\(form_node_json: Json\): Json \{/);
  assert.match(runtimeMetadataSource, /let state_fields = form_metadata\["state_fields"\];/);
  assert.match(
    runtimeMetadataSource,
    /if \(!runtime_ui_has_any_items\(state_fields\)\) \{\s*state_fields = runtime_ui_collect_form_state_fields\(form_node_json\);\s*\}/s
  );
  assert.match(
    runtimeMetadataSource,
    /merged_controls = runtime_ui_complete_controls_runtime_metadata\(\s*merged_controls,\s*state_fields\s*\);/s
  );
  assert.match(runtimeMetadataSource, /"state_fields": state_fields,/);
});

test('business/ui runtime descendant collection walks canonical child node ids before kind filtering', () => {
  const runtimeMetadataSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );

  assert.match(runtimeMetadataSource, /private function runtime_ui_list_child_node_ids\(parent_node_id: string\): Json \{/);
  assert.match(runtimeMetadataSource, /let parent_node_json = ast\.node_to_json\(normalized_parent_node_id\);/);
  assert.match(runtimeMetadataSource, /for \(child_node_ref in parent_node_json\["children"\] \?\? \[\]\) \{/);
  assert.match(runtimeMetadataSource, /for \(child_node_match in ast\.list_children\(normalized_parent_node_id\) \?\? \[\]\) \{/);
  assert.match(runtimeMetadataSource, /private function runtime_ui_node_starts_before\(left_node_id: string, right_node_id: string\): bool \{/);
  assert.match(runtimeMetadataSource, /let left_range = ast\.node_to_json\(normalized_left_node_id\)\["range"\];/);
  assert.match(runtimeMetadataSource, /let right_range = ast\.node_to_json\(normalized_right_node_id\)\["range"\];/);
  assert.match(runtimeMetadataSource, /if \(left_start_offset != null && right_start_offset != null && left_start_offset != right_start_offset\) \{\s*return Runtime\.json_to_i64\(left_start_offset\) < Runtime\.json_to_i64\(right_start_offset\);\s*\}/s);
  assert.match(runtimeMetadataSource, /let ordered_child_node_ids: Json = \[\];/);
  assert.match(runtimeMetadataSource, /while \(shift_index > insert_index\) \{/);
  assert.match(runtimeMetadataSource, /return ordered_child_node_ids;/);
  assert.match(runtimeMetadataSource, /private function runtime_ui_collect_descendant_node_matches_by_kind\(\s*node_id: string,\s*expected_kind: string\s*\): Json \{/);
  assert.match(runtimeMetadataSource, /let child_nodes = ast\.list_children\(normalized_node_id\) \?\? \[\];/);
  assert.match(runtimeMetadataSource, /for \(child_node in child_nodes\) \{/);
  assert.match(runtimeMetadataSource, /let child_node_id = runtime_ui_match_node_id\(child_node\);/);
  assert.match(runtimeMetadataSource, /let child_kind = runtime_ui_match_kind_name\(child_node\);/);
});

test('business/ui runtime button metadata traversal starts from resolved form and button node ids', () => {
  const runtimeMetadataSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );

  assert.match(runtimeMetadataSource, /private function runtime_ui_collect_form_buttons\(form_node_json: Json, state_fields: Json\): Json \{/);
  assert.match(runtimeMetadataSource, /let form_node_id = runtime_ui_resolve_ast_node_id\(form_node_json\);/);
  assert.match(runtimeMetadataSource, /private function runtime_ui_collect_form_button_nodes_in_source_order\(form_node_id: string\): Json \{/);
  assert.match(runtimeMetadataSource, /private function runtime_ui_find_button_node_in_form\(form_node_json: Json, button_id: string\): Json \{/);
  assert.match(runtimeMetadataSource, /private function runtime_ui_sort_button_metadata_entries_by_source_order\(\s*form_node_json: Json,\s*buttons: Json\s*\): Json \{/);
  assert.match(runtimeMetadataSource, /let button_nodes = runtime_ui_collect_form_button_nodes_in_source_order\(form_node_id\) \?\? \[\];/);
  assert.match(runtimeMetadataSource, /buttons\[button_count\] = button_metadata;/);
  assert.match(runtimeMetadataSource, /let child_node_ids = runtime_ui_list_child_node_ids\(normalized_form_node_id\);/);
  assert.match(runtimeMetadataSource, /if \(child_kind == "buttonDeclaration"\) \{/);
  assert.doesNotMatch(runtimeMetadataSource, /buttons = runtime_ui_sort_button_metadata_entries_by_source_order\(form_node_json, buttons\);/);
  assert.match(runtimeMetadataSource, /private function runtime_ui_resolve_button_click_dispatch_target\(\s*button_node_json: Json\s*\): string \{/);
  assert.match(runtimeMetadataSource, /private function runtime_ui_analyze_button_event_metadata\(button_node_json: Json\): Json \{/);
  assert.match(runtimeMetadataSource, /let button_node_id = runtime_ui_resolve_ast_node_id\(button_node_json\);/);
  assert.match(runtimeMetadataSource, /private function runtime_ui_find_button_node_for_form\(/);
  assert.match(runtimeMetadataSource, /private function runtime_ui_build_synthesized_callable_alias\(node_json: Json\): string \{/);
  assert.match(runtimeMetadataSource, /let normalized_node_id = runtime_ui_resolve_canonical_ast_node_id\(node_json\);/);
  assert.match(runtimeMetadataSource, /let callable_alias = runtime_ui_resolve_node_name_fragment_value\(\s*button_event_node_json,\s*"callable_alias"\s*\);/s);
  assert.match(runtimeMetadataSource, /if \(callable_alias != ""\) \{\s*analysis\["click_dispatch_target"\] = callable_alias;\s*\}/s);
  assert.match(runtimeMetadataSource, /if \(button_event_symbol != ""\) \{\s*analysis\["click_dispatch_target"\] = button_event_symbol;\s*\}/s);
  assert.match(runtimeMetadataSource, /let synthesized_dispatch_target = runtime_ui_build_synthesized_callable_alias\(\s*button_event_node_json\s*\);/s);
  assert.match(
    runtimeMetadataSource,
    /private function runtime_ui_find_button_node_for_form\([\s\S]*runtime_ui_resolve_app_form_lookup\(app_node_json\),\s*form_id,\s*button_id\s*\);/
  );
  assert.match(
    runtimeMetadataSource,
    /private function runtime_ui_resolve_button_click_dispatch_target_for_form\([\s\S]*runtime_ui_resolve_app_form_lookup\(app_node_json\),\s*form_id,\s*button_id\s*\);/
  );
});

test('business/ui runtime open form resolves the app startup form when form_id is omitted', () => {
  const { source: runtimeFunctionsSource } = readBusinessUiOwnExportSource('./runtime/functions');
  const runtimeMetadataSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );

  assert.match(runtimeFunctionsSource, /private function runtime_ui_resolve_requested_form_id\(\s*app_node_json: Json,\s*requested_form_id: string\s*\): string \{/);
  assert.match(runtimeFunctionsSource, /private function runtime_ui_resolve_requested_form_id_with_lookup\(\s*app_node_json: Json,\s*requested_form_id: string,\s*form_lookup: Json\s*\): string \{/);
  assert.match(runtimeFunctionsSource, /private function runtime_ui_resolve_app_runtime_context\(app_id: string\): Json \{/);
  assert.match(runtimeFunctionsSource, /private function runtime_ui_require_app_runtime_context\(app_id: string\): Json \{/);
  assert.match(runtimeFunctionsSource, /let runtime_context = runtime_ui_resolve_app_runtime_context\(app_id\);/);
  assert.match(runtimeFunctionsSource, /if \(app_node_json == null\) \{\s*raise runtime_ui_app_not_found;\s*\}/s);
  assert.match(runtimeFunctionsSource, /"form_lookup": runtime_ui_build_form_node_lookup_for_app\(app_node_json\)/);
  assert.match(runtimeFunctionsSource, /if \(normalized_form_id != ""\) \{\s*return normalized_form_id;\s*\}/);
  assert.match(runtimeFunctionsSource, /return runtime_ui_find_startup_form_id_with_mounted_targets\(\s*app_node_json,\s*form_lookup\.mounted_targets\s*\);/s);
  assert.match(runtimeFunctionsSource, /let runtime_context = runtime_ui_require_app_runtime_context\(app_id\);/);
  assert.match(runtimeFunctionsSource, /let runtime_context = runtime_ui_require_app_runtime_context\(normalized_app_id\);/);
  assert.match(runtimeFunctionsSource, /let runtime_context = runtime_ui_require_app_runtime_context\(effective_app_id\);/);
  assert.match(runtimeFunctionsSource, /let form_lookup = runtime_context\["form_lookup"\];/);
  assert.match(runtimeFunctionsSource, /let normalized_form_id = runtime_ui_resolve_requested_form_id_with_lookup\(\s*app_node_json,\s*request\.form_id,\s*form_lookup\s*\);/);
  assert.match(runtimeFunctionsSource, /open_request\["form_id"\] = form_id;/);
  assert.doesNotMatch(runtimeFunctionsSource, /open_request\["form_id"\] = runtime_ui_resolve_requested_form_id\(app_node_json, form_id\);/);
  assert.match(runtimeFunctionsSource, /let app_metadata = runtime_ui_build_app_metadata_from_lookup\(app_node_json, form_lookup\);/);
  assert.match(runtimeFunctionsSource, /let form_metadata = runtime_ui_find_detailed_form_metadata_in_lookup\(\s*form_lookup,\s*normalized_form_id\s*\);/s);
  assert.match(runtimeMetadataSource, /private function runtime_ui_find_form_node_in_lookup\(\s*form_lookup: Json,\s*form_id: string\s*\): Json \{/);
  assert.match(runtimeMetadataSource, /private function runtime_ui_find_detailed_form_metadata_in_lookup\(\s*form_lookup: Json,\s*form_id: string\s*\): Json \{/);
  assert.match(runtimeMetadataSource, /private function runtime_ui_build_app_metadata_from_lookup\(\s*app_node_json: Json,\s*form_lookup: Json\s*\): Json \{/);
});

test('business/ui runtime http route set stays exact and unique', () => {
  const { source: runtimeFunctionsSource } = readBusinessUiOwnExportSource('./runtime/functions');

  const routes = collectRuntimeUiHttpRoutes(runtimeFunctionsSource);
  const routeKeys = routes.map((route) => `${route.method} ${route.path}`);

  assert.deepEqual(routes, expectedRuntimeUiHttpRoutes);
  assert.equal(new Set(routeKeys).size, routeKeys.length);
});

test('business/ui runtime messages module declares the packaged runtime ui catalog', () => {
  const { source: messagesSource } = readBusinessUiOwnExportSource('./runtime/messages');

  assert.match(messagesSource, /message runtime_ui_open_form_app_id_required \{/);
  assert.match(messagesSource, /message runtime_ui_apply_session_id_required \{/);
  assert.match(messagesSource, /message runtime_ui_apply_app_id_mismatch \{/);
  assert.match(messagesSource, /message runtime_ui_apply_form_id_mismatch \{/);
  assert.match(messagesSource, /message runtime_ui_lookup_session_id_required \{/);
  assert.match(messagesSource, /message runtime_ui_export_session_id_required \{/);
});

test('business/ui runtime raises only declared runtime ui catalog messages', () => {
  const runtimeSources = [
    readBusinessUiOwnExportSource('./runtime/functions').source,
    fs.readFileSync(path.join(packageRoot, 'src/system/ui/runtime_ui.execution.functions.bl'), 'utf8'),
    readBusinessUiOwnExportSource('./runtime/dispatch').source
  ].join('\n');
  const { source: messagesSource } = readBusinessUiOwnExportSource('./runtime/messages');

  const raisedMessages = Array.from(
    new Set(
      collectNamedMatches(runtimeSources, /raise (runtime_ui_[A-Za-z0-9_]+)/g)
    )
  ).sort();
  const declaredMessages = Array.from(
    new Set(
      collectNamedMatches(messagesSource, /message (runtime_ui_[A-Za-z0-9_]+)/g)
    )
  )
    .filter((name) => name !== 'runtime_ui_apply_app_metadata_not_found')
    .sort();

  assert.deepEqual(raisedMessages, declaredMessages);
});

test('business/ui runtime ui message catalog keeps unique BUI-UI codes', () => {
  const { source: messagesSource } = readBusinessUiOwnExportSource('./runtime/messages');

  const messageDefinitions = collectMessageDefinitions(messagesSource);
  const messageNames = messageDefinitions.map((definition) => definition.name);
  const messageCodes = messageDefinitions.map((definition) => definition.code);

  assert.ok(messageDefinitions.length > 0);
  assert.equal(new Set(messageNames).size, messageNames.length);
  assert.equal(new Set(messageCodes).size, messageCodes.length);
  assert.equal(
    messageCodes.every((code) => /^BUI-UI-[0-9]{4}$/.test(code)),
    true
  );
});

test('business/ui runtime ui message catalog keeps a stable ascending public code sequence', () => {
  const { source: messagesSource } = readBusinessUiOwnExportSource('./runtime/messages');

  const messageCodes = collectMessageDefinitions(messagesSource).map(
    (definition) => definition.code
  );
  const numericCodes = messageCodes
    .map((code) => Number(code.replace('BUI-UI-', '')))
    .sort((left, right) => left - right);

  assert.equal(numericCodes[0], 1);
  assert.equal(
    numericCodes.every((code, index) => index === 0 || numericCodes[index - 1] < code),
    true
  );
  assert.equal(numericCodes.includes(68), true);
  assert.equal(numericCodes.includes(74), true);
});

test('business/ui runtime apply keeps canonical transaction identity fields', () => {
  const { source: runtimeFunctionsSource } = readBusinessUiOwnExportSource('./runtime/functions');

  assert.match(runtimeFunctionsSource, /apply_request\["app_id"\] = Runtime\.json_to_str\(transaction\["app_id"\]\);/);
  assert.match(runtimeFunctionsSource, /apply_request\["form_id"\] = Runtime\.json_to_str\(transaction\["formId"\]\);/);
  assert.match(runtimeFunctionsSource, /raise runtime_ui_apply_app_id_mismatch;/);
  assert.match(runtimeFunctionsSource, /raise runtime_ui_apply_form_id_mismatch;/);
  assert.match(runtimeFunctionsSource, /let runtime_context = runtime_ui_require_app_runtime_context\(effective_app_id\);/);
  assert.match(runtimeFunctionsSource, /let form_lookup = runtime_context\["form_lookup"\];/);
});

test('business/ui runtime apply transaction helper keeps the caller and callee ABI aligned', () => {
  const runtimeSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.functions.bl'),
    'utf8'
  );
  const executionSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.execution.functions.bl'),
    'utf8'
  );

  assert.match(
    runtimeSource,
    /"transaction": runtime_ui_build_apply_transaction\(\s*normalized_form_instance_id,\s*next_revision,\s*next_state_sync\["form"\],\s*next_state_sync\["uiState"\],\s*execution_messages,\s*execution_effects,\s*execution_navigation\s*\)/s
  );
  assert.match(
    executionSource,
    /private function runtime_ui_build_apply_transaction\(\s*form_instance_id: string,\s*revision: int,\s*client_form_state: Json,\s*ui_state: Json,\s*messages: Json,\s*effects: Json,\s*navigation: Json\s*\): Json \{/s
  );
});

test('business/ui runtime package stays isolated from app-specific forms and inline ui errors', () => {
  const { source: runtimeFunctionsSource } = readBusinessUiOwnExportSource('./runtime/functions');
  const manifestSource = fs.readFileSync(manifestPath, 'utf8');

  assert.doesNotMatch(runtimeFunctionsSource, /"error": "runtime_ui/);
  assert.doesNotMatch(runtimeFunctionsSource, /customer/i);
  assert.doesNotMatch(runtimeFunctionsSource, /companycode/i);
  assert.doesNotMatch(runtimeFunctionsSource, /packages\/business\/src/);
  assert.doesNotMatch(manifestSource, /customer/i);
  assert.doesNotMatch(manifestSource, /companycode/i);
});

test('business/ui runtime metadata keeps canonical button selection bindings only', () => {
  const metadataSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );

  assert.match(metadataSource, /let label = runtime_ui_metadata_entry_text_value\(published_entry, base_entry, "label"\);/);
  assert.match(metadataSource, /let description = runtime_ui_metadata_entry_text_value\(\s*published_entry,\s*base_entry,\s*"description"\s*\);/s);
  assert.match(metadataSource, /let icon = runtime_ui_metadata_entry_text_value\(published_entry, base_entry, "icon"\);/);
  assert.match(metadataSource, /let shortcut = runtime_ui_metadata_entry_text_value\(published_entry, base_entry, "shortcut"\);/);
  assert.match(metadataSource, /let ribbon_size = runtime_ui_metadata_entry_text_value\(\s*published_entry,\s*base_entry,\s*"ribbon_size"\s*\);/s);
  assert.match(metadataSource, /let placement = runtime_ui_metadata_entry_text_value\(\s*published_entry,\s*base_entry,\s*"placement"\s*\);/s);
  assert.match(metadataSource, /let visible = runtime_ui_metadata_entry_value\(published_entry, base_entry, "visible"\);/);
  assert.match(metadataSource, /let enabled = runtime_ui_metadata_entry_value\(published_entry, base_entry, "enabled"\);/);
  assert.match(metadataSource, /let button_argument_analysis = runtime_ui_analyze_button_argument_metadata\(button_node_json\);/);
  assert.match(metadataSource, /let button_visual_defaults = runtime_ui_resolve_button_visual_defaults\(\s*button_node_json,\s*button_argument_analysis\s*\);/s);
  assert.match(metadataSource, /let inferred_selection_path = Runtime\.json_to_str\(button_argument_analysis\["selection_path"\]\);/);
  assert.match(metadataSource, /button_metadata\["selection_path"\] = "state\." \+ explicit_selection_field_name;/);
  assert.match(metadataSource, /button_metadata\["selection_path"\] = inferred_selection_path;/);
  assert.match(metadataSource, /button_metadata\["form_arg_expr"\] = button_form_arg_expr;/);
  assert.match(metadataSource, /let button_form_arg_expr = Runtime\.json_to_str\(button_argument_analysis\["form_arg_expr"\]\);/);
  assert.match(metadataSource, /let button_description = Runtime\.json_to_str\(button_property_metadata\["description"\]\);/);
  assert.match(metadataSource, /let button_ribbon_size = Runtime\.json_to_str\(button_property_metadata\["ribbon_size"\]\);/);
  assert.match(metadataSource, /let button_placement = Runtime\.json_to_str\(button_property_metadata\["placement"\]\);/);
  assert.match(metadataSource, /button_metadata\["description"\] = button_description;/);
  assert.match(metadataSource, /button_metadata\["ribbon_size"\] = button_ribbon_size;/);
  assert.match(metadataSource, /button_metadata\["placement"\] = button_placement;/);
  assert.match(metadataSource, /let has_button_visible = button_property_metadata\["has_visible"\] == true;/);
  assert.match(metadataSource, /let has_button_enabled = button_property_metadata\["has_enabled"\] == true;/);
  assert.match(metadataSource, /button_metadata\["visible"\] = button_visible;/);
  assert.match(metadataSource, /button_metadata\["enabled"\] = button_enabled;/);
  assert.match(metadataSource, /let enabled_when = runtime_ui_metadata_entry_text_value\(\s*published_entry,\s*base_entry,\s*"enabled_when"\s*\);/s);
  assert.match(metadataSource, /let record_path = runtime_ui_metadata_entry_text_value\(\s*published_entry,\s*base_entry,\s*"record_path"\s*\);/s);
  assert.doesNotMatch(metadataSource, /runtime_ui_find_matching_state_field_property\(\s*button_node_json,\s*"enabled"/);
  assert.match(metadataSource, /button_metadata\["events"\] = {\s*"on_click": click_event_metadata\s*};/);
  assert.match(metadataSource, /let button_menu_items = runtime_ui_build_button_menu_items_from_node\(\s*button_node_json,\s*state_fields\s*\);/s);
  assert.match(metadataSource, /button_metadata\["items"\] = button_menu_items;/);
  assert.match(metadataSource, /private function runtime_ui_has_authored_metadata_value\(node_json: Json, key: string\): bool \{/);
  assert.match(metadataSource, /private function runtime_ui_build_button_menu_items_from_node\(\s*menu_owner_node_json: Json,\s*state_fields: Json\s*\): Json \{/);
  assert.match(metadataSource, /child_kind == "buttonMenuOptionDeclaration"/);
  assert.match(metadataSource, /child_kind == "buttonMenuSeparatorDeclaration"/);
  assert.match(metadataSource, /runtime_ui_build_button_metadata_from_node\(\s*child_node_json,\s*state_fields\s*\)/);
  assert.match(metadataSource, /"separator": true/);
  assert.match(metadataSource, /click_event_metadata\["form_id"\] = navigate_target_form;/);
  assert.match(metadataSource, /let button_event_analysis = runtime_ui_analyze_button_event_metadata\(button_node_json\);/);
  assert.match(metadataSource, /let navigate_target_form = Runtime\.json_to_str\(button_event_analysis\["navigate_target_form"\]\);/);
  assert.match(metadataSource, /let click_dispatch_target = Runtime\.json_to_str\(button_event_analysis\["click_dispatch_target"\]\);/);
});

test('business/ui runtime open http accepts both snake_case and camelCase request ids', () => {
  const runtimeSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.functions.bl'),
    'utf8'
  );

  assert.match(
    runtimeSource,
    /private function runtime_ui_http_request_value\(\s*request: Json,\s*snake_case_name: string,\s*camel_case_name: string\s*\): Json/
  );
  assert.match(
    runtimeSource,
    /let app_id = Runtime\.json_to_str\(runtime_ui_http_request_value\(request, "app_id", "appId"\)\);/
  );
  assert.match(
    runtimeSource,
    /let form_id = Runtime\.json_to_str\(runtime_ui_http_request_value\(request, "form_id", "formId"\)\);/
  );
});

test('business/ui runtime button ui state keeps canonical selection metadata only', () => {
  const controlsSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.controls.functions.bl'),
    'utf8'
  );
  const metadataSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );

  assert.match(controlsSource, /Runtime\.json_to_str\(button_metadata\["selection_path"\]\)/);
  assert.match(controlsSource, /let requires_selection = button_metadata\["requires_selection"\] == true;/);
  assert.doesNotMatch(controlsSource, /button_metadata\["selection_required"\]/);
  assert.doesNotMatch(controlsSource, /button_metadata\["selectionRequired"\]/);
  assert.doesNotMatch(controlsSource, /button_metadata\["requiresSelection"\]/);
  assert.doesNotMatch(controlsSource, /button_properties\["requires_selection"\]/);
  assert.doesNotMatch(controlsSource, /button_properties\["selection_required"\]/);
  assert.doesNotMatch(controlsSource, /button_properties\["requiresSelection"\]/);
  assert.doesNotMatch(controlsSource, /button_properties\["selectionRequired"\]/);
  assert.doesNotMatch(controlsSource, /button_metadata\["record_path"\]/);
  assert.doesNotMatch(controlsSource, /"isVisible"/);
  assert.doesNotMatch(controlsSource, /"isHidden"/);
  assert.doesNotMatch(controlsSource, /"isDisabled"/);
  assert.doesNotMatch(controlsSource, /"isEnabled"/);
  assert.doesNotMatch(controlsSource, /Runtime\.json_to_str\(button_metadata\["control_id"\]\)/);
  assert.doesNotMatch(metadataSource, /button_metadata\["control_id"\]/);
});

test('business/ui runtime controls keep canonical control selection metadata only', () => {
  const controlsSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.controls.functions.bl'),
    'utf8'
  );
  const metadataSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );

  assert.doesNotMatch(controlsSource, /normalized_control_metadata\["record_path"\]/);
  assert.doesNotMatch(controlsSource, /selection\["path"\]/);
  assert.match(controlsSource, /Runtime\.json_to_str\(normalized_control_metadata\["selection_path"\]\)/);
  assert.match(controlsSource, /Runtime\.json_to_str\(control_metadata\["selection_path"\]\)/);
  assert.doesNotMatch(metadataSource, /control_metadata\["selection"\] = {/);
  assert.doesNotMatch(metadataSource, /control_metadata\["pagination"\] = {/);
  assert.match(metadataSource, /let child_symbol_names = runtime_ui_collect_descendant_symbol_names\(child_node_id\);/);
  assert.match(metadataSource, /runtime_ui_symbol_list_contains\(child_symbol_names, "selection"\)/);
  assert.match(metadataSource, /runtime_ui_symbol_list_contains\(child_symbol_names, "pagination"\)/);
  assert.match(metadataSource, /control_metadata\["selection_path"\] = "state\." \+ selection_field_name;/);

  assert.doesNotMatch(metadataSource, /selection_changed_event\["navigate"\]/);
});

test('business/ui runtime field ui state keeps canonical metadata flag keys only', () => {
  const controlsSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.controls.functions.bl'),
    'utf8'
  );

  assert.match(controlsSource, /private function runtime_ui_resolve_control_metadata_flag\(\s*control_metadata: Json,\s*primary_key: string\s*\)/);
  assert.doesNotMatch(controlsSource, /alias_key: string/);
  assert.doesNotMatch(controlsSource, /normalized_alias_key/);
  assert.doesNotMatch(controlsSource, /runtime_ui_resolve_control_metadata_flag\(\s*button_metadata,\s*"visible",\s*"isVisible"/);
  assert.doesNotMatch(controlsSource, /runtime_ui_resolve_control_metadata_flag\(\s*button_metadata,\s*"hidden",\s*"isHidden"/);
  assert.doesNotMatch(controlsSource, /runtime_ui_resolve_control_metadata_flag\(\s*button_metadata,\s*"disabled",\s*"isDisabled"/);
  assert.doesNotMatch(controlsSource, /runtime_ui_resolve_control_metadata_flag\(\s*button_metadata,\s*"enabled",\s*"isEnabled"/);
  assert.doesNotMatch(controlsSource, /runtime_ui_resolve_control_metadata_flag\(\s*control_metadata,\s*"readonly",\s*"readOnly"/);
  assert.doesNotMatch(controlsSource, /runtime_ui_resolve_control_metadata_flag\(\s*control_metadata,\s*"display_only",\s*"displayOnly"/);
  assert.doesNotMatch(controlsSource, /runtime_ui_resolve_control_metadata_flag\(\s*control_metadata,\s*"disabled",\s*"isDisabled"/);
  assert.doesNotMatch(controlsSource, /runtime_ui_resolve_control_metadata_flag\(\s*control_metadata,\s*"enabled",\s*"isEnabled"/);
});

test('business/ui runtime controls publish canonical grow metadata with datagrid defaults', () => {
  const metadataSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );

  assert.match(metadataSource, /let grow = runtime_ui_property_value\(control_node_json, "grow"\);/);
  assert.match(metadataSource, /control_metadata\["grow"\] = grow;/);
  assert.match(metadataSource, /else if \(control_type == "DataGrid" \|\| control_type == "Grid"\) \{/);
  assert.match(metadataSource, /control_metadata\["grow"\] = 1;/);
});

test('business/ui runtime control metadata projects grid columns and selection key in one pass', () => {
  const metadataSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );

  assert.match(
    metadataSource,
    /private function runtime_ui_build_grid_binding_projection\(\s*binding_members: Json\s*\): Json/
  );
  assert.match(
    metadataSource,
    /let grid_binding_projection = runtime_ui_build_grid_binding_projection\(\s*grid_binding_members\s*\);/
  );
  assert.match(
    metadataSource,
    /let grid_selection_key = Runtime\.json_to_str\(grid_binding_projection\["selection_key"\]\);/
  );
  assert.doesNotMatch(
    metadataSource,
    /grid_binding_key_fields = runtime_ui_build_binding_key_fields_from_members/
  );
  assert.match(
    metadataSource,
    /private function runtime_ui_resolve_control_binding_type_from_form_field_from\(\s*form_field_from_node_id: string\s*\): string/
  );
  assert.match(
    metadataSource,
    /if \(grid_binding_type == ""\) \{\s*grid_binding_type = runtime_ui_resolve_control_binding_type_from_form_field_from\(\s*form_field_from_node_id\s*\);\s*\}/s
  );
  assert.match(
    metadataSource,
    /private function runtime_ui_find_first_matching_state_field_name_by_value_type\(\s*state_fields: Json,\s*value_type: string\s*\): string/
  );
  assert.match(
    metadataSource,
    /if \(selection_field_name == "" && grid_binding_type != ""\) \{\s*let select_handler = runtime_ui_find_form_field_property_handler\(\s*control_node_id,\s*\[\s*"select"\s*\]\s*\);/s
  );
  assert.match(
    metadataSource,
    /selection_field_name = runtime_ui_find_first_matching_state_field_name_by_value_type\(\s*state_fields,\s*grid_binding_type\s*\);/s
  );
  assert.match(
    metadataSource,
    /private function runtime_ui_find_matching_pagination_state_field_name\(\s*state_fields: Json,\s*control_id: string\s*\): string/
  );
  assert.match(
    metadataSource,
    /if \(pagination_field_name == "" && source_handler != ""\) \{\s*pagination_field_name = runtime_ui_find_matching_pagination_state_field_name\(\s*state_fields,\s*control_id\s*\);/s
  );
});

test('business/ui runtime metadata projects reflected binding types and lengths into default forms and grids', () => {
  const metadataSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );

  const gridSource = metadataSource
    .split('private function runtime_ui_build_grid_columns_from_binding_members(')[1]
    ?.split('private function runtime_ui_build_control_metadata_from_node(')[0] || '';
  const defaultControlSource = metadataSource
    .split('private function runtime_ui_build_default_control_metadata_from_binding_member(')[1]
    ?.split('private function runtime_ui_build_form_controls_from_binding_members(')[0] || '';

  assert.match(gridSource, /let value_type = Runtime\.json_to_str\(binding_member\["value_type"\]\);/);
  assert.match(gridSource, /column_metadata\["type"\] = value_type;/);
  assert.match(gridSource, /column_metadata\["value_type"\] = value_type;/);
  assert.match(gridSource, /column_metadata\["max_length"\] = binding_member\["max_length"\];/);
  assert.match(gridSource, /column_metadata\["display_length"\] = runtime_ui_cap_grid_column_display_length\(/);
  assert.match(gridSource, /column_metadata\["input_width"\] = binding_member\["input_width"\];/);
  assert.doesNotMatch(gridSource, /"type": "text"/);
  assert.doesNotMatch(gridSource, /column_metadata\["display_length"\] = binding_member\["max_length"\];/);
  assert.doesNotMatch(gridSource, /column_metadata\["input_width"\] = binding_member\["max_length"\];/);
  assert.match(metadataSource, /private function runtime_ui_cap_grid_column_display_length\(display_length: Json\): Json \{/);
  assert.match(metadataSource, /let grid_display_length_cap = 40;/);

  assert.match(defaultControlSource, /let value_type = Runtime\.json_to_str\(binding_member\["value_type"\]\);/);
  assert.match(defaultControlSource, /"type": runtime_ui_resolve_default_control_kind_from_binding_member\(binding_member\)/);
  assert.match(defaultControlSource, /control_metadata\["value_type"\] = value_type;/);
  assert.match(defaultControlSource, /control_metadata\["max_length"\] = binding_member\["max_length"\];/);
  assert.match(defaultControlSource, /control_metadata\["display_length"\] = binding_member\["display_length"\];/);
  assert.match(defaultControlSource, /control_metadata\["input_width"\] = binding_member\["input_width"\];/);
  assert.doesNotMatch(defaultControlSource, /control_metadata\["type"\] = value_type;/);
  assert.doesNotMatch(defaultControlSource, /control_metadata\["display_length"\] = binding_member\["max_length"\];/);
  assert.doesNotMatch(defaultControlSource, /control_metadata\["input_width"\] = binding_member\["max_length"\];/);
  assert.match(metadataSource, /private function runtime_ui_resolve_default_control_kind_from_binding_member\(/);
  assert.match(metadataSource, /return "text";/);
});

test('business/ui runtime metadata builds indexed app and form lookups from AST before runtime open uses them', () => {
  const metadataSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );

  assert.match(metadataSource, /private function runtime_ui_build_mounted_form_target_index_for_app\(app_node_json: Json\): Json \{/);
  assert.match(metadataSource, /private function runtime_ui_build_form_node_lookup_for_app\(app_node_json: Json\): Json \{/);
  assert.match(metadataSource, /private function runtime_ui_collect_form_nodes_with_builder\(\s*form_nodes: Json,\s*use_detailed_metadata: bool\s*\): Json \{/);
  assert.match(metadataSource, /private function runtime_ui_collect_forms_for_app_with_builder\(\s*form_lookup: Json,\s*use_detailed_metadata: bool\s*\): Json \{/);
  assert.match(metadataSource, /return runtime_ui_collect_form_nodes_with_builder\(\s*form_lookup\.ordered \?\? \[\],\s*use_detailed_metadata\s*\);/s);
  assert.match(metadataSource, /return runtime_ui_collect_forms_for_app_with_builder\(\s*runtime_ui_build_form_node_lookup_for_app\(app_node_json\),\s*use_detailed_metadata\s*\);/s);
  assert.match(metadataSource, /let form_lookup = runtime_ui_build_form_node_lookup_for_app\(app_node_json\);/);
  assert.match(metadataSource, /"mounted_targets": mounted_targets/);
  assert.match(metadataSource, /let mounted_form_target = Runtime\.json_to_str\(form_lookup\.mounted_targets\[normalized_form_id\]\);/);
  assert.match(metadataSource, /return form_lookup\.by_id\[resolved_form_id\];/);
  assert.match(metadataSource, /let app_nodes = ast\.list_nodes_by_kind\("appDeclaration"\) \?\? \[\];/);
  assert.match(metadataSource, /if \(runtime_ui_matches_app_id\(app_node_json, normalized_app_id\)\) \{\s*return app_node_json;\s*\}/);
});

test('business/ui runtime controls keep canonical control pagination metadata only', () => {
  const controlsSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.controls.functions.bl'),
    'utf8'
  );
  const metadataSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );

  assert.doesNotMatch(controlsSource, /control_metadata\["pagination"\]/);
  assert.doesNotMatch(controlsSource, /pagination\["path"\]/);
  assert.match(controlsSource, /Runtime\.json_to_str\(normalized_control_metadata\["pagination_path"\]\)/);
  assert.match(controlsSource, /Runtime\.json_to_str\(control_metadata\["pagination_path"\]\)/);
  assert.match(metadataSource, /control_metadata\["pagination_path"\] = "state\." \+ pagination_field_name;/);
  assert.match(metadataSource, /control_metadata\["columns"\] = grid_columns;/);
  assert.doesNotMatch(metadataSource, /properties\["columns"\] = grid_columns;/);
  assert.match(metadataSource, /"keyIdentifier": binding_member\["is_key"\] == true/);
  assert.doesNotMatch(metadataSource, /"isKey": binding_member\["is_key"\] == true,/);
  assert.doesNotMatch(metadataSource, /"primary_key": binding_member\["is_primary_key"\] == true/);
  assert.match(metadataSource, /properties\["selection_key"\] = grid_selection_key;/);
  assert.doesNotMatch(metadataSource, /control_metadata\["selection_key"\] = grid_selection_key;/);
  assert.doesNotMatch(metadataSource, /properties\["selectionKey"\] = grid_selection_key;/);
  assert.match(metadataSource, /let selection_mode = Runtime\.json_to_str\(\s*runtime_ui_property_value\(control_node_json, "selection_mode"\)\s*\);/s);
  assert.match(metadataSource, /let selection_behavior = Runtime\.json_to_str\(\s*runtime_ui_property_value\(control_node_json, "selection_behavior"\)\s*\);/s);
  assert.match(metadataSource, /selection_mode = runtime_ui_find_declaration_text_property\(\s*control_node_json,\s*"selection_mode"\s*\);/s);
  assert.match(metadataSource, /selection_behavior = runtime_ui_find_declaration_text_property\(\s*control_node_json,\s*"selection_behavior"\s*\);/s);
  assert.match(metadataSource, /else if \(node_kind == "controlDeclaration" \|\| node_kind == "formInlineControlField"\) \{\s*property_node_kinds = \[\s*"formFieldProperty",\s*"formInlineFieldProperty"\s*\];\s*\}/s);
  assert.match(metadataSource, /properties\["selection_mode"\] = selection_mode;/);
  assert.match(metadataSource, /properties\["selection_behavior"\] = selection_behavior;/);
  assert.doesNotMatch(metadataSource, /properties\["filter_mode"\] = "server";/);
  assert.doesNotMatch(metadataSource, /properties\["filterMode"\] = "server";/);
  assert.doesNotMatch(metadataSource, /properties\["server_side_filtering"\] = true;/);
  assert.doesNotMatch(metadataSource, /properties\["serverSideFiltering"\] = true;/);
  assert.match(metadataSource, /if \(runtime_ui_has_any_json_entries\(properties\)\) \{/);
  assert.doesNotMatch(metadataSource, /if \(properties != null\) \{\s*control_metadata\["properties"\] = properties;/);
  assert.match(controlsSource, /let selection_key = Runtime\.json_to_str\(normalized_control_metadata\["selection_key"\]\);/);
  assert.match(controlsSource, /contract\["selection_key"\] = selection_key;/);
  assert.match(controlsSource, /private function runtime_ui_resolve_grid_row_id_with_selection_key\(\s*row: Json,\s*selection_key: string\s*\): string \{/);
  assert.match(controlsSource, /let row_id = Runtime\.json_to_str\(row\[normalized_selection_key\]\);/);
  assert.match(controlsSource, /return runtime_ui_resolve_grid_row_id\(row\);/);
  assert.match(controlsSource, /runtime_ui_resolve_grid_row_id_with_selection_key\(\s*runtime_state\.selection,\s*contract\.selection_key\s*\)/s);
  assert.match(controlsSource, /runtime_ui_resolve_grid_row_id_with_selection_key\(row, selection_key\) == selected_row_id/);
  assert.match(controlsSource, /runtime_ui_resolve_grid_row_id_with_selection_key\(\s*selected_row,\s*selection_key\s*\)/s);
});

test('business/ui runtime metadata prefers published structural descriptors', () => {
  const metadataSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );

  assert.match(metadataSource, /private function runtime_ui_published_property_value\(node_json: Json, key: string\): Json \{/);
  assert.match(metadataSource, /private function runtime_ui_merge_json_objects\(base_value: Json, published_value: Json\): Json \{/);
  assert.match(metadataSource, /private function runtime_ui_merge_string_lists\(base_value: Json, published_value: Json\): Json \{/);
  assert.match(metadataSource, /private function runtime_ui_merge_flat_json_object\(base_value: Json, published_value: Json\): Json \{/);
  assert.match(metadataSource, /private function runtime_ui_merge_json_entry_object\(base_entry: Json, published_entry: Json\): Json \{/);
  assert.match(metadataSource, /private function runtime_ui_merge_named_json_entry_object\(base_entry: Json, published_entry: Json\): Json \{/);
  assert.match(metadataSource, /private function runtime_ui_merge_json_entry_lists\(base_value: Json, published_value: Json\): Json \{/);
  assert.match(metadataSource, /private function runtime_ui_merge_named_json_objects\(base_value: Json, published_value: Json\): Json \{/);
  assert.match(metadataSource, /private function runtime_ui_metadata_entry_text_value\(/);
  assert.match(metadataSource, /private function runtime_ui_merge_metadata_entry\(base_entry: Json, published_entry: Json\): Json \{\s*return runtime_ui_merge_json_objects\(base_entry, published_entry\);\s*\}/);
  assert.match(metadataSource, /private function runtime_ui_merge_metadata_object_value\(/);
  assert.match(metadataSource, /private function runtime_ui_merge_named_metadata_object_value\(/);
  assert.match(metadataSource, /runtime_ui_property_container_value\(\s*runtime_ui_property_value\(node_json, "fields"\),/s);
  assert.match(metadataSource, /runtime_ui_property_container_value\(\s*runtime_ui_property_value\(node_json, "extras"\),/s);
  assert.match(metadataSource, /private function runtime_ui_match_node_id\(node_match: Json\): string \{/);
  assert.match(metadataSource, /let node_id = Runtime\.json_to_str\(node_match\["node_id"\]\);/);
  assert.match(metadataSource, /node_id = Runtime\.json_to_str\(node_match\["id"\]\);/);
  assert.match(metadataSource, /private function runtime_ui_find_metadata_entry_by_name\(entries: Json, entry_name: string\): Json \{/);
  assert.match(metadataSource, /let published_state_fields = runtime_ui_published_property_value\(form_node_json, "state_fields"\);/);
  assert.match(metadataSource, /runtime_ui_merge_state_field_metadata_entries\(base_state_fields, published_state_fields\)/);
  assert.match(metadataSource, /let type = runtime_ui_metadata_entry_text_value\(published_entry, base_entry, "type"\);/);
  assert.match(metadataSource, /let value_type = runtime_ui_metadata_entry_text_value\(\s*published_entry,\s*base_entry,\s*"value_type"\s*\);/);
  assert.match(metadataSource, /let published_body = runtime_ui_published_property_value\(form_node_json, "body"\);/);
  assert.match(metadataSource, /let published_controls = published_body != null \? published_body\["controls"\] : null;/);
  assert.match(metadataSource, /runtime_ui_merge_control_metadata_entries\(base_controls, published_controls\)/);
  assert.match(metadataSource, /let published_buttons = runtime_ui_published_property_value\(form_node_json, "buttons"\);/);
  assert.match(
    metadataSource,
    /let direct_form_metadata_nodes = runtime_ui_collect_form_metadata_nodes\(form_node_id\);/
  );
  assert.match(
    metadataSource,
    /private function runtime_ui_collect_form_metadata_nodes_internal\(\s*form_node_id: string,\s*collect_control_nodes: bool\s*\): Json \{/s
  );
  assert.match(
    metadataSource,
    /if \(child_kind == "formStateDeclaration"\) \{\s*collected_nodes\["state_nodes"\]\[state_count\] = child_node_json;\s*state_count = state_count \+ 1;\s*continue;\s*\} else if \(child_kind == "formField"\) \{\s*continue;\s*\} else if \(child_kind == "formInlineControlField"\) \{\s*if \(collect_control_nodes\) \{\s*collected_nodes\["control_nodes"\]\[control_count\] = child_node_json;\s*control_count = control_count \+ 1;\s*\}\s*continue;\s*\} else if \(child_kind == "buttonDeclaration"\) \{\s*collected_nodes\["button_nodes"\]\[button_count\] = child_node_json;\s*button_count = button_count \+ 1;\s*continue;\s*\} else if \(child_kind == "formBodySection"\) \{/s
  );
  assert.match(
    metadataSource,
    /return runtime_ui_collect_form_metadata_nodes_internal\(form_node_id, false\);/
  );
  assert.match(
    metadataSource,
    /let base_buttons = runtime_ui_build_buttons_from_nodes\(\s*direct_form_metadata_nodes\["button_nodes"\],\s*state_fields\s*\);/s
  );
  assert.match(
    metadataSource,
    /buttons = published_buttons != null\s*\?\s*runtime_ui_merge_button_metadata_entries\(base_buttons, published_buttons\)\s*:\s*base_buttons;/
  );
  assert.match(metadataSource, /let load_handler = runtime_ui_published_property_value\(form_node_json, "load"\);/);
  assert.match(metadataSource, /let ui_from = runtime_ui_published_property_value\(form_node_json, "ui_from"\);/);
  assert.match(metadataSource, /let direct_form_structure = runtime_ui_analyze_direct_form_structure\(form_node_json\);/);
  assert.match(metadataSource, /let form_header_property_analysis = runtime_ui_collect_form_header_property_analysis\(\s*form_node_json\s*\);/s);
  assert.match(metadataSource, /if \(\s*include_runtime_details\s*&& Runtime\.json_to_str\(ui_from\) == ""\s*&& direct_form_structure\["has_ui_field"\] == true\s*\) \{\s*ui_from = direct_form_structure\["ui_from"\];\s*\}/s);
  assert.match(metadataSource, /let reflected_load_handler = "";/);
  assert.match(metadataSource, /if \(include_runtime_details && direct_form_structure\["has_load_property"\] == true\) \{\s*reflected_load_handler = Runtime\.json_to_str\(\s*form_header_property_analysis\["symbol_properties"\]\["load"\]\s*\);/s);
  assert.match(metadataSource, /if \(reflected_load_handler == ""\) \{\s*reflected_load_handler = runtime_ui_find_declaration_symbol_property\(form_node_json, "load"\);\s*\}/);
  assert.match(metadataSource, /else if \(load_handler != null && load_handler\["handler"\] == null && load_handler\["dispatch_target"\] == null\) \{\s*load_handler = null;\s*\}/);
  assert.match(metadataSource, /load_handler = runtime_ui_merge_flat_json_object\(\{\s*"handler": reflected_load_handler\s*\}, load_handler\);/);
  assert.match(metadataSource, /let load_param = runtime_ui_published_property_value\(form_node_json, "load_param"\);/);
  assert.match(metadataSource, /private function runtime_ui_build_form_body_metadata\(controls: Json\): Json \{/);
  assert.match(metadataSource, /private function runtime_ui_form_controls\(form_metadata: Json\): Json \{/);
  assert.match(metadataSource, /return runtime_ui_property_container_value\(form_metadata\["body"\], "controls"\) \?\? \[\];/);
  assert.match(metadataSource, /private function runtime_ui_analyze_property_node\(property_node_id: string\): Json \{/);
  assert.match(metadataSource, /private function runtime_ui_collect_declaration_text_properties\(\s*node_json: Json,\s*property_names: Json\s*\): Json \{/);
  assert.match(metadataSource, /private function runtime_ui_collect_form_header_property_analysis\(form_node_json: Json\): Json \{/);
  assert.match(metadataSource, /let form_text_properties = form_header_property_analysis\["text_properties"\] \?\? \{\};/);
  assert.match(
    metadataSource,
    /reflected_load_handler = Runtime\.json_to_str\(\s*form_header_property_analysis\["symbol_properties"\]\["load"\]\s*\);/s
  );
  assert.doesNotMatch(
    metadataSource,
    /reflected_load_handler = runtime_ui_find_declaration_symbol_property\(form_node_json, "load"\);/
  );
  assert.match(metadataSource, /let property_node_analysis = runtime_ui_analyze_property_node\(property_node_id\);/);
  assert.match(metadataSource, /let reflected_load_param = Runtime\.json_to_str\(form_text_properties\["load_param"\]\);/);
  assert.match(metadataSource, /private function runtime_ui_find_handler_first_parameter_name\(handler_symbol: string\): string \{/);
  assert.match(metadataSource, /let inferred_load_param = runtime_ui_find_handler_first_parameter_name\(\s*Runtime\.json_to_str\(load_handler\["handler"\]\)\s*\);/);
  assert.match(
    metadataSource,
    /if \(\s*Runtime\.json_to_str\(load_param\) == ""\s*&& load_handler != null\s*&& binding_key_fields != null\s*&& binding_key_fields\[0\] != null\s*&& Runtime\.json_to_str\(binding_key_fields\[0\]\) != ""\s*\) \{\s*load_param = binding_key_fields\[0\];\s*\}/
  );
  assert.match(metadataSource, /let binding_kind = runtime_ui_published_property_value\(form_node_json, "binding_kind"\);/);
  assert.match(metadataSource, /let binding_members = runtime_ui_published_property_value\(form_node_json, "binding_members"\);/);
  assert.match(metadataSource, /let binding_key_fields = runtime_ui_published_property_value\(form_node_json, "binding_key_fields"\);/);
  assert.match(metadataSource, /if \(Runtime\.json_to_str\(binding_kind\) == ""\) \{\s*let reflected_binding_kind = runtime_ui_resolve_binding_declaration_kind\(\s*Runtime\.json_to_str\(ui_from\)\s*\);\s*binding_kind = reflected_binding_kind;\s*\}/);
  assert.match(metadataSource, /if \(binding_members == null\) \{\s*let reflected_binding_members = runtime_ui_build_binding_members_for_type\(\s*Runtime\.json_to_str\(ui_from\)\s*\);\s*binding_members = reflected_binding_members;\s*\}/);
  assert.match(metadataSource, /if \(binding_key_fields == null\) \{\s*binding_key_fields = runtime_ui_build_binding_key_fields_from_members\(binding_members\);\s*\}/);
  assert.match(metadataSource, /"startup_form_id": runtime_ui_published_property_value\(form_node_json, "startup_form_id"\),/);
  assert.match(metadataSource, /"_form_header_property_analysis": form_header_property_analysis,/);
  assert.match(metadataSource, /let app_title = Runtime\.json_to_str\(runtime_ui_published_property_value\(app_node_json, "title"\)\);/);
  assert.match(metadataSource, /let app_module = Runtime\.json_to_str\(runtime_ui_published_property_value\(app_node_json, "module"\)\);/);
  assert.match(metadataSource, /"form_technical_name": form_technical != "" \? form_technical : null,/);
  assert.match(metadataSource, /"technical_name": app_technical != "" \? app_technical : null,/);
  assert.match(metadataSource, /let startup_form_id = Runtime\.json_to_str\(\s*runtime_ui_published_property_value\(app_node_json, "startup_form_id"\)\s*\);/);
  assert.match(metadataSource, /if \(startup_form_id == ""\) \{\s*startup_form_id = runtime_ui_find_startup_form_id_with_mounted_targets\(\s*app_node_json,\s*mounted_targets\s*\);\s*\}/s);
  assert.match(metadataSource, /private function runtime_ui_resolve_startup_form_id_against_mounted_targets\(\s*mounted_targets: Json,\s*startup_form_id: string\s*\): string \{/);
  assert.match(metadataSource, /private function runtime_ui_analyze_startup_form_reference\(node_id: string\): Json \{/);
  assert.match(metadataSource, /let startup_form_reference_analysis = runtime_ui_analyze_startup_form_reference\(child_node_id\);/);
  assert.match(metadataSource, /if \(startup_form_reference_analysis\["has_startup_section"\] != true\) \{\s*continue;\s*\}/s);
  assert.match(metadataSource, /let startup_form_id = Runtime\.json_to_str\(\s*startup_form_reference_analysis\["first_symbol_name"\]\s*\);/s);
  const formSummarySource = metadataSource
    .split('private function runtime_ui_build_form_summary(form_node_json: Json): Json {')[1]
    ?.split('private function runtime_ui_collect_forms_for_app_with_builder(')[0] || '';
  assert.match(formSummarySource, /let form_metadata = runtime_ui_build_form_metadata_core\(form_node_json, false\);/);
  assert.match(formSummarySource, /let form_header_property_analysis = form_metadata\["_form_header_property_analysis"\] \?\? \{\};/s);
  assert.match(formSummarySource, /let reflected_load_handler = Runtime\.json_to_str\(\s*form_header_property_analysis\["symbol_properties"\]\["load"\]\s*\);/s);
  assert.doesNotMatch(
    formSummarySource,
    /reflected_load_handler = runtime_ui_find_declaration_symbol_property\(form_node_json, "load"\);/
  );
  assert.match(formSummarySource, /let reflected_load_param = Runtime\.json_to_str\(\s*form_header_property_analysis\["text_properties"\]\["load_param"\]\s*\);/s);
  assert.match(
    formSummarySource,
    /if \(\s*Runtime\.json_to_str\(form_metadata\["load_param"\]\) == ""\s*&& form_metadata\["load"\] != null\s*&& Runtime\.json_to_str\(form_metadata\["load"\]\["handler"\]\) != ""\s*\) \{\s*let inferred_load_param = runtime_ui_find_handler_first_parameter_name\(\s*Runtime\.json_to_str\(form_metadata\["load"\]\["handler"\]\)\s*\);\s*if \(inferred_load_param != ""\) \{\s*form_metadata\["load_param"\] = inferred_load_param;\s*\}\s*\}/
  );
  assert.match(formSummarySource, /return \{\s*"form_id": form_metadata\["form_id"\],/);
  assert.doesNotMatch(
    formSummarySource,
    /runtime_ui_build_binding_members_for_type\(/
  );
  assert.doesNotMatch(
    formSummarySource,
    /form_metadata\["binding_key_fields"\]/
  );
  assert.match(metadataSource, /click_event_metadata\["form_id"\] = navigate_target_form;/);
  assert.match(metadataSource, /click_event_metadata\["dispatch_target"\] = click_dispatch_target;/);
  assert.match(metadataSource, /private function runtime_ui_resolve_button_click_dispatch_target\(\s*button_node_json: Json\s*\): string \{/);
  assert.match(metadataSource, /private function runtime_ui_analyze_button_event_metadata\(button_node_json: Json\): Json \{/);
  assert.match(metadataSource, /private function runtime_ui_resolve_button_event_navigate_reference\(\s*button_event_node_id: string\s*\): string \{/);
  assert.match(metadataSource, /let button_event_analysis = runtime_ui_analyze_button_event_metadata\(button_node_json\);/);
  assert.match(metadataSource, /let click_dispatch_target = Runtime\.json_to_str\(button_event_analysis\["click_dispatch_target"\]\);/);
  assert.match(metadataSource, /let click_handler = Runtime\.json_to_str\(button_event_analysis\["click_handler"\]\);/);
  assert.match(metadataSource, /let button_argument_analysis = runtime_ui_analyze_button_argument_metadata\(button_node_json\);/);
  assert.match(metadataSource, /let inferred_selection_path = Runtime\.json_to_str\(button_argument_analysis\["selection_path"\]\);/);
  assert.match(metadataSource, /button_metadata\["form_arg_expr"\] = button_form_arg_expr;/);
  assert.match(metadataSource, /button_metadata\["selection_path"\] = inferred_selection_path;/);
  assert.match(metadataSource, /private function runtime_ui_resolve_button_selection_path\(button_node_json: Json\): string \{/);
  assert.match(metadataSource, /private function runtime_ui_analyze_button_argument_metadata\(button_node_json: Json\): Json \{/);
  assert.match(metadataSource, /private function runtime_ui_resolve_button_argument_expression\(argument_node_id: string\): string \{/);
  assert.match(metadataSource, /private function runtime_ui_resolve_button_form_arg_expression\(button_node_json: Json\): string \{/);
  assert.match(metadataSource, /let button_node_id = runtime_ui_resolve_ast_node_id\(button_node_json\);/);
  assert.match(metadataSource, /let argument_children = ast\.list_children\(argument_list_node_id\) \?\? \[\];/);
  assert.match(metadataSource, /for \(argument_child in argument_children\) \{/);
  assert.match(metadataSource, /let argument_node_id = runtime_ui_match_node_id\(argument_child\);/);
  assert.match(metadataSource, /let member_owner_reference_nodes = runtime_ui_collect_descendant_node_matches_by_kind\(\s*normalized_argument_node_id,\s*"memberOwnerReference"\s*\) \?\? \[\];/s);
  assert.match(metadataSource, /let member_owner_reference_node_json = ast\.node_to_json\(\s*runtime_ui_match_node_id\(member_owner_reference_match\)\s*\);/s);
  assert.match(metadataSource, /if \(member_owner_literal == "form"\) \{\s*return "form";\s*\}/);
  assert.match(metadataSource, /if \(member_owner_literal == "state"\) \{/);
  assert.match(metadataSource, /return "state\." \+ member_name;/);
  assert.match(metadataSource, /let member_owner_literal = Runtime\.json_to_str\(\s*runtime_ui_property_value\(member_owner_reference_node_json, "literal_text"\)\s*\);/s);
  assert.match(metadataSource, /let keyword_identifier_nodes = runtime_ui_collect_descendant_node_matches_by_kind\(\s*normalized_argument_node_id,\s*"keywordIdentifier"\s*\) \?\? \[\];/s);
  assert.match(metadataSource, /if \(runtime_ui_resolve_node_symbol_name\(keyword_identifier_node_json\) == "form"\) \{\s*return "form";\s*\}/);
  assert.match(metadataSource, /private function runtime_ui_resolve_node_name_fragment_value\(\s*node_json: Json,\s*field_name: string\s*\): string \{/);
  assert.match(metadataSource, /private function runtime_ui_find_first_descendant_name_fragment_value\(\s*node_id: string,\s*field_name: string\s*\): string \{/);
  assert.match(metadataSource, /private function runtime_ui_resolve_canonical_ast_node_id\(\s*node_json: Json\s*\): string \{/);
  assert.match(metadataSource, /let source_node_id_property = runtime_ui_property_container_value\(\s*node_json\["properties"\],\s*"node_id"\s*\);/);
  assert.match(metadataSource, /let source_node_id_value = Runtime\.json_to_i64\(source_node_id_property\);/);
  assert.match(metadataSource, /let attachment_document_shift = 4294967296;/);
  assert.match(metadataSource, /return Runtime\.json_to_str\(source_node_id_value\);/);
  assert.match(metadataSource, /let resolved_node_id = Runtime\.json_to_str\(node_json\["resolved_node_id"\]\);/);
  assert.match(metadataSource, /return runtime_ui_resolve_ast_node_id\(node_json\);/);
  assert.match(metadataSource, /private function runtime_ui_build_synthesized_callable_alias\(\s*node_json: Json\s*\): string \{/);
  assert.match(metadataSource, /let normalized_node_id = runtime_ui_resolve_canonical_ast_node_id\(node_json\);/);
  assert.match(metadataSource, /runtime_ui_collect_descendant_node_matches_by_kind\(\s*button_node_id,\s*"buttonEvent"\s*\)/);
  assert.match(metadataSource, /let callable_alias = runtime_ui_resolve_node_name_fragment_value\(\s*button_event_node_json,\s*"callable_alias"\s*\);/);
  assert.match(metadataSource, /let button_event_node_json = ast\.node_to_json\(button_event_node_id\);/);
  assert.match(metadataSource, /runtime_ui_property_value\(button_event_node_json, "symbol_name"\)/);
  assert.match(metadataSource, /runtime_ui_property_value\(button_event_node_json, "normalized_symbol_name"\)/);
  assert.match(metadataSource, /let synthesized_dispatch_target = runtime_ui_build_synthesized_callable_alias\(\s*button_event_node_json\s*\);/);
  assert.match(metadataSource, /if \(click_dispatch_target != "" && click_dispatch_target != navigate_target_form\) \{\s*return click_dispatch_target;\s*\}/);
  assert.match(metadataSource, /if \(reflected_handler != "" && reflected_handler != navigate_target_form\) \{\s*return reflected_handler;\s*\}/);
  assert.match(metadataSource, /private function runtime_ui_resolve_button_navigate_reference\(button_node_json: Json\): string \{/);
  assert.match(metadataSource, /private function runtime_ui_resolve_button_event_navigate_reference\(\s*button_event_node_id: string\s*\): string \{/);
  assert.match(metadataSource, /runtime_ui_collect_descendant_node_matches_by_kind\(\s*normalized_button_event_node_id,\s*"navigateExpression"\s*\)/);
  assert.match(metadataSource, /let constructor_type_node_id = runtime_ui_find_child_node_id_by_kind\(\s*navigate_expression_node_id,\s*"constructorType"\s*\);/);
  assert.match(metadataSource, /private function runtime_ui_merge_runtime_event_entry\(base_event: Json, published_event: Json\): Json \{/);
  assert.match(metadataSource, /runtime_ui_resolve_handler_reference_status\(base_dispatch_target\) == "unresolved"/);
  assert.match(metadataSource, /runtime_ui_resolve_handler_reference_status\(published_dispatch_target\) == "unresolved"/);
  assert.match(metadataSource, /merged_event\["dispatch_target"\] = base_dispatch_target;/);
  assert.match(metadataSource, /private function runtime_ui_merge_runtime_event_map\(base_events: Json, published_events: Json\): Json \{/);
  assert.match(metadataSource, /merged_events\[event_name\] = runtime_ui_merge_runtime_event_entry\(\s*base_events\[event_name\],\s*published_events\[event_name\]\s*\);/);
  assert.match(metadataSource, /private function runtime_ui_find_button_node_for_form\(\s*app_node_json: Json,\s*form_id: string,\s*button_id: string\s*\): Json \{/);
  assert.match(metadataSource, /private function runtime_ui_resolve_button_click_dispatch_target_for_form\(\s*app_node_json: Json,\s*form_id: string,\s*button_id: string\s*\): string \{/);
  assert.match(metadataSource, /let event_declaration_kinds: Json = \[\s*"buttonEvent",\s*"controlEvent",\s*"formEvent"\s*\];/);
  assert.match(metadataSource, /let event_callable_alias = runtime_ui_find_first_descendant_name_fragment_value\(\s*node_id,\s*"callable_alias"\s*\);/);
  assert.match(metadataSource, /private function runtime_ui_collect_forms_for_app_with_builder\(\s*app_node_json: Json,\s*use_detailed_metadata: bool\s*\): Json \{/);
  assert.match(metadataSource, /private function runtime_ui_form_node_matches_mounted_form_id\(\s*app_node_json: Json,\s*form_node_json: Json\s*\): bool \{/);
  assert.match(metadataSource, /let mounted_form_ids = runtime_ui_published_property_value\(app_node_json, "mounted_form_ids"\) \?\? \[\];/);
  assert.match(metadataSource, /private function runtime_ui_find_mounted_form_target_for_app\(\s*app_node_json: Json,\s*mounted_form_id: string\s*\): string \{/);
  assert.match(metadataSource, /private function runtime_ui_find_mounted_form_target_in_app_mounts\(\s*app_node_json: Json,\s*mounted_form_id: string\s*\): string \{/);
  assert.match(metadataSource, /private function runtime_ui_analyze_form_mount_node\(form_mount_node_id: string\): Json \{/);
  assert.match(metadataSource, /private function runtime_ui_find_mounted_form_target_in_index\(\s*mounted_targets: Json,\s*mounted_form_id: string\s*\): string \{/);
  assert.match(metadataSource, /return runtime_ui_find_mounted_form_target_in_index\(\s*runtime_ui_build_mounted_form_target_index_for_app\(app_node_json\),\s*mounted_form_id\s*\);/s);
  assert.match(metadataSource, /return runtime_ui_find_mounted_form_target_for_app\(app_node_json, mounted_form_id\);/);
  assert.match(metadataSource, /private function runtime_ui_collect_descendant_form_target_symbol_names\(node_id: string\): Json \{/);
  assert.match(metadataSource, /private function runtime_ui_collect_descendant_node_ids_by_kinds\(\s*node_id: string,\s*descendant_kinds: Json\s*\): Json \{/);
  assert.match(metadataSource, /private function runtime_ui_collect_ordered_node_ids_by_kinds\(\s*node_id: string,\s*node_kinds: Json,\s*traversal_scope: string\s*\): Json \{/);
  assert.match(metadataSource, /return runtime_ui_collect_ordered_node_ids_by_kinds\(node_id, descendant_kinds, "descendant"\);/);
  assert.match(metadataSource, /let descendant_symbol_names = runtime_ui_collect_descendant_form_target_symbol_names\(node_id\);/);
  assert.match(metadataSource, /let form_mount_nodes = runtime_ui_collect_descendant_node_matches_by_kind\(\s*app_node_id,\s*"formMount"\s*\) \?\? \[\];/);
  assert.match(metadataSource, /let app_header_property_kinds: Json = \[\s*"appHeaderProperty",\s*"appInlineHeaderProperty"\s*\];/);
  assert.match(metadataSource, /for \(form_mount_child_node_id in runtime_ui_list_child_node_ids\(normalized_form_mount_node_id\)\) \{/);
  assert.match(metadataSource, /if \(Runtime\.json_to_str\(analysis\["mounted_target"\]\) == ""\) \{\s*analysis\["mounted_target"\] = form_mount_child_symbol;\s*continue;\s*\}/);
  assert.match(metadataSource, /if \(Runtime\.json_to_str\(analysis\["mounted_alias"\]\) == ""\) \{\s*analysis\["mounted_alias"\] = form_mount_child_symbol;\s*break;\s*\}/);
  assert.match(metadataSource, /let form_mount_analysis = runtime_ui_analyze_form_mount_node\(form_mount_node_id\);/);
  assert.match(metadataSource, /let mounted_form_target = Runtime\.json_to_str\(form_lookup\.mounted_targets\[normalized_form_id\]\);/);
  assert.match(metadataSource, /private function runtime_ui_resolve_mounted_form_target_for_source\(\s*source_node_json: Json,\s*mounted_form_reference: string\s*\): string \{/);
  assert.match(metadataSource, /let mounted_target_form = runtime_ui_find_mounted_form_target_in_app_mounts\(\s*app_node_json,\s*normalized_mounted_form_reference\s*\);/s);
  assert.match(metadataSource, /private function runtime_ui_resolve_button_navigate_target_form_reference\(\s*button_node_json: Json,\s*navigate_target_reference: string\s*\): string \{/);
  assert.match(metadataSource, /navigate_target_form = runtime_ui_resolve_button_navigate_target_form_reference\(\s*button_node_json,\s*navigate_target_reference\s*\);/);
  assert.match(metadataSource, /let mounted_target_form = runtime_ui_resolve_mounted_form_target_for_source\(\s*button_node_json,\s*qualified_symbol_name\s*\);/);
  assert.match(metadataSource, /private function runtime_ui_find_first_matching_descendant_form_target_symbol_name\(\s*button_node_json: Json,\s*node_id: string,\s*resolution_mode: string\s*\): string \{/);
  assert.match(metadataSource, /private function runtime_ui_find_first_descendant_mounted_form_symbol_name\(\s*button_node_json: Json,\s*node_id: string\s*\): string \{/);
  assert.match(metadataSource, /return runtime_ui_find_first_matching_descendant_form_target_symbol_name\(\s*button_node_json,\s*node_id,\s*"mounted"\s*\);/);
  assert.match(metadataSource, /return runtime_ui_find_first_matching_descendant_form_target_symbol_name\(\s*null,\s*node_id,\s*"form"\s*\);/);
  assert.match(metadataSource, /navigate_target_form = runtime_ui_find_first_descendant_mounted_form_symbol_name\(\s*button_node_json,\s*button_event_node_id\s*\);/);
  assert.match(metadataSource, /return runtime_ui_resolve_startup_form_id_against_mounted_targets\(\s*mounted_targets,\s*startup_form_id\s*\);/);
  assert.match(metadataSource, /startup_form_id = runtime_ui_resolve_startup_form_id_against_mounted_targets\(\s*mounted_targets,\s*startup_form_id\s*\);/);
  assert.match(metadataSource, /private function runtime_ui_form_node_belongs_to_app\(app_node_json: Json, form_node_json: Json\): bool \{/);
  assert.match(metadataSource, /if \(runtime_ui_form_node_matches_mounted_form_id\(app_node_json, form_node_json\)\) \{\s*return true;\s*\}/);
  assert.match(metadataSource, /if \(!runtime_ui_form_node_belongs_to_app\(app_node_json, form_node_json\)\) \{/);
  assert.match(metadataSource, /private function runtime_ui_build_app_metadata_with_forms_and_mounted_targets\(\s*app_node_json: Json,\s*forms: Json,\s*mounted_targets: Json\s*\): Json \{/);
  assert.match(metadataSource, /private function runtime_ui_build_app_metadata_with_forms\(app_node_json: Json, forms: Json\): Json \{\s*return runtime_ui_build_app_metadata_with_forms_and_mounted_targets\(\s*app_node_json,\s*forms,\s*runtime_ui_build_mounted_form_target_index_for_app\(app_node_json\)\s*\);\s*\}/s);
  assert.match(metadataSource, /private function runtime_ui_build_app_metadata\(app_node_json: Json\): Json \{\s*let form_lookup = runtime_ui_build_form_node_lookup_for_app\(app_node_json\);[\s\S]*runtime_ui_collect_form_nodes_with_builder\(form_lookup\.ordered \?\? \[\], false\),[\s\S]*form_lookup\.mounted_targets[\s\S]*\}/s);
  assert.match(metadataSource, /private function runtime_ui_collect_detailed_forms_for_app\(app_node_json: Json\): Json \{\s*return runtime_ui_collect_forms_for_app_with_builder\(app_node_json, true\);\s*\}/);
  assert.match(metadataSource, /private function runtime_ui_build_detailed_app_metadata\(app_node_json: Json\): Json \{\s*let form_lookup = runtime_ui_build_form_node_lookup_for_app\(app_node_json\);[\s\S]*runtime_ui_collect_form_nodes_with_builder\(form_lookup\.ordered \?\? \[\], true\),[\s\S]*form_lookup\.mounted_targets[\s\S]*\}/s);
  assert.match(metadataSource, /private function runtime_ui_build_detailed_app_metadata\(app_node_json: Json\): Json \{\s*return runtime_ui_build_app_metadata_with_forms\(\s*app_node_json,\s*runtime_ui_collect_detailed_forms_for_app\(app_node_json\)\s*\);\s*\}/);
  assert.match(metadataSource, /private function runtime_ui_merge_control_source_value\(\s*published_entry: Json,\s*base_entry: Json\s*\): Json \{/);
  assert.match(metadataSource, /let source = runtime_ui_merge_control_source_value\(published_entry, base_entry\);/);
  assert.match(metadataSource, /let base_source_name = Runtime\.json_to_str\(base_source\["name"\]\);/);
  assert.match(metadataSource, /merged_source\["name"\] = base_source_name;/);
  assert.match(metadataSource, /let events = runtime_ui_merge_runtime_event_map\(\s*base_entry\["events"\],\s*published_entry\["events"\]\s*\);/);
  assert.match(metadataSource, /let properties = runtime_ui_merge_flat_json_object\(\s*base_entry\["properties"\],\s*published_entry\["properties"\]\s*\);/);
  assert.match(metadataSource, /return runtime_ui_merge_flat_json_object\(base_value, published_value\);/);
  assert.match(metadataSource, /let label = runtime_ui_metadata_entry_text_value\(published_entry, base_entry, "label"\);/);
  assert.match(metadataSource, /let binding_path = runtime_ui_metadata_entry_text_value\(published_entry, base_entry, "binding_path"\);/);
  assert.match(metadataSource, /let columns = runtime_ui_merge_json_entry_lists\(base_entry\["columns"\], published_entry\["columns"\]\);/);
  assert.match(metadataSource, /merged_value\[merged_count\] = runtime_ui_merge_json_entry_object\(base_entry, published_entry\);/);
  assert.match(metadataSource, /merged_value\[entry_key\] = runtime_ui_merge_named_json_entry_object\(/);
  assert.match(metadataSource, /let handler = runtime_ui_metadata_entry_text_value\(published_entry, base_entry, "handler"\);/);
  assert.match(metadataSource, /let field_name = runtime_ui_metadata_entry_text_value\(published_entry, base_entry, "field_name"\);/);
  assert.match(metadataSource, /if \(published_identity == ""\) \{\s*continue;\s*\}/);
  assert.match(metadataSource, /if \(entry_id == ""\) \{\s*continue;\s*\}/);
  assert.match(metadataSource, /if \(entry_name == ""\) \{\s*continue;\s*\}/);
  assert.match(metadataSource, /if \(published_value != null && Runtime\.json_to_str\(published_value\) != ""\) \{/);
});

test('business/ui runtime binding key metadata reflects field modifiers', () => {
  const bindingSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.binding.functions.bl'),
    'utf8'
  );

  assert.match(bindingSource, /private function runtime_ui_collect_binding_member_reflection\(/);
  assert.match(bindingSource, /private function runtime_ui_field_modifier_subtree_contains_name\(/);
  assert.match(bindingSource, /runtime_ui_node_kind\(node_json\) == "fieldModifier"/);
  assert.match(bindingSource, /let modifier_literal_text = Runtime\.json_to_str\(\s*runtime_ui_property_value\(node_json, "literal_text"\)\s*\)/);
  assert.match(bindingSource, /let modifier_source_text = Runtime\.json_to_str\(\s*runtime_ui_property_value\(node_json, "source_text"\)\s*\)/);
  assert.match(bindingSource, /let modifier_original_source_text = Runtime\.json_to_str\(\s*runtime_ui_property_value\(node_json, "original_source_text"\)\s*\)/);
  assert.match(bindingSource, /runtime_ui_find_first_descendant_literal_text\(normalized_node_id\)/);
  assert.match(bindingSource, /runtime_ui_find_first_descendant_symbol_name\(normalized_node_id\)/);
  assert.match(bindingSource, /private function runtime_ui_find_descendant_property_value\(/);
  assert.match(bindingSource, /let direct_value = runtime_ui_property_value\(node_json, normalized_key\)/);
  assert.match(bindingSource, /let reflection = runtime_ui_collect_binding_member_reflection\(/);
  assert.match(bindingSource, /let is_primary_key = reflection\["has_primary_modifier"\] == true/);
  assert.match(bindingSource, /let is_key = is_primary_key\s*\n\s*\|\| reflection\["has_key_modifier"\] == true/);
  assert.match(bindingSource, /let is_unique = is_key\s*\n\s*\|\| reflection\["has_unique_modifier"\] == true/);
});

test('business/ui runtime binding members preserve reflected scalar type and length metadata', () => {
  const bindingSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.binding.functions.bl'),
    'utf8'
  );

  assert.match(bindingSource, /private function runtime_ui_resolve_binding_member_value_type\(type_expression_node_id: string\): string \{/);
  assert.match(bindingSource, /let symbol_name = Runtime\.json_to_str\(/);
  assert.match(bindingSource, /if \(symbol_name != ""\) \{\s*return symbol_name;\s*\}/);
  assert.match(bindingSource, /let literal_text = Runtime\.json_to_str\(\s*runtime_ui_find_first_descendant_literal_text\(normalized_type_expression_node_id\)\s*\)/);
  assert.match(bindingSource, /if \(literal_text != ""\) \{\s*return literal_text;\s*\}/);
  assert.match(bindingSource, /let source_text = Runtime\.json_to_str\(\s*runtime_ui_property_value\(node_json, "source_text"\)\s*\)/);
  assert.match(bindingSource, /return Runtime\.json_to_str\(\s*runtime_ui_property_value\(node_json, "original_source_text"\)\s*\);/);
  assert.match(bindingSource, /private function runtime_ui_resolve_binding_member_positive_int_value\(/);
  assert.match(bindingSource, /private function runtime_ui_collect_binding_member_numeric_properties\(/);
  assert.match(bindingSource, /let reflected_field_properties = runtime_ui_collect_binding_member_reflection\(/);
  assert.match(bindingSource, /let value_type = runtime_ui_resolve_binding_member_value_type\(/);
  assert.match(bindingSource, /let property_names: Json = \[\s*"max_length",\s*"display_length",\s*"input_width"\s*\];/s);
  assert.match(bindingSource, /return Runtime\.json_from_i64\(numeric_value\);/);
  assert.match(bindingSource, /return Runtime\.json_from_i64\(32\);/);
  assert.match(bindingSource, /return Runtime\.json_from_i64\(normalized_candidate\);/);
  assert.match(bindingSource, /"value_type": value_type != "" \? value_type : null,/);
  assert.match(bindingSource, /let explicit_numeric_properties = reflected_field_properties\["numeric_properties"\] \?\? \{\};/);
  assert.match(bindingSource, /let max_length = explicit_numeric_properties\["max_length"\] != null/);
  assert.match(bindingSource, /"max_length": max_length,/);
  assert.match(bindingSource, /let display_length = runtime_ui_resolve_binding_member_display_length\(/);
  assert.match(bindingSource, /"display_length": display_length,/);
  assert.match(bindingSource, /"input_width": explicit_numeric_properties\["input_width"\],/);
});

test('business/ui runtime controls keep canonical control identity metadata only', () => {
  const controlsSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.controls.functions.bl'),
    'utf8'
  );
  const metadataSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );
  const sessionSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui_session.functions.bl'),
    'utf8'
  );
  const typesSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.types.bl'),
    'utf8'
  );

  assert.match(metadataSource, /"id": control_id,/);
  assert.doesNotMatch(metadataSource, /"control_id": control_id,/);
  assert.doesNotMatch(metadataSource, /"name": control_id,/);
  assert.match(metadataSource, /"id": field_name,/);
  assert.doesNotMatch(metadataSource, /"control_id": field_name,/);
  assert.doesNotMatch(metadataSource, /"id": field_name,\s*"control_id": field_name,/);
  assert.doesNotMatch(metadataSource, /Runtime\.json_to_str\(control_metadata\["control_id"\]\)/);
  assert.match(metadataSource, /Runtime\.json_to_str\(control_metadata\["id"\]\) == control_id/);
  assert.doesNotMatch(controlsSource, /Runtime\.json_to_str\(normalized_control_metadata\["control_id"\]\)/);
  assert.doesNotMatch(controlsSource, /Runtime\.json_to_str\(control_metadata\["control_id"\]\)/);
  assert.match(controlsSource, /Runtime\.json_to_str\(normalized_control_metadata\["id"\]\)/);
  assert.match(controlsSource, /Runtime\.json_to_str\(control_metadata\["id"\]\)/);
  assert.doesNotMatch(sessionSource, /Runtime\.json_to_str\(control_entry\["control_id"\]\)/);
  assert.doesNotMatch(sessionSource, /Runtime\.json_to_str\(button_entry\["control_id"\]\)/);
  assert.match(sessionSource, /Runtime\.json_to_str\(control_entry\["id"\]\)/);
  assert.match(sessionSource, /Runtime\.json_to_str\(button_entry\["id"\]\)/);
  assert.match(typesSource, /struct RuntimeUiControlRuntimeUpdate \{\s*id: string;/);
  assert.doesNotMatch(typesSource, /struct RuntimeUiControlRuntimeUpdate \{\s*control_id: string;/);
  assert.doesNotMatch(controlsSource, /runtime_update\["control_id"\]/);
  assert.match(controlsSource, /runtime_update\["id"\]/);
  assert.doesNotMatch(controlsSource, /"control_id": control_id,/);
  assert.doesNotMatch(controlsSource, /"control_id": button_id,/);
  assert.match(controlsSource, /"id": control_id,/);
  assert.match(controlsSource, /"id": button_id,/);
  assert.doesNotMatch(sessionSource, /runtime_update\["control_id"\]/);
  assert.doesNotMatch(sessionSource, /"control_id": control_id,/);
  assert.match(sessionSource, /runtime_update\["id"\]/);
  assert.match(sessionSource, /"id": control_id,/);
});

test('business/ui runtime execution keeps canonical target form metadata only', () => {
  const executionSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.execution.functions.bl'),
    'utf8'
  );
  const metadataSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );

  assert.doesNotMatch(executionSource, /metadata\["target_form_id"\]/);
  assert.doesNotMatch(executionSource, /Runtime\.json_to_str\(metadata\["form"\]\)/);
  assert.doesNotMatch(executionSource, /normalized_event\["form"\]\s*=\s*target_form_id;/);
  assert.doesNotMatch(executionSource, /normalized_event\["target_form_id"\]\s*=\s*target_form_id;/);
  assert.doesNotMatch(executionSource, /runtime_ui_resolve_metadata_target_form_reference/);
  assert.doesNotMatch(executionSource, /metadata\["targetFormId"\]/);
  assert.match(executionSource, /if \(event\["form"\] != null\) \{\s*structural_event\["form"\] = event\["form"\];\s*\}/);
  assert.match(executionSource, /if \(event\["form_id"\] != null\) \{\s*structural_event\["form_id"\] = event\["form_id"\];\s*\}/);
  assert.match(executionSource, /if \(event\["target_form_id"\] != null\) \{\s*structural_event\["target_form_id"\] = event\["target_form_id"\];\s*\}/);
  assert.match(executionSource, /if \(event\["targetFormId"\] != null\) \{\s*structural_event\["targetFormId"\] = event\["targetFormId"\];\s*\}/);
  assert.doesNotMatch(metadataSource, /target_form_id = runtime_ui_find_matching_known_name_property/);
  assert.doesNotMatch(metadataSource, /button_metadata\["target_form_id"\]/);
  assert.doesNotMatch(metadataSource, /button_metadata\["form"\] = target_form_id;/);
});

test('business/ui runtime execution keeps canonical event name metadata only', () => {
  const executionSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.execution.functions.bl'),
    'utf8'
  );

  assert.match(executionSource, /Runtime\.json_to_str\(context\["eventName"\]\)/);
  assert.doesNotMatch(executionSource, /Runtime\.json_to_str\(context\["event"\]\)/);
  assert.doesNotMatch(executionSource, /Runtime\.json_to_str\(event\["eventName"\]\)/);
  assert.doesNotMatch(executionSource, /Runtime\.json_to_str\(event\["event"\]\)/);
  assert.doesNotMatch(executionSource, /context\["name"\]/);
  assert.doesNotMatch(executionSource, /event\["name"\]/);
});

test('business/ui runtime execution keeps canonical event payload metadata only', () => {
  const executionSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.execution.functions.bl'),
    'utf8'
  );

  assert.match(executionSource, /if \(event\["context"\] != null\) \{\s*structural_event\["context"\] = event\["context"\];/);
  assert.doesNotMatch(executionSource, /structural_event\["revision"\]\s*=\s*event\["revision"\]/);
  assert.doesNotMatch(executionSource, /structural_event\["transactionMode"\]\s*=\s*event\["transactionMode"\]/);
  assert.doesNotMatch(executionSource, /structural_event\["event"\] = event\["event"\]/);
  assert.doesNotMatch(executionSource, /structural_event\["payload"\] = event\["payload"\]/);
  assert.doesNotMatch(executionSource, /event\["revision"\]/);
  assert.doesNotMatch(executionSource, /event\["transactionMode"\]/);
  assert.doesNotMatch(executionSource, /Runtime\.json_to_str\(event\["event"\]\)/);
  assert.doesNotMatch(executionSource, /event\["payload"\]/);
});

test('business/ui runtime apply preserves the canonical applied execution message even when handlers return explicit message arrays', () => {
  const executionSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.execution.functions.bl'),
    'utf8'
  );
  const runtimeSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.functions.bl'),
    'utf8'
  );

  assert.match(executionSource, /private function runtime_ui_ensure_apply_execution_message\(/);
  assert.match(executionSource, /Runtime\.json_to_str\(message\["kind"\]\) == "runtime_ui.execution"/);
  assert.match(executionSource, /next_messages\[next_message_count\] = runtime_ui_build_apply_execution_messages\(/);
  assert.match(runtimeSource, /execution_messages = execution_result\.messages \?\? execution_messages;/);
  assert.match(runtimeSource, /execution_messages = runtime_ui_ensure_apply_execution_message\(\s*execution_messages,\s*normalized_session_id,\s*normalized_form_instance_id,\s*effective_app_id,\s*effective_form_id,\s*next_revision\s*\);/s);
});

test('business/ui dispatch passes canonical numeric revisions into ui_dispatch handlers', () => {
  const dispatchSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui_dispatch.functions.bl'),
    'utf8'
  );

  assert.match(
    dispatchSource,
    /ui_dispatch\.dispatch_handler\([\s\S]*context\.event_name,\s*Runtime\.json_to_i64\(context\.revision\),\s*context\.form_state,\s*context\.binding_state,\s*context\.handler_input,\s*dispatch_event[\s\S]*\);/s
  );
});

test('business/ui runtime normalizes request revision fields before arithmetic or comparisons', () => {
  const runtimeSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.functions.bl'),
    'utf8'
  );

  assert.match(runtimeSource, /public function runtime_ui_apply\(request: RuntimeUiApplyRequest\): Json \{[\s\S]*let normalized_revision = Runtime\.json_to_i64\(request\["revision"\]\);/s);
  assert.match(runtimeSource, /public function runtime_ui_lookup\(request: RuntimeUiLookupRequest\): Json \{[\s\S]*let normalized_revision = Runtime\.json_to_i64\(request\["revision"\]\);/s);
  assert.match(runtimeSource, /public function runtime_ui_export\(request: RuntimeUiExportRequest\): Json \{[\s\S]*let normalized_revision = Runtime\.json_to_i64\(request\["revision"\]\);/s);
});

test('business/ui runtime execution keeps canonical control id metadata only', () => {
  const executionSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.execution.functions.bl'),
    'utf8'
  );

  assert.match(executionSource, /Runtime\.json_to_str\(context\["controlId"\]\)/);
  assert.doesNotMatch(executionSource, /Runtime\.json_to_str\(context\["control_id"\]\)/);
  assert.doesNotMatch(executionSource, /Runtime\.json_to_str\(event\["controlId"\]\)/);
  assert.doesNotMatch(executionSource, /Runtime\.json_to_str\(event\["control_id"\]\)/);
});

test('business/ui runtime execution keeps canonical handler metadata and accepts original_handler fallback', () => {
  const executionSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.execution.functions.bl'),
    'utf8'
  );
  const dispatchSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui_dispatch.functions.bl'),
    'utf8'
  );
  const metadataSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );
  assert.match(executionSource, /Runtime\.json_to_str\(event\["handler"\]\)/);
  assert.match(executionSource, /handler = Runtime\.json_to_str\(event\["original_handler"\]\)/);
  assert.doesNotMatch(executionSource, /Runtime\.json_to_str\(metadata\["handler"\]\)/);
  assert.doesNotMatch(executionSource, /normalized_event\["handler"\]\s*=\s*handler;/);
  assert.doesNotMatch(metadataSource, /click_event\["handler"\]\s*=\s*button_handler;/);
  assert.doesNotMatch(metadataSource, /selection_changed_event\["handler"\]\s*=\s*selection_change_handler;/);
  assert.doesNotMatch(metadataSource, /row_double_click_event\["handler"\]\s*=\s*row_double_click_handler;/);
  assert.doesNotMatch(metadataSource, /control_metadata\["events"\]\s*=\s*events;/);
  assert.doesNotMatch(metadataSource, /button_metadata\["events"\]\s*=\s*button_events;/);
  assert.doesNotMatch(metadataSource, /runtime_ui_find_declaration_symbol_property_aliases/);
  assert.doesNotMatch(executionSource, /runtime_ui_resolve_metadata_handler_reference/);
  assert.doesNotMatch(executionSource, /runtime_ui_resolve_apply_metadata_handler/);
  assert.doesNotMatch(executionSource, /event\["function"\]/);
  assert.doesNotMatch(executionSource, /metadata\["function"\]/);
  assert.doesNotMatch(executionSource, /metadata\["call"\]/);
  assert.doesNotMatch(executionSource, /call\["function"\]/);
  assert.doesNotMatch(executionSource, /call\["handler"\]/);
  assert.doesNotMatch(executionSource, /event\["handlerName"\]/);
  assert.doesNotMatch(executionSource, /metadata\["handlerName"\]/);
  assert.doesNotMatch(executionSource, /"on_click"/);
  assert.doesNotMatch(executionSource, /"on_value_change"/);
  assert.match(dispatchSource, /normalized_event\["original_handler"\]\s*=\s*original_handler;/);
  assert.doesNotMatch(dispatchSource, /normalized_event\["handler"\]/);
  assert.doesNotMatch(dispatchSource, /wrapped_event\["control_id"\]\s*=\s*control_id;/);
  assert.doesNotMatch(dispatchSource, /wrapped_event\["event_name"\]\s*=\s*event_name;/);
  assert.doesNotMatch(dispatchSource, /wrapped_event\["revision"\]\s*=\s*revision;/);
  assert.doesNotMatch(dispatchSource, /wrapped_event\["session_id"\]\s*=\s*session_id;/);
  assert.doesNotMatch(dispatchSource, /wrapped_event\["form_instance_id"\]\s*=\s*form_instance_id;/);
  assert.doesNotMatch(dispatchSource, /wrapped_event\["app_id"\]\s*=\s*app_id;/);
  assert.doesNotMatch(dispatchSource, /wrapped_event\["form_id"\]\s*=\s*form_id;/);
});

test('business/ui runtime execution messages keep structural metadata only', () => {
  const executionSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.execution.functions.bl'),
    'utf8'
  );

  assert.match(executionSource, /"kind": "runtime_ui\.execution"/);
  assert.match(executionSource, /"status": "applied"/);
  assert.doesNotMatch(executionSource, /"control_id": control_id/);
  assert.doesNotMatch(executionSource, /"event": event_name/);
  assert.doesNotMatch(executionSource, /"control_kind": control_kind/);
  assert.doesNotMatch(executionSource, /"handler": handler/);
  assert.doesNotMatch(executionSource, /if \(event_name == "" && handler == ""\)/);
});

test('business/ui runtime form metadata resolves readonly from canonical form properties', () => {
  const metadataSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );

  assert.match(
    metadataSource,
    /private function runtime_ui_resolve_metadata_bool_flag\(node_json: Json, key: string\): bool/
  );
  assert.match(
    metadataSource,
    /let declaration_text = runtime_ui_find_declaration_text_property\(node_json, key\);/
  );
  assert.match(
    metadataSource,
    /private function runtime_ui_form_has_direct_modifier\(\s*form_node_id: string,\s*expected_modifier_kind: string\s*\): bool \{/
  );
  assert.match(
    metadataSource,
    /private function runtime_ui_find_direct_child_node_id_by_kind\(\s*parent_node_id: string,\s*child_kind: string\s*\): string \{/
  );
  assert.match(
    metadataSource,
    /return runtime_ui_find_direct_child_node_id_by_kind\(form_node_id, expected_modifier_kind\) != "";/ 
  );
  assert.match(
    metadataSource,
    /"readonly": runtime_ui_form_has_direct_modifier\(form_node_id, "formModifier"\)\s*\|\|\s*runtime_ui_resolve_metadata_bool_flag\(form_node_json, "readonly"\),/
  );
});

test('business/ui runtime symbol-property reflection reuses collected symbol lists per candidate node', () => {
  const metadataSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );
  const declarationSymbolPropertyBlock = metadataSource.match(
    /private function runtime_ui_find_declaration_symbol_property\([\s\S]*?^}\n\nprivate function runtime_ui_find_form_header_symbol_property/m
  )?.[0] || '';
  const formHeaderSymbolPropertyBlock = metadataSource.match(
    /private function runtime_ui_find_form_header_symbol_property\([\s\S]*?^}\n\nprivate function runtime_ui_form_has_direct_modifier/m
  )?.[0] || '';

  assert.match(metadataSource, /private function runtime_ui_find_declaration_symbol_property\(/);
  assert.match(metadataSource, /private function runtime_ui_analyze_symbol_property_subtree\(node_id: string\): Json \{/);
  assert.match(declarationSymbolPropertyBlock, /let child_property_analysis = runtime_ui_analyze_symbol_property_subtree\(child_node_id\);/);
  assert.match(declarationSymbolPropertyBlock, /let child_symbol_names = child_property_analysis\["symbol_names"\] \?\? \[\];/);
  assert.match(declarationSymbolPropertyBlock, /let callable_symbol = Runtime\.json_to_str\(\s*child_property_analysis\["first_callable_symbol"\]\s*\);/s);
  assert.match(declarationSymbolPropertyBlock, /runtime_ui_symbol_list_contains\(child_symbol_names, normalized_property_name\)/);
  assert.doesNotMatch(declarationSymbolPropertyBlock, /runtime_ui_node_or_descendant_has_symbol_name\(child_node_id, normalized_property_name\)/);
  assert.match(formHeaderSymbolPropertyBlock, /let child_symbol_names = runtime_ui_collect_descendant_symbol_names\(\s*form_header_property_node_id\s*\);/);
  assert.match(formHeaderSymbolPropertyBlock, /runtime_ui_symbol_list_contains\(child_symbol_names, normalized_property_name\)/);
  assert.doesNotMatch(formHeaderSymbolPropertyBlock, /runtime_ui_node_or_descendant_has_symbol_name\(\s*form_header_property_node_id,\s*normalized_property_name\s*\)/);
});

test('business/ui runtime button metadata reuses one button argument analysis pass', () => {
  const metadataSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );
  const buttonMetadataBlock = metadataSource.match(
    /private function runtime_ui_build_button_metadata_from_node\([\s\S]*?^}\n\nprivate function runtime_ui_resolve_node_name_fragment_value/m
  )?.[0] || '';
  const buttonArgumentBlock = metadataSource.match(
    /private function runtime_ui_analyze_button_argument_metadata\([\s\S]*?^}\n\nprivate function runtime_ui_resolve_button_argument_expression/m
  )?.[0] || '';
  const buttonArgumentExpressionBlock = metadataSource.match(
    /private function runtime_ui_resolve_button_argument_expression\([\s\S]*?^}\n\nprivate function runtime_ui_resolve_button_selection_path/m
  )?.[0] || '';

  assert.match(metadataSource, /private function runtime_ui_analyze_button_argument_metadata\(button_node_json: Json\): Json \{/);
  assert.match(metadataSource, /private function runtime_ui_find_button_declaration_node_id\(button_node_id: string\): string \{/);
  assert.match(metadataSource, /return runtime_ui_find_first_child_node_id_by_kinds\(\s*button_node_id,\s*\[\s*"buttonInstanceDeclaration",\s*"buttonTemplateDeclaration"\s*\]\s*\);/s);
  assert.match(buttonMetadataBlock, /let button_argument_analysis = runtime_ui_analyze_button_argument_metadata\(button_node_json\);/);
  assert.match(buttonMetadataBlock, /let button_event_analysis = runtime_ui_analyze_button_event_metadata\(button_node_json\);/);
  assert.match(buttonArgumentBlock, /let button_declaration_node_id = runtime_ui_find_button_declaration_node_id\(button_node_id\);/);
  assert.match(metadataSource, /private function runtime_ui_resolve_button_visual_defaults\(\s*button_node_json: Json,\s*button_argument_analysis: Json\s*\): Json \{/s);
  assert.match(buttonMetadataBlock, /let button_visual_defaults = runtime_ui_resolve_button_visual_defaults\(\s*button_node_json,\s*button_argument_analysis\s*\);/s);
  assert.match(buttonMetadataBlock, /let inferred_selection_path = Runtime\.json_to_str\(button_argument_analysis\["selection_path"\]\);/);
  assert.match(buttonMetadataBlock, /if \(inferred_selection_path == ""\) \{\s*inferred_selection_path = Runtime\.json_to_str\(button_event_analysis\["selection_path"\]\);\s*\}/s);
  assert.match(buttonMetadataBlock, /let button_form_arg_expr = Runtime\.json_to_str\(button_argument_analysis\["form_arg_expr"\]\);/);
  assert.match(buttonMetadataBlock, /if \(button_form_arg_expr == ""\) \{\s*button_form_arg_expr = Runtime\.json_to_str\(button_event_analysis\["form_arg_expr"\]\);\s*\}/s);
  assert.match(buttonArgumentBlock, /analysis\["form_arg_expr"\] = argument_expression;/);
  assert.match(buttonArgumentBlock, /analysis\["selection_path"\] = argument_expression;/);
  assert.match(buttonArgumentExpressionBlock, /let member_access_name_nodes = runtime_ui_collect_descendant_node_matches_by_kind\(\s*normalized_argument_node_id,\s*"memberAccessName"\s*\) \?\? \[\];/s);
  assert.doesNotMatch(buttonArgumentExpressionBlock, /runtime_ui_node_or_descendant_has_kind\(normalized_argument_node_id, "keywordIdentifier"\)/);
});

test('business/ui runtime button event analysis reuses one pass for click handler resolution', () => {
  const metadataSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );
  const buttonEventBlock = metadataSource.match(
    /private function runtime_ui_analyze_button_event_metadata\([\s\S]*?^}\n\nprivate function runtime_ui_resolve_button_click_dispatch_target/m
  )?.[0] || '';
  const buttonEventArgumentBlock = metadataSource.match(
    /private function runtime_ui_analyze_button_event_argument_metadata\([\s\S]*?^}\n\nprivate function runtime_ui_analyze_button_event_metadata/m
  )?.[0] || '';
  const buttonMetadataBlock = metadataSource.match(
    /private function runtime_ui_build_button_metadata_from_node\([\s\S]*?^}\n\nprivate function runtime_ui_resolve_node_name_fragment_value/m
  )?.[0] || '';

  assert.match(metadataSource, /private function runtime_ui_analyze_button_event_metadata\(button_node_json: Json\): Json \{/);
  assert.match(metadataSource, /private function runtime_ui_analyze_button_event_argument_metadata\(\s*button_event_node_id: string\s*\): Json \{/);
  assert.match(buttonMetadataBlock, /let button_event_analysis = runtime_ui_analyze_button_event_metadata\(button_node_json\);/);
  assert.match(buttonEventBlock, /let button_declaration_node_id = runtime_ui_find_button_declaration_node_id\(button_node_id\);/);
  assert.match(buttonEventBlock, /let button_event_argument_analysis = runtime_ui_analyze_button_event_argument_metadata\(\s*button_event_node_id\s*\);/);
  assert.match(buttonEventArgumentBlock, /runtime_ui_collect_descendant_node_matches_by_kind\(\s*normalized_button_event_node_id,\s*"navigateExpression"\s*\)/);
  assert.match(buttonEventArgumentBlock, /let arguments_node_id = runtime_ui_find_child_node_id_by_kind\(\s*navigate_expression_node_id,\s*"arguments"\s*\);/);
  assert.match(buttonEventArgumentBlock, /analysis\["form_arg_expr"\] = argument_expression;/);
  assert.match(buttonEventBlock, /let button_event_symbol = runtime_ui_direct_node_symbol_name\(button_event_node_json\);/);
  assert.match(metadataSource, /private function runtime_ui_resolve_button_target_form_from_node\(\s*button_node_json: Json,\s*node_id: string\s*\): string \{/);
  assert.match(buttonEventBlock, /navigate_target_form = runtime_ui_resolve_button_target_form_from_node\(\s*button_node_json,\s*button_event_node_id\s*\);/);
  assert.match(buttonEventBlock, /let declaration_target_form = runtime_ui_resolve_button_target_form_from_node\(\s*button_node_json,\s*button_declaration_node_id\s*\);/);
  assert.match(buttonMetadataBlock, /let click_handler = Runtime\.json_to_str\(button_event_analysis\["click_handler"\]\);/);
  assert.match(buttonEventBlock, /let reflected_handler = runtime_ui_find_declaration_symbol_property\(button_node_json, "on_click"\);/);
  assert.match(buttonEventBlock, /reflected_handler = runtime_ui_find_declaration_symbol_property\(button_node_json, "click"\);/);
  assert.doesNotMatch(metadataSource, /private function runtime_ui_resolve_button_click_handler\(/);
});

test('business/ui runtime button property analysis is shared across metadata and text lookup', () => {
  const metadataSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );
  const buttonPropertyMetadataBlock = metadataSource.match(
    /private function runtime_ui_collect_button_property_metadata\([\s\S]*?^}\n\nprivate function runtime_ui_build_button_metadata_from_node/m
  )?.[0] || '';

  assert.match(metadataSource, /private function runtime_ui_collect_button_property_node_analyses\(button_node_json: Json\): Json \{/);
  assert.match(buttonPropertyMetadataBlock, /let button_property_analyses = runtime_ui_collect_button_property_node_analyses\(button_node_json\);/);
  assert.doesNotMatch(buttonPropertyMetadataBlock, /runtime_ui_find_first_descendant_literal_text\(button_property_node_id\)/);
});

test('business/ui runtime button property analysis is reused in declaration text collection', () => {
  const metadataSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );
  const declarationTextCollectionBlock = metadataSource.match(
    /private function runtime_ui_collect_declaration_text_properties\([\s\S]*?^}\n\nprivate function runtime_ui_node_or_descendant_has_kind/m
  )?.[0] || '';

  assert.match(
    declarationTextCollectionBlock,
    /for \(button_property_analysis in runtime_ui_collect_button_property_node_analyses\(node_json\)\) \{/s
  );
  assert.doesNotMatch(
    declarationTextCollectionBlock,
    /property_node_kinds = \[\s*"buttonProperty"\s*\];/s
  );
});

test('business/ui runtime single declaration-text lookup delegates to batch collection', () => {
  const metadataSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );
  const declarationTextLookupBlock = metadataSource.match(
    /private function runtime_ui_find_declaration_text_property\([\s\S]*?^}\n\nprivate function runtime_ui_find_named_declaration_node_by_kind/m
  )?.[0] || '';

  assert.match(
    declarationTextLookupBlock,
    /let collected_properties = runtime_ui_collect_declaration_text_properties\(\s*node_json,\s*\[normalized_property_name\]\s*\);/s
  );
  assert.match(
    declarationTextLookupBlock,
    /return Runtime\.json_to_str\(collected_properties\[normalized_property_name\]\);/
  );
  assert.doesNotMatch(
    declarationTextLookupBlock,
    /let form_header_matches = runtime_ui_collect_descendant_node_matches_by_kind\(/s
  );
  assert.doesNotMatch(
    declarationTextLookupBlock,
    /let app_header_matches = runtime_ui_collect_descendant_node_matches_by_kind\(/s
  );
});

test('business/ui runtime symbol resolution reuses one identifier lookup helper', () => {
  const metadataSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );
  const normalizedSymbolBlock = metadataSource.match(
    /private function runtime_ui_resolve_node_normalized_symbol_name\([\s\S]*?^}\n\nprivate function runtime_ui_matches_app_id/m
  )?.[0] || '';
  const symbolNameBlock = metadataSource.match(
    /private function runtime_ui_resolve_node_symbol_name\([\s\S]*?^}\n\nprivate function runtime_ui_build_node_debug_descriptor/m
  )?.[0] || '';

  assert.match(metadataSource, /private function runtime_ui_find_first_child_node_id_by_kinds\(\s*parent_node_id: string,\s*child_kinds: Json\s*\): string \{/);
  assert.match(metadataSource, /let ordered_child_node_ids = runtime_ui_collect_ordered_node_ids_by_kinds\(\s*parent_node_id,\s*child_kinds,\s*"child"\s*\) \?\? \[\];/);
  assert.match(metadataSource, /private function runtime_ui_find_symbol_identifier_node_id\(node_json: Json\): string \{/);
  assert.match(metadataSource, /private function runtime_ui_direct_node_symbol_name\(node_json: Json\): string \{/);
  assert.match(metadataSource, /let button_declaration_node_id = runtime_ui_find_button_declaration_node_id\(node_id\);/);
  assert.match(metadataSource, /identifier_node_id = runtime_ui_find_first_child_node_id_by_kinds\(/);
  assert.match(metadataSource, /let descendant_identifier_node_ids = runtime_ui_collect_descendant_node_ids_by_kinds\(/);
  assert.match(normalizedSymbolBlock, /let identifier_node_id = runtime_ui_find_symbol_identifier_node_id\(node_json\);/);
  assert.match(symbolNameBlock, /let direct_symbol_name = runtime_ui_direct_node_symbol_name\(node_json\);/);
  assert.match(symbolNameBlock, /let identifier_node_id = runtime_ui_find_symbol_identifier_node_id\(node_json\);/);
  assert.match(symbolNameBlock, /return runtime_ui_direct_node_symbol_name\(identifier_node_json\);/);
  assert.doesNotMatch(normalizedSymbolBlock, /let descendant_identifier_matches = runtime_ui_collect_descendant_node_matches_by_kind\(\s*node_id,\s*"identifier"\s*\)/s);
  assert.doesNotMatch(symbolNameBlock, /let descendant_identifier_matches = runtime_ui_collect_descendant_node_matches_by_kind\(\s*node_id,\s*"identifier"\s*\)/s);
});

test('business/ui runtime control metadata reuses one control-child analysis pass', () => {
  const metadataSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );
  const controlStructureBlock = metadataSource.match(
    /private function runtime_ui_analyze_control_structure\([\s\S]*?^}\n\nprivate function runtime_ui_build_control_metadata_from_node/m
  )?.[0] || '';
  const controlAnalysisBlock = metadataSource.match(
    /private function runtime_ui_analyze_control_child_metadata\([\s\S]*?^}\n\nprivate function runtime_ui_resolve_control_state_field_bindings/m
  )?.[0] || '';
  const controlMetadataBlock = metadataSource.match(
    /private function runtime_ui_build_control_metadata_from_node\([\s\S]*?^}\n\nprivate function runtime_ui_build_controls_from_nodes/m
  )?.[0] || '';

  assert.match(metadataSource, /private function runtime_ui_analyze_control_structure\(control_node_json: Json\): Json \{/);
  assert.match(controlStructureBlock, /"type_expression_node_id": "",/);
  assert.match(controlStructureBlock, /"form_field_from_node_id": ""/);
  assert.match(controlStructureBlock, /analysis\["control_id"\] = runtime_ui_resolve_node_symbol_name\(control_node_json\);/);
  assert.match(controlStructureBlock, /let type_expression_node_id = runtime_ui_find_first_child_node_id_by_kinds\(/);
  assert.match(controlStructureBlock, /analysis\["type_expression_node_id"\] = type_expression_node_id;/);
  assert.match(controlStructureBlock, /analysis\["form_field_from_node_id"\] = runtime_ui_find_child_node_id_by_kind\(\s*control_node_id,\s*"formFieldFrom"\s*\);/s);
  assert.match(metadataSource, /private function runtime_ui_analyze_control_child_metadata\(\s*control_node_json: Json,\s*state_fields: Json,\s*control_id: string\s*\): Json \{/);
  assert.match(controlAnalysisBlock, /"height_lines": height_lines_symbol/);
  assert.match(controlAnalysisBlock, /runtime_ui_symbol_list_contains\(child_symbol_names, "height_lines"\)/);
  assert.match(controlAnalysisBlock, /let callable_symbol = runtime_ui_find_first_descendant_callable_symbol_name\(child_node_id\);/);
  assert.match(controlMetadataBlock, /let control_structure = runtime_ui_analyze_control_structure\(control_node_json\);/);
  assert.match(controlMetadataBlock, /let type_expression_node_id = Runtime\.json_to_str\(control_structure\["type_expression_node_id"\]\);/);
  assert.match(controlMetadataBlock, /let form_field_from_node_id = Runtime\.json_to_str\(control_structure\["form_field_from_node_id"\]\);/);
  assert.match(controlMetadataBlock, /let control_child_metadata = runtime_ui_analyze_control_child_metadata\(\s*control_node_json,\s*state_fields,\s*control_id\s*\);/);
  assert.match(controlMetadataBlock, /let selection_field_name = Runtime\.json_to_str\(control_child_metadata\["selection"\]\);/);
  assert.match(controlMetadataBlock, /let pagination_field_name = Runtime\.json_to_str\(control_child_metadata\["pagination"\]\);/);
  assert.match(controlMetadataBlock, /let height_lines_symbol = Runtime\.json_to_str\(control_child_metadata\["height_lines"\]\);/);
  assert.match(controlMetadataBlock, /if \(height_lines_symbol == "maximum"\) \{/);
  assert.doesNotMatch(controlMetadataBlock, /runtime_ui_find_declaration_symbol_property\(control_node_json, "height_lines"\)/);
});

test('business/ui runtime form metadata gates ui_from and load reflection by direct form structure', () => {
  const metadataSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );

  assert.match(metadataSource, /private function runtime_ui_analyze_direct_form_structure\(form_node_json: Json\): Json \{/);
  assert.match(metadataSource, /"has_ui_field": false,/);
  assert.match(metadataSource, /"ui_from": null,/);
  assert.match(metadataSource, /"has_load_property": false/);
  assert.match(metadataSource, /for \(child_node_id in runtime_ui_list_child_node_ids\(form_node_id\)\) \{/);
  assert.match(metadataSource, /if \(child_kind == "formField" \|\| child_kind == "formInlineControlField"\) \{/);
  assert.match(metadataSource, /runtime_ui_direct_node_symbol_name\(ast\.node_to_json\(identifier_node_id\)\) == "ui"/);
  assert.match(metadataSource, /analysis\["ui_from"\] = ui_from;/);
  assert.match(metadataSource, /child_kind == "formHeaderProperty"\s*\|\|\s*child_kind == "formInlineHeaderProperty"/s);
  assert.match(metadataSource, /if \(runtime_ui_symbol_list_contains\(child_symbol_names, "load"\)\) \{/);
  assert.match(metadataSource, /let direct_form_structure = runtime_ui_analyze_direct_form_structure\(form_node_json\);/);
  assert.match(metadataSource, /&& direct_form_structure\["has_ui_field"\] == true/);
  assert.match(metadataSource, /ui_from = direct_form_structure\["ui_from"\];/);
  assert.match(metadataSource, /if \(include_runtime_details && direct_form_structure\["has_load_property"\] == true\) \{/);
});

test('business/ui runtime execution drops dead metadata event helper aliases', () => {
  const executionSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.execution.functions.bl'),
    'utf8'
  );

  assert.doesNotMatch(executionSource, /runtime_ui_build_event_metadata_aliases/);
  assert.doesNotMatch(executionSource, /runtime_ui_resolve_event_metadata/);
});

test('business/ui runtime execution keeps canonical dispatch target metadata only', () => {
  const executionSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.execution.functions.bl'),
    'utf8'
  );
  const dispatchSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui_dispatch.functions.bl'),
    'utf8'
  );
  const metadataSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );

  assert.doesNotMatch(executionSource, /Runtime\.json_to_str\(metadata\["dispatch_target"\]\)/);
  assert.match(executionSource, /Runtime\.json_to_str\(event\["dispatch_target"\]\)/);
  assert.match(executionSource, /Runtime\.json_to_str\(load_metadata\["dispatch_target"\]\)/);
  assert.doesNotMatch(executionSource, /Runtime\.json_to_str\(context\["dispatch_target"\]\)/);
  assert.doesNotMatch(executionSource, /normalized_event\["dispatch_target"\]\s*=\s*dispatch_target;/);
  assert.doesNotMatch(executionSource, /runtime_ui_resolve_metadata_dispatch_target_reference/);
  assert.doesNotMatch(executionSource, /runtime_ui_resolve_apply_metadata_dispatch_target/);
  assert.doesNotMatch(executionSource, /Runtime\.json_to_str\(dispatch\["target"\]\)/);
  assert.doesNotMatch(executionSource, /Runtime\.json_to_str\(dispatch\["dispatch_target"\]\)/);
  assert.doesNotMatch(executionSource, /metadata\["dispatchTarget"\]/);
  assert.doesNotMatch(executionSource, /event\["dispatchTarget"\]/);
  assert.doesNotMatch(executionSource, /context\["dispatchTarget"\]/);
  assert.match(dispatchSource, /Runtime\.json_to_str\(context\.dispatch_target\)/);
  assert.doesNotMatch(dispatchSource, /Runtime\.json_to_str\(context\.event\["dispatch_target"\]\)/);
  assert.doesNotMatch(metadataSource, /"dispatch_target": Runtime\.json_to_str\(dispatch_target\)/);
});

test('business/ui runtime apply allows direct dispatch targets without inferred handlers', () => {
  const runtimeSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.functions.bl'),
    'utf8'
  );
  const executionSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.execution.functions.bl'),
    'utf8'
  );

  assert.match(
    executionSource,
    /private function runtime_ui_dispatch_target_requires_handler\(dispatch_target: string\): bool \{/
  );
  assert.match(
    runtimeSource,
    /let execution_requires_handler = runtime_ui_dispatch_target_requires_handler\(\s*execution_dispatch_target\s*\);/
  );
  assert.match(
    runtimeSource,
    /if \(execution_handler != "" \|\| execution_dispatch_target != ""\) \{/
  );
  assert.match(runtimeSource, /if \(\s*execution_requires_handler/);
  assert.doesNotMatch(
    runtimeSource,
    /let execution_requires_handler = execution_dispatch_target == ""\s*\|\|\s*execution_dispatch_target == runtime_ui_dispatch_wrapper_target\(\);/
  );
});

test('business/ui runtime open and apply keep source-backed grid rows out of client form state', () => {
  const runtimeSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.functions.bl'),
    'utf8'
  );
  const executionSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.execution.functions.bl'),
    'utf8'
  );
  const controlsSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.controls.functions.bl'),
    'utf8'
  );

  assert.match(
    controlsSource,
    /private function runtime_ui_is_source_backed_grid_control\(control_metadata: Json\): bool \{/
  );
  assert.match(
    controlsSource,
    /private function runtime_ui_build_client_form_state\(\s*form_metadata: Json,\s*form_state: Json\s*\): Json \{/
  );
  assert.match(
    controlsSource,
    /private function runtime_ui_copy_client_form_field\(\s*client_form_state: Json,\s*copied_fields: Json,\s*form_metadata: Json,\s*form_state: Json,\s*binding_object: RuntimeObject\?,\s*path: string\s*\): Json \{/s
  );
  assert.match(
    controlsSource,
    /let binding_entry = runtime_ui_resolve_form_binding_blueprint_entry\(\s*form_metadata,\s*normalized_path\s*\);/s
  );
  assert.match(
    controlsSource,
    /let field_value = runtime_ui_resolve_form_state_path_with_binding_object\(\s*form_metadata,\s*form_state,\s*binding_object,\s*normalized_path\s*\);/s
  );
  assert.match(
    controlsSource,
    /let binding_path = Runtime\.json_to_str\(control_metadata\["binding_path"\]\);/s
  );
  assert.match(
    controlsSource,
    /if \(control_id == ""\s*\|\|\s*copied_fields\[control_id\] != null\s*\|\|\s*normalized_form_state\[control_id\] == null\) \{\s*continue;\s*\}/s
  );
  assert.match(
    controlsSource,
    /client_form_state\[control_id\] = null;/
  );
  assert.doesNotMatch(
    controlsSource,
    /for \(state_key in normalized_form_state\) \{\s*let normalized_state_key = Runtime\.json_to_str\(state_key\);/s
  );
  assert.match(
    executionSource,
    /let client_form_state = runtime_ui_build_client_form_state\(\s*form_metadata,\s*form_state\s*\);/
  );
  assert.match(executionSource, /"form": client_form_state,/);
  assert.match(executionSource, /"formState": client_form_state,/);
  assert.match(runtimeSource, /let initial_client_form_state = runtime_ui_build_client_form_state\(/);
  assert.match(runtimeSource, /"form": initial_client_form_state,/);
  assert.match(
    runtimeSource,
    /private function runtime_ui_merge_grid_response_envelope\(\s*response: Json,\s*grid_response: Json\s*\): Json \{/
  );
  assert.match(
    runtimeSource,
    /private function runtime_ui_adopt_synced_form_state\(\s*form_metadata: Json,\s*internal_form_state: Json,\s*synced_form_state: Json\s*\): Json \{/
  );
  assert.match(
    runtimeSource,
    /return \{\s*"internal_form_state": internal_form_state,\s*"form_state": internal_form_state\.state,\s*"control_runtime_updates": synced_form_state\.control_runtime_updates \?\? \[\]\s*\};/s
  );
  assert.match(runtimeSource, /if \(grid_response\["rows"\] != null\) \{\s*response\["rows"\] = grid_response\["rows"\];\s*\}/);
  assert.match(runtimeSource, /if \(grid_response\["totalRows"\] != null\) \{\s*response\["totalRows"\] = grid_response\["totalRows"\];\s*\}/);
  assert.match(runtimeSource, /if \(grid_response\["startRow"\] != null\) \{\s*response\["startRow"\] = grid_response\["startRow"\];\s*\}/);
  assert.match(runtimeSource, /if \(grid_response\["rowCount"\] != null\) \{\s*response\["rowCount"\] = grid_response\["rowCount"\];\s*\}/);
  assert.match(
    runtimeSource,
    /return runtime_ui_merge_grid_response_envelope\(open_response, open_grid_response\);/
  );
  assert.match(
    runtimeSource,
    /return runtime_ui_merge_grid_response_envelope\(apply_response, apply_grid_response\);/
  );
  assert.match(
    runtimeSource,
    /let adopted_initial_form_state = runtime_ui_adopt_synced_form_state\(\s*form_metadata,\s*internal_form_state,\s*synced_initial_form_state\s*\);/s
  );
  assert.match(runtimeSource, /let initial_control_runtime_updates = adopted_initial_form_state\["control_runtime_updates"\];/);
  assert.match(
    runtimeSource,
    /let adopted_synced_form_state = runtime_ui_adopt_synced_form_state\(\s*form_metadata,\s*internal_form_state,\s*synced_form_state\s*\);/s
  );
  assert.match(
    runtimeSource,
    /let pre_execution_sync_target_control_id =\s*runtime_ui_resolve_post_execution_sync_target_control_id\(\s*execution_control_metadata,\s*execution_control_id,\s*execution_control_kind,\s*execution_event_name\s*\);/s
  );
  assert.match(
    runtimeSource,
    /let synced_form_state = runtime_ui_sync_control_sessions\(\s*normalized_session_id,\s*normalized_form_instance_id,\s*effective_app_id,\s*effective_form_id,\s*next_revision,\s*form_metadata,\s*internal_form_state\.state,\s*normalized_ui_state,\s*persisted_ui_state,\s*pre_execution_sync_target_control_id\s*\);/s
  );
  assert.match(
    runtimeSource,
    /let adopted_execution_form_state = runtime_ui_adopt_synced_form_state\(\s*form_metadata,\s*internal_form_state,\s*synced_execution_form_state\s*\);/s
  );
});

test('business/ui runtime source-backed grids seed canonical pagination defaults before source execution', () => {
  const controlsSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.controls.functions.bl'),
    'utf8'
  );

  assert.match(controlsSource, /let pagination_path = Runtime\.json_to_str\(control_metadata\["pagination_path"\]\);/);
  assert.match(controlsSource, /if \(pagination_path != ""\) \{/);
  assert.match(controlsSource, /if \(normalized_source_input\["page"\] == null\) \{\s*normalized_source_input\["page"\] = runtime_ui_json_number_from_int\(1\);\s*\}/);
  assert.match(controlsSource, /let default_page_size = Runtime\.json_to_i64\(properties\["page_size"\]\);/);
  assert.match(controlsSource, /if \(default_page_size <= 0\) \{\s*default_page_size = 100;\s*\}/);
  assert.match(controlsSource, /normalized_source_input\["size"\] = runtime_ui_json_number_from_int\(default_page_size\);/);
  assert.match(controlsSource, /let requested_page = Runtime\.json_to_i64\(normalized_source_input\["page"\]\);/);
  assert.match(controlsSource, /let requested_size = Runtime\.json_to_i64\(normalized_source_input\["size"\]\);/);
  assert.match(controlsSource, /if \(normalized_source_input\["limit"\] == null\) \{\s*normalized_source_input\["limit"\] = runtime_ui_json_number_from_int\(requested_size\);\s*\}/);
  assert.match(controlsSource, /if \(normalized_source_input\["offset"\] == null\) \{\s*let requested_offset = \(requested_page - 1\) \* requested_size;/);
});

test('business/ui runtime master datagrid app-info preserves grid selection and pagination metadata', () => {
  const metadataSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );

  assert.match(
    metadataSource,
    /private function runtime_ui_build_master_datagrid_info\(\s*control_metadata: Json,\s*state_fields: Json\s*\): Json \{/s
  );
  assert.match(
    metadataSource,
    /if \(control_metadata\["selection_path"\] != null\) \{\s*master_datagrid\["selection_path"\] = control_metadata\["selection_path"\];\s*\}/s
  );
  assert.match(
    metadataSource,
    /let effective_pagination_path = control_metadata\["pagination_path"\];/s
  );
  assert.match(
    metadataSource,
    /runtime_ui_find_matching_pagination_state_field_name\(\s*state_fields,\s*Runtime\.json_to_str\(control_metadata\["id"\]\)\s*\)/s
  );
  assert.match(
    metadataSource,
    /if \(effective_pagination_path != null\) \{\s*master_datagrid\["pagination_path"\] = effective_pagination_path;\s*\}/s
  );
  assert.match(
    metadataSource,
    /if \(properties\["filter_mode"\] != null\) \{\s*master_datagrid\["filter_mode"\] = properties\["filter_mode"\];\s*\}/s
  );
  assert.match(
    metadataSource,
    /if \(properties\["server_side_filtering"\] != null\) \{\s*master_datagrid\["server_side_filtering"\] = properties\["server_side_filtering"\];\s*\}/s
  );
  assert.match(
    metadataSource,
    /runtime_ui_build_master_datagrid_info\(\s*control_metadata,\s*form_metadata\["state_fields"\]\s*\)/s
  );
  assert.match(
    metadataSource,
    /"state_fields": form_metadata\["state_fields"\],/
  );
});

test('business/ui runtime completes merged source-backed grid pagination metadata after control merge', () => {
  const metadataSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );

  assert.match(
    metadataSource,
    /private function runtime_ui_complete_control_runtime_metadata\(\s*control_metadata: Json,\s*state_fields: Json\s*\): Json \{/
  );
  assert.match(
    metadataSource,
    /if \(!runtime_ui_control_has_source_metadata\(control_metadata\)\) \{\s*return control_metadata;\s*\}/s
  );
  assert.match(
    metadataSource,
    /let pagination_field_name = runtime_ui_find_matching_pagination_state_field_name\(\s*state_fields,\s*Runtime\.json_to_str\(control_metadata\["id"\]\)\s*\);/s
  );
  assert.match(metadataSource, /control_metadata\["pagination_path"\] = "state\." \+ pagination_field_name;/);
  assert.match(
    metadataSource,
    /controls = runtime_ui_complete_controls_runtime_metadata\(controls, state_fields\);/
  );
  assert.match(
    metadataSource,
    /merged_controls = runtime_ui_complete_controls_runtime_metadata\(\s*merged_controls,\s*form_metadata\["state_fields"\]\s*\);/s
  );
});

test('business/ui runtime source-backed grids clamp oversized source results to the requested page window', () => {
  const controlsSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.controls.functions.bl'),
    'utf8'
  );

  assert.match(
    controlsSource,
    /private function runtime_ui_normalize_grid_source_result\(\s*control_metadata: Json,\s*source_input: Json,\s*source_result: Json\s*\): Json \{/
  );
  assert.match(controlsSource, /let requested_page = Runtime\.json_to_i64\(source_input\["page"\]\);/);
  assert.match(controlsSource, /let requested_size = Runtime\.json_to_i64\(source_input\["size"\]\);/);
  assert.match(
    controlsSource,
    /let start_row = \(requested_page - 1\) \* requested_size;/
  );
  assert.match(
    controlsSource,
    /if \(total_count == null \|\| Runtime\.json_to_i64\(total_count\) <= 0\) \{\s*let inferred_total_count = start_row \+ raw_row_count;\s*if \(inferred_total_count < raw_row_count\) \{\s*inferred_total_count = raw_row_count;\s*\}\s*total_count = runtime_ui_json_number_from_int\(inferred_total_count\);\s*\}/
  );
  assert.match(
    controlsSource,
    /let source_result_has_rows_envelope = source_result\["rows"\] != null\s*\|\|\s*source_result\["total_count"\] != null;/
  );
  assert.match(
    controlsSource,
    /if \(raw_row_count <= requested_size\) \{\s*if \(!source_result_has_rows_envelope\) \{\s*return \{\s*"rows": grid_rows,\s*"total_count": total_count\s*\};\s*\}\s*normalized_source_result\["total_count"\] = total_count;\s*return normalized_source_result;\s*\}/
  );
  assert.match(controlsSource, /let start_row = \(requested_page - 1\) \* requested_size;/);
  assert.match(
    controlsSource,
    /if \(!source_result_has_rows_envelope\) \{\s*return \{\s*"rows": limited_rows,\s*"total_count": total_count\s*\};\s*\}/
  );
  assert.match(controlsSource, /normalized_source_result\["rows"\] = limited_rows;/);
  assert.match(controlsSource, /normalized_source_result\["total_count"\] = total_count;/);
  assert.match(
    controlsSource,
    /if \(normalized_total_count == null \|\| Runtime\.json_to_i64\(normalized_total_count\) <= 0\) \{\s*let inferred_total_count = start_row \+ row_count;\s*if \(inferred_total_count < row_count\) \{\s*inferred_total_count = row_count;\s*\}\s*normalized_total_count = runtime_ui_json_number_from_int\(inferred_total_count\);\s*\}/
  );
  assert.match(
    controlsSource,
    /source_result = runtime_ui_normalize_grid_source_result\(\s*control_metadata,\s*source_input,\s*source_result\s*\);/
  );
});

test('business/ui runtime prefers paginated or source-backed datagrids for shared grid responses', () => {
  const controlsSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.controls.functions.bl'),
    'utf8'
  );

  assert.match(
    controlsSource,
    /let fallback_grid_response = null;/
  );
  assert.match(
    controlsSource,
    /let source_handler = runtime_ui_resolve_control_source_handler\(control_metadata\);/
  );
  assert.match(
    controlsSource,
    /let source_dispatch_target = runtime_ui_resolve_control_source_dispatch_target\(\s*control_metadata\s*\);/s
  );
  assert.match(
    controlsSource,
    /let has_pagination_path = pagination_path != "";/ 
  );
  assert.match(
    controlsSource,
    /let is_source_backed_grid = source_handler != "" \|\| source_dispatch_target != "";/ 
  );
  assert.match(
    controlsSource,
    /if \(has_pagination_path \|\| is_source_backed_grid\) \{\s*return grid_response;\s*\}/s
  );
  assert.match(
    controlsSource,
    /if \(fallback_grid_response == null\) \{\s*fallback_grid_response = grid_response;\s*\}/s
  );
  assert.match(
    controlsSource,
    /return fallback_grid_response \?\? \{\};/
  );
  assert.match(
    controlsSource,
    /let should_replace_grid_response =\s*grid_response\["rows"\] == null\s*\|\|\s*pagination_path != "";/s
  );
});

test('business/ui runtime grid metadata falls back to declaration on_load handlers before inferring pagination', () => {
  const controlsSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );

  assert.match(
    controlsSource,
    /let declaration_load_handler = runtime_ui_find_declaration_text_property\(\s*control_declaration_json,\s*"on_load"\s*\);/
  );
  assert.match(
    controlsSource,
    /source_handler = runtime_ui_resolve_reflected_control_source_handler\(\s*control_node_id,\s*form_field_from_node_id\s*\);/
  );
  assert.match(
    controlsSource,
    /if \(source_handler == "" && declaration_load_handler != ""\) \{\s*source_handler = declaration_load_handler;\s*\}/
  );
});

test('business/ui runtime load and source execution honor published dispatch targets', () => {
  const runtimeSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.functions.bl'),
    'utf8'
  );
  const executionSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.execution.functions.bl'),
    'utf8'
  );
  const controlsSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.controls.functions.bl'),
    'utf8'
  );

  assert.match(
    executionSource,
    /private function runtime_ui_resolve_form_load_dispatch_target\(form_metadata: Json\): string \{/
  );
  assert.match(executionSource, /Runtime\.json_to_str\(load_metadata\["dispatch_target"\]\)/);
  assert.match(runtimeSource, /let form_load_dispatch_target = runtime_ui_resolve_form_load_dispatch_target\(form_metadata\);/);
  assert.match(
    runtimeSource,
    /if \(form_load_handler != "" \|\| form_load_dispatch_target != ""\) \{/
  );
  assert.match(
    runtimeSource,
    /runtime_ui_dispatch_target_requires_handler\(form_load_dispatch_target\)/
  );
  assert.match(executionSource, /let load_dispatch_target = runtime_ui_resolve_form_load_dispatch_target\(form_metadata\);/);
  assert.match(executionSource, /if \(load_dispatch_target == ""\) \{\s*load_dispatch_target = load_handler;\s*\}/);
  assert.match(
    controlsSource,
    /private function runtime_ui_resolve_control_source_dispatch_target\(control_metadata: Json\): string \{/
  );
  assert.match(controlsSource, /Runtime\.json_to_str\(source\["dispatch_target"\]\)/);
  assert.match(
    controlsSource,
    /let source_dispatch_target = runtime_ui_resolve_control_source_dispatch_target\(control_metadata\);/
  );
  assert.match(
    controlsSource,
    /\(source_handler != "" \|\| source_dispatch_target != ""\)/
  );
  assert.match(
    controlsSource,
    /runtime_ui_dispatch_target_requires_handler\(source_dispatch_target\)/
  );
  assert.match(
    controlsSource,
    /if \(source_dispatch_target == ""\) \{\s*source_dispatch_target = source_handler;\s*\}/
  );
  assert.doesNotMatch(controlsSource, /Runtime\.json_to_str\(source\["dispatchTarget"\]\)/);
});

test('business/ui runtime execution keeps canonical load param metadata only', () => {
  const executionSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.execution.functions.bl'),
    'utf8'
  );
  const metadataSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );

  assert.match(executionSource, /Runtime\.json_to_str\(form_metadata\["load_param"\]\)/);
  assert.doesNotMatch(executionSource, /form_metadata\["properties"\]/);
  assert.doesNotMatch(executionSource, /properties\["load_param"\]/);
  assert.doesNotMatch(executionSource, /form_metadata\["loadParam"\]/);
  assert.doesNotMatch(executionSource, /properties\["loadParam"\]/);
  assert.doesNotMatch(executionSource, /matched_open_arg_count == 1/);
  assert.doesNotMatch(executionSource, /matched_open_arg_value = internal_form_state\.open_args\[field_name/);
  assert.doesNotMatch(executionSource, /runtime_ui_resolve_form_load_binding_field_name/);
  assert.doesNotMatch(executionSource, /field_name \+ "_value"/);
  assert.doesNotMatch(executionSource, /open_args\[load_binding_field_name\]/);
  assert.doesNotMatch(executionSource, /binding_state\[load_binding_field_name\]/);
  assert.doesNotMatch(executionSource, /execution_form_state\[load_binding_field_name\]/);
  assert.match(metadataSource, /"load_param": load_param/);
  assert.match(metadataSource, /let load_param = runtime_ui_published_property_value\(form_node_json, "load_param"\);/);
  assert.match(metadataSource, /reflected_load_handler = runtime_ui_find_form_header_symbol_property\(form_node_json, "load"\);/);
  assert.match(metadataSource, /let reflected_load_param = Runtime\.json_to_str\(form_text_properties\["load_param"\]\);/);
  assert.doesNotMatch(metadataSource, /runtime_ui_find_handler_primary_parameter_name/);
});

test('business/ui runtime execution keeps canonical state field type metadata only', () => {
  const executionSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.execution.functions.bl'),
    'utf8'
  );
  const metadataSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );

  assert.match(executionSource, /Runtime\.json_to_str\(state_field\["value_type"\]\)/);
  assert.doesNotMatch(executionSource, /Runtime\.json_to_str\(state_field\["type"\]\)/);
  assert.doesNotMatch(executionSource, /state_field\["valueType"\]/);
  assert.doesNotMatch(metadataSource, /"type": value_type != "" \? value_type : null,/);
  assert.match(metadataSource, /"value_type": value_type != "" \? value_type : null/);
});

test('business/ui runtime dispatch keeps canonical binding state metadata only', () => {
  const dispatchSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui_dispatch.functions.bl'),
    'utf8'
  );

  assert.match(dispatchSource, /result\["form_state"\]\s*=\s*result_json\["form_state"\];/);
  assert.match(dispatchSource, /result\["binding_state"\]\s*=\s*result_json\["binding_state"\];/);
  assert.match(dispatchSource, /result\["transfer_payload"\]\s*=\s*result_json\["transfer_payload"\];/);
  assert.doesNotMatch(dispatchSource, /result_json\["formState"\]/);
  assert.doesNotMatch(dispatchSource, /result_json\["bindingState"\]/);
  assert.doesNotMatch(dispatchSource, /result_json\["transferPayload"\]/);
  assert.doesNotMatch(dispatchSource, /result_json\["binding"\]\["state"\]/);
});

test('business/ui runtime sessions keep canonical button binding metadata only', () => {
  const sessionSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui_session.functions.bl'),
    'utf8'
  );

  assert.match(sessionSource, /button_entry\["binding_path"\]/);
  assert.match(sessionSource, /button_entry\["selection_path"\]/);
  assert.doesNotMatch(sessionSource, /button_entry\["record_path"\]/);
});

test('business/ui runtime controls keep canonical binding path metadata only', () => {
  const controlsSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.controls.functions.bl'),
    'utf8'
  );
  const metadataSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );

  assert.match(controlsSource, /normalized_control_metadata\["binding_path"\]/);
  assert.match(controlsSource, /control_metadata\["binding_path"\]/);
  assert.doesNotMatch(controlsSource, /bindingPath/);
  assert.match(metadataSource, /"binding_path": "state\." \+ field_name/);
  assert.match(metadataSource, /let binding_path = runtime_ui_metadata_entry_text_value\(published_entry, base_entry, "binding_path"\);/);
});

test('business/ui runtime controls keep canonical source metadata only', () => {
  const metadataSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );
  const controlsSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.controls.functions.bl'),
    'utf8'
  );

  assert.match(metadataSource, /private function runtime_ui_find_first_descendant_symbol_name_by_mode_internal\(\s*node_id: string,\s*skipped_kind: string,\s*callable_only: bool\s*\): string \{/s);
  assert.match(metadataSource, /private function runtime_ui_find_first_descendant_result_internal\(\s*node_id: string,\s*match_mode: string,\s*property_name: string,\s*name_fragment_field_name: string,\s*expected_kind: string,\s*expected_symbol_name: string,\s*skipped_kind: string,\s*callable_only: bool\s*\): string \{/s);
  assert.match(metadataSource, /return runtime_ui_find_first_descendant_symbol_name_internal\(node_id, ""\);/);
  assert.match(metadataSource, /private function runtime_ui_find_first_descendant_symbol_name_skipping_kind\(/);
  assert.match(metadataSource, /return runtime_ui_find_first_descendant_symbol_name_internal\(node_id, skipped_kind\);/);
  assert.match(metadataSource, /return runtime_ui_find_first_descendant_symbol_name_by_mode_internal\(node_id, "", true\);/);
  assert.match(metadataSource, /return runtime_ui_find_first_descendant_result_internal\(\s*node_id,\s*"symbol",\s*"",\s*"",\s*"",\s*"",\s*skipped_kind,\s*callable_only\s*\);/s);
  assert.match(metadataSource, /private function runtime_ui_find_form_field_property_handler\(\s*control_node_id: string,\s*property_key_symbol_names: Json\s*\): string \{/);
  assert.match(metadataSource, /private function runtime_ui_resolve_form_field_property_handler\(\s*form_field_property_node_id: string,\s*excluded_symbol_names: Json\s*\): string \{/);
  assert.match(metadataSource, /let form_field_properties_node_id = runtime_ui_find_child_node_id_by_kind\(\s*normalized_control_node_id,\s*"formFieldProperties"\s*\);/);
  assert.match(metadataSource, /let normalized_control_node_id = Runtime\.json_to_str\(control_node_id\);/);
  assert.match(metadataSource, /normalized_control_node_id,\s*"formFieldProperties"/s);
  assert.match(metadataSource, /for \(form_field_property_node_id in runtime_ui_list_child_node_ids\(form_field_properties_node_id\)\) \{/);
  assert.match(metadataSource, /private function runtime_ui_reflect_control_source_handler\(\s*control_node_id: string,\s*form_field_from_node_id: string\s*\): string \{/s);
  assert.match(metadataSource, /let normalized_control_node_id = Runtime\.json_to_str\(control_node_id\);/);
  assert.match(metadataSource, /let load_event_handler = runtime_ui_find_form_field_property_handler\(\s*normalized_control_node_id,\s*\[\s*"load"\s*\]\s*\);/s);
  assert.match(metadataSource, /if \(load_event_handler != ""\) \{\s*return load_event_handler;\s*\}/s);
  assert.match(metadataSource, /let form_source_expression_node_id = runtime_ui_find_child_node_id_by_kind\(\s*normalized_form_field_from_node_id,\s*"formSourceExpression"\s*\);/);
  assert.match(metadataSource, /let direct_source_handler = runtime_ui_resolve_node_symbol_name\(\s*ast\.node_to_json\(form_source_identifier_node_id\)\s*\);/);
  assert.match(metadataSource, /return runtime_ui_find_first_descendant_symbol_name_skipping_kind\(/);
  assert.match(metadataSource, /"arguments"/);
  assert.match(metadataSource, /source_handler = runtime_ui_reflect_control_source_handler\(\s*control_node_id,\s*form_field_from_node_id\s*\);/);
  assert.match(metadataSource, /control_metadata\["source"\] = \{/);
  assert.match(metadataSource, /"name": source_handler/);
  assert.match(metadataSource, /"kind": "query"/);
  assert.match(metadataSource, /"dispatch_target": source_handler/);
  assert.doesNotMatch(metadataSource, /control_metadata\["data_source"\]/);
  assert.doesNotMatch(metadataSource, /control_metadata\["dataSource"\]/);
  assert.doesNotMatch(metadataSource, /properties\["data_source"\]/);
  assert.doesNotMatch(metadataSource, /properties\["dataSource"\]/);
  assert.match(controlsSource, /source\["name"\]/);
  assert.doesNotMatch(controlsSource, /source\["function"\]/);
  assert.doesNotMatch(controlsSource, /control_metadata\["data_source"\]/);
  assert.doesNotMatch(controlsSource, /control_metadata\["dataSource"\]/);
  assert.doesNotMatch(controlsSource, /control_metadata\["source_function"\]/);
  assert.doesNotMatch(controlsSource, /control_metadata\["sourceFunction"\]/);
});

test('business/ui runtime controls keep canonical source payload metadata only', () => {
  const controlsSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.controls.functions.bl'),
    'utf8'
  );

  assert.match(controlsSource, /normalized_source_input\["filter_model"\]\s*=\s*control_runtime_state\["filterModel"\];/);
  assert.match(controlsSource, /normalized_source_input\["search_text"\]\s*=\s*control_runtime_state\["searchQuery"\];/);
  assert.match(controlsSource, /normalized_source_input\["sort_key"\]\s*=\s*control_runtime_state\["sortKey"\];/);
  assert.match(controlsSource, /normalized_source_input\["sort_direction"\]\s*=\s*control_runtime_state\["sortDirection"\];/);
  assert.doesNotMatch(controlsSource, /normalized_source_input\["search_query"\]/);
  assert.doesNotMatch(controlsSource, /normalized_source_input\["filterModel"\]/);
  assert.doesNotMatch(controlsSource, /normalized_source_input\["searchText"\]/);
  assert.doesNotMatch(controlsSource, /normalized_source_input\["searchQuery"\]/);
  assert.doesNotMatch(controlsSource, /normalized_source_input\["sortKey"\]/);
  assert.doesNotMatch(controlsSource, /normalized_source_input\["sortDirection"\]/);
  assert.doesNotMatch(controlsSource, /source_result\["totalCount"\]/);
  assert.doesNotMatch(controlsSource, /source_result\["count"\]/);
  assert.doesNotMatch(controlsSource, /source_result\["items"\]/);
  assert.doesNotMatch(controlsSource, /source_result\["data"\]/);
});

test('business/ui runtime descendant boolean lookups share one traversal helper', () => {
  const metadataSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );

  assert.match(
    metadataSource,
    /private function runtime_ui_find_first_matching_descendant_value_internal\(\s*node_id: string,\s*property_name: string,\s*name_fragment_field_name: string,\s*expected_kind: string,\s*expected_symbol_name: string\s*\): string \{/s
  );
  assert.match(
    metadataSource,
    /return runtime_ui_find_first_descendant_result_internal\(\s*node_id,\s*"value",\s*property_name,\s*name_fragment_field_name,\s*expected_kind,\s*expected_symbol_name,\s*"",\s*false\s*\);/s
  );
  assert.match(
    metadataSource,
    /return runtime_ui_find_first_matching_descendant_value_internal\(\s*node_id,\s*"",\s*"",\s*expected_kind,\s*expected_symbol_name\s*\) != "";/s
  );
  assert.match(
    metadataSource,
    /return runtime_ui_node_or_descendant_matches_internal\(node_id, "", expected_symbol_name\);/
  );
});

test('business/ui runtime descendant collectors share one traversal helper', () => {
  const metadataSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );

  assert.match(
    metadataSource,
    /private function runtime_ui_collect_descendant_values_internal\(\s*node_id: string,\s*expected_kind: string,\s*collect_symbol_names: bool\s*\): Json \{/s
  );
  assert.match(
    metadataSource,
    /return runtime_ui_collect_descendant_values_internal\(node_id, expected_kind, false\);/
  );
  assert.match(
    metadataSource,
    /return runtime_ui_collect_descendant_values_internal\(node_id, "", true\);/
  );
});

test('business/ui runtime descendant text lookups share one traversal helper', () => {
  const metadataSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );

  assert.match(
    metadataSource,
    /private function runtime_ui_find_first_matching_descendant_value_internal\(\s*node_id: string,\s*property_name: string,\s*name_fragment_field_name: string,\s*expected_kind: string,\s*expected_symbol_name: string\s*\): string \{/s
  );
  assert.match(
    metadataSource,
    /return runtime_ui_find_first_descendant_result_internal\(\s*node_id,\s*"value",\s*property_name,\s*name_fragment_field_name,\s*expected_kind,\s*expected_symbol_name,\s*"",\s*false\s*\);/s
  );
  assert.match(
    metadataSource,
    /private function runtime_ui_find_first_descendant_text_value_internal\(\s*node_id: string,\s*property_name: string,\s*name_fragment_field_name: string\s*\): string \{/s
  );
  assert.match(
    metadataSource,
    /return runtime_ui_find_first_matching_descendant_value_internal\(\s*node_id,\s*property_name,\s*name_fragment_field_name,\s*"",\s*""\s*\);/s
  );
  assert.match(
    metadataSource,
    /return runtime_ui_find_first_descendant_text_value_internal\(\s*node_id,\s*"",\s*normalized_field_name\s*\);/s
  );
  assert.match(
    metadataSource,
    /return runtime_ui_find_first_descendant_text_value_internal\(node_id, "literal_text", ""\);/
  );
});

test('business/ui runtime startup form resolution reuses one mounted-target helper', () => {
  const metadataSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );

  const startupResolutionBlock = metadataSource
    .split('private function runtime_ui_find_startup_form_id_with_mounted_targets(')[1]
    ?.split('private function runtime_ui_find_startup_form_id(')[0] || '';
  const appMetadataBlock = metadataSource
    .split('private function runtime_ui_build_app_metadata_with_forms_and_mounted_targets(')[1]
    ?.split('private function runtime_ui_build_app_metadata_with_forms(')[0] || '';

  assert.match(
    metadataSource,
    /private function runtime_ui_resolve_startup_form_id_against_mounted_targets\(\s*mounted_targets: Json,\s*startup_form_id: string\s*\): string \{/
  );
  assert.match(
    metadataSource,
    /private function runtime_ui_resolve_direct_startup_form_id_with_mounted_targets\(\s*app_node_json: Json,\s*mounted_targets: Json\s*\): string \{/
  );
  assert.match(
    metadataSource,
    /let direct_startup_form_id = Runtime\.json_to_str\(\s*runtime_ui_property_value\(app_node_json, "startup_form_id"\)\s*\);/s
  );
  assert.match(
    metadataSource,
    /return runtime_ui_resolve_startup_form_id_against_mounted_targets\(\s*mounted_targets,\s*direct_startup_form_id\s*\);/
  );
  assert.match(
    startupResolutionBlock,
    /return runtime_ui_resolve_startup_form_id_against_mounted_targets\(\s*mounted_targets,\s*startup_form_id\s*\);/
  );
  assert.match(
    startupResolutionBlock,
    /return runtime_ui_resolve_direct_startup_form_id_with_mounted_targets\(\s*app_node_json,\s*mounted_targets\s*\);/
  );
  assert.match(
    appMetadataBlock,
    /let startup_form_id = runtime_ui_resolve_direct_startup_form_id_with_mounted_targets\(\s*app_node_json,\s*mounted_targets\s*\);/
  );
});

test('business/ui runtime app mounted-target wrappers share one helper', () => {
  const metadataSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );

  assert.match(
    metadataSource,
    /private function runtime_ui_resolve_app_mounted_targets\(app_node_json: Json\): Json \{\s*return runtime_ui_build_mounted_form_target_index_for_app\(app_node_json\);\s*\}/s
  );
  assert.match(
    metadataSource,
    /private function runtime_ui_find_mounted_form_target_for_app\([\s\S]*runtime_ui_resolve_app_mounted_targets\(app_node_json\),\s*mounted_form_id\s*\);/
  );
  assert.match(
    metadataSource,
    /private function runtime_ui_build_app_metadata_with_forms\(app_node_json: Json, forms: Json\): Json \{[\s\S]*runtime_ui_resolve_app_mounted_targets\(app_node_json\)\s*\);/
  );
});

test('business/ui runtime property-node analysis is shared across button and form metadata', () => {
  const metadataSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );

  const formHeaderBlock = metadataSource
    .split('private function runtime_ui_collect_form_header_property_analysis(form_node_json: Json): Json {')[1]
    ?.split('private function runtime_ui_build_form_metadata_core(')[0] || '';

  assert.match(
    metadataSource,
    /private function runtime_ui_collect_property_node_analyses\(\s*node_json: Json,\s*property_node_kinds: Json\s*\): Json \{/
  );
  assert.match(
    metadataSource,
    /return runtime_ui_collect_property_node_analyses\(\s*button_node_json,\s*\[\s*"buttonProperty"\s*\]\s*\);/
  );
  assert.match(
    formHeaderBlock,
    /let property_node_analyses = runtime_ui_collect_property_node_analyses\(\s*form_node_json,\s*property_node_kinds\s*\);/
  );
});

test('business/ui runtime text-property assignment is shared across analyzed property consumers', () => {
  const metadataSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );

  const formHeaderBlock = metadataSource
    .split('private function runtime_ui_collect_form_header_property_analysis(form_node_json: Json): Json {')[1]
    ?.split('private function runtime_ui_build_form_metadata_core(')[0] || '';
  const declarationTextBlock = metadataSource
    .split('private function runtime_ui_collect_declaration_text_properties(')[1]
    ?.split('private function runtime_ui_node_or_descendant_has_kind(')[0] || '';

  assert.match(
    metadataSource,
    /private function runtime_ui_assign_text_properties_from_property_analysis\(\s*target_properties: Json,\s*property_node_analysis: Json,\s*property_names: Json\s*\): Json \{/
  );
  assert.match(
    formHeaderBlock,
    /runtime_ui_assign_text_properties_from_property_analysis\(\s*analysis\["text_properties"\],\s*property_node_analysis,\s*text_property_names\s*\);/
  );
  assert.match(
    declarationTextBlock,
    /runtime_ui_assign_text_properties_from_property_analysis\(\s*collected_properties,\s*button_property_analysis,\s*property_names\s*\);/
  );
});

test('business/ui runtime form collection delegates through lookup-based builders', () => {
  const metadataSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );
  assert.match(
    metadataSource,
    /private function runtime_ui_collect_forms_for_app_with_builder\(\s*app_node_json: Json,\s*use_detailed_metadata: bool\s*\): Json \{/
  );
  assert.match(
    metadataSource,
    /return runtime_ui_collect_form_nodes_with_builder\(\s*form_lookup\.ordered \?\? \[\],\s*use_detailed_metadata\s*\);/s
  );
  assert.match(
    metadataSource,
    /private function runtime_ui_resolve_app_form_lookup\(app_node_json: Json\): Json \{\s*return runtime_ui_build_form_node_lookup_for_app\(app_node_json\);\s*\}/s
  );
  assert.match(
    metadataSource,
    /return runtime_ui_collect_forms_from_lookup_with_builder\(\s*runtime_ui_resolve_app_form_lookup\(app_node_json\),\s*use_detailed_metadata\s*\);/s
  );
});

test('business/ui runtime button event accessors reuse shared analysis extractors', () => {
  const metadataSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );

  assert.match(
    metadataSource,
    /private function runtime_ui_resolve_button_click_dispatch_target\(\s*button_event_analysis: Json\s*\): string \{/
  );
  assert.match(
    metadataSource,
    /return runtime_ui_resolve_button_click_dispatch_target\(\s*runtime_ui_analyze_button_event_metadata\(button_node_json\)\s*\);/s
  );
  assert.match(
    metadataSource,
    /private function runtime_ui_resolve_button_navigate_reference\(\s*button_event_analysis: Json\s*\): string \{/
  );
  assert.match(
    metadataSource,
    /return runtime_ui_resolve_button_navigate_reference\(\s*runtime_ui_analyze_button_event_metadata\(button_node_json\)\s*\);/s
  );
  assert.match(
    metadataSource,
    /private function runtime_ui_resolve_button_target_form\(\s*button_event_analysis: Json\s*\): string \{/
  );
  assert.match(
    metadataSource,
    /let button_event_analysis = runtime_ui_analyze_button_event_metadata\(button_node_json\);\s*return runtime_ui_resolve_button_click_dispatch_target\(button_event_analysis\);/s
  );
});

test('business/ui runtime published string fallback is shared across app and form metadata', () => {
  const metadataSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );

  assert.match(
    metadataSource,
    /private function runtime_ui_resolve_published_string_property_with_reflected_text\(\s*node_json: Json,\s*property_name: string,\s*reflected_text_properties: Json\s*\): string \{/
  );
  assert.match(
    metadataSource,
    /let form_title = runtime_ui_resolve_published_string_property_with_reflected_text\(\s*form_node_json,\s*"title",\s*form_text_properties\s*\);/s
  );
  assert.match(
    metadataSource,
    /let form_description = runtime_ui_resolve_published_string_property_with_reflected_text\(\s*form_node_json,\s*"description",\s*form_text_properties\s*\);/s
  );
  assert.match(
    metadataSource,
    /let app_title = runtime_ui_resolve_published_string_property_with_reflected_text\(\s*app_node_json,\s*"title",\s*app_text_properties\s*\);/s
  );
  assert.match(
    metadataSource,
    /let app_technical = runtime_ui_resolve_published_string_property_with_reflected_text\(\s*app_node_json,\s*"technical",\s*app_text_properties\s*\);/s
  );
});

test('business/ui runtime symbol-property target resolution is shared across metadata consumers', () => {
  const metadataSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );

  assert.match(
    metadataSource,
    /private function runtime_ui_resolve_symbol_property_target_from_analysis\(\s*property_analysis: Json,\s*property_name: string\s*\): string \{/
  );
  assert.match(
    metadataSource,
    /let property_symbol_target = runtime_ui_resolve_symbol_property_target_from_analysis\(\s*child_property_analysis,\s*normalized_property_name\s*\);/
  );
  assert.match(
    metadataSource,
    /let property_symbol_target = runtime_ui_resolve_symbol_property_target_from_analysis\(\s*property_node_analysis,\s*normalized_symbol_property_name\s*\);/
  );
});

test('business/ui runtime app metadata wrappers share one lookup-mode builder', () => {
  const metadataSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );

  assert.match(
    metadataSource,
    /private function runtime_ui_build_app_metadata_with_lookup_mode\(\s*app_node_json: Json,\s*use_detailed_metadata: bool\s*\): Json \{/
  );
  assert.match(
    metadataSource,
    /let form_lookup = runtime_ui_resolve_app_form_lookup\(app_node_json\);/
  );
  assert.match(
    metadataSource,
    /\? runtime_ui_build_detailed_app_metadata_from_lookup\(app_node_json, form_lookup\)\s*: runtime_ui_build_app_metadata_from_lookup\(app_node_json, form_lookup\);/s
  );
  assert.match(
    metadataSource,
    /private function runtime_ui_build_app_metadata\(app_node_json: Json\): Json \{\s*return runtime_ui_build_app_metadata_with_lookup_mode\(app_node_json, false\);\s*\}/s
  );
  assert.match(
    metadataSource,
    /private function runtime_ui_build_detailed_app_metadata\(app_node_json: Json\): Json \{\s*return runtime_ui_build_app_metadata_with_lookup_mode\(app_node_json, true\);\s*\}/s
  );
  assert.match(
    metadataSource,
    /private function runtime_ui_build_app_metadata_from_lookup_mode\(\s*app_node_json: Json,\s*form_lookup: Json,\s*use_detailed_metadata: bool\s*\): Json \{/
  );
  assert.match(
    metadataSource,
    /runtime_ui_collect_form_nodes_with_builder\(form_lookup\.ordered \?\? \[\], use_detailed_metadata\)/
  );
  assert.match(
    metadataSource,
    /private function runtime_ui_build_app_metadata_from_lookup\([\s\S]*return runtime_ui_build_app_metadata_from_lookup_mode\(\s*app_node_json,\s*form_lookup,\s*false\s*\);/
  );
  assert.match(
    metadataSource,
    /private function runtime_ui_build_detailed_app_metadata_from_lookup\([\s\S]*return runtime_ui_build_app_metadata_from_lookup_mode\(\s*app_node_json,\s*form_lookup,\s*true\s*\);/
  );
});

test('business/ui runtime app metadata finders share one detail-mode helper', () => {
  const metadataSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );

  assert.match(
    metadataSource,
    /private function runtime_ui_find_app_metadata_with_detail_mode\(\s*app_id: string,\s*use_detailed_metadata: bool\s*\): Json \{/
  );
  assert.match(
    metadataSource,
    /let app_node_json = runtime_ui_find_app_node\(app_id\);/
  );
  assert.match(
    metadataSource,
    /\? runtime_ui_build_detailed_app_metadata\(app_node_json\)\s*: runtime_ui_build_app_metadata\(app_node_json\);/s
  );
  assert.match(
    metadataSource,
    /private function runtime_ui_find_app_metadata\(app_id: string\): Json \{\s*return runtime_ui_find_app_metadata_with_detail_mode\(app_id, false\);\s*\}/s
  );
  assert.match(
    metadataSource,
    /private function runtime_ui_find_detailed_app_metadata\(app_id: string\): Json \{\s*return runtime_ui_find_app_metadata_with_detail_mode\(app_id, true\);\s*\}/s
  );
});

test('business/ui runtime symbol-matched node lookups share one helper', () => {
  const metadataSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );

  assert.match(
    metadataSource,
    /private function runtime_ui_find_first_node_match_by_symbol_name\(\s*node_matches: Json,\s*symbol_name: string\s*\): Json \{/
  );
  assert.match(metadataSource, /let normalized_symbol_name = Runtime\.json_to_str\(symbol_name\);/);
  assert.match(metadataSource, /for \(node_match in node_matches \?\? \[\]\) \{/);
  assert.match(metadataSource, /let node_json = ast\.node_to_json\(runtime_ui_match_node_id\(node_match\)\);/);
  assert.match(metadataSource, /if \(runtime_ui_resolve_node_symbol_name\(node_json\) == normalized_symbol_name\) \{/);
  assert.match(
    metadataSource,
    /private function runtime_ui_find_button_node_in_form_lookup\([\s\S]*return runtime_ui_find_first_node_match_by_symbol_name\(button_nodes, normalized_button_id\);/
  );
  assert.match(
    metadataSource,
    /private function runtime_ui_find_named_declaration_node_by_kind\([\s\S]*return runtime_ui_find_first_node_match_by_symbol_name\(\s*declaration_nodes,\s*normalized_symbol_name\s*\);/
  );
});

test('business/ui runtime lookup http keeps canonical associated field metadata only', () => {
  const runtimeSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.functions.bl'),
    'utf8'
  );
  const metadataSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );
  const controlsSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.controls.functions.bl'),
    'utf8'
  );

  assert.match(
    runtimeSource,
    /private function runtime_ui_resolve_session_form_metadata\(\s*app_id: string,\s*form_id: string\s*\): Json \{/
  );
  assert.match(
    runtimeSource,
    /private function runtime_ui_resolve_active_session_form_context\(\s*session_id: string,\s*form_instance_id: string,\s*revision: int,\s*requested_app_id: string,\s*requested_form_id: string,\s*session_context: Json\s*\): Json \{/
  );
  assert.match(runtimeSource, /"ownership_matches": ownership_matches,/);
  assert.match(runtimeSource, /"session_context_matches": session_context_matches,/);
  assert.match(runtimeSource, /"revision_matches": revision_matches,/);
  assert.match(runtimeSource, /"app_id_matches": app_id_matches,/);
  assert.match(runtimeSource, /"form_id_matches": form_id_matches,/);
  assert.match(
    runtimeSource,
    /let app_metadata = runtime_ui_find_detailed_app_metadata\(app_id\);/
  );
  assert.match(
    runtimeSource,
    /"form": runtime_ui_find_form_metadata\(app_metadata, form_id\)/
  );
  assert.match(
    runtimeSource,
    /let metadata_context = session_form_context\["metadata_context"\];/
  );
  assert.match(
    runtimeSource,
    /let session_form_context = runtime_ui_resolve_active_session_form_context\(\s*normalized_session_id,\s*normalized_form_instance_id,\s*normalized_revision,\s*normalized_app_id,\s*normalized_form_id,\s*normalized_session_context\s*\);/
  );
  assert.match(runtimeSource, /let app_session = session_form_context\["app_session"\];/);
  assert.match(runtimeSource, /let form_session = session_form_context\["form_session"\];/);
  assert.match(runtimeSource, /raise runtime_ui_lookup_app_session_not_found;/);
  assert.match(runtimeSource, /raise runtime_ui_lookup_form_session_not_found;/);
  assert.match(runtimeSource, /raise runtime_ui_lookup_session_ownership_mismatch;/);
  assert.match(runtimeSource, /raise runtime_ui_lookup_session_context_mismatch;/);
  assert.match(runtimeSource, /raise runtime_ui_lookup_revision_mismatch;/);
  assert.match(runtimeSource, /raise runtime_ui_lookup_app_id_mismatch;/);
  assert.match(runtimeSource, /raise runtime_ui_lookup_form_id_mismatch;/);
  assert.match(runtimeSource, /raise runtime_ui_lookup_app_metadata_not_found;/);
  assert.match(runtimeSource, /raise runtime_ui_lookup_form_metadata_not_found;/);
  assert.match(
    runtimeSource,
    /private function runtime_ui_resolve_optional_control_context\(\s*form_instance_id: string,\s*control_id: string,\s*form_metadata: Json\s*\): Json \{/
  );
  assert.match(runtimeSource, /let control_metadata = control_context\["control_metadata"\];/);
  assert.match(runtimeSource, /let control_metadata = runtime_ui_find_control_metadata\(form_metadata, normalized_control_id\);/);
  assert.match(runtimeSource, /raise runtime_ui_lookup_control_metadata_not_found;/);
  assert.match(runtimeSource, /raise runtime_ui_lookup_session_context_persist_failed;/);
  assert.match(metadataSource, /let table = runtime_ui_metadata_entry_text_value\(published_entry, base_entry, "table"\);/);
  assert.match(metadataSource, /let field = runtime_ui_metadata_entry_text_value\(published_entry, base_entry, "field"\);/);
  assert.match(metadataSource, /let associated_fields = runtime_ui_metadata_entry_value\(/);
  assert.match(metadataSource, /let display_field = runtime_ui_metadata_entry_text_value\(/);
  assert.match(
    runtimeSource,
    /lookup_request\["associated_fields"\] = runtime_ui_http_request_value\(\s*request,\s*"associated_fields",\s*"associatedFields"\s*\);/
  );
  assert.match(
    runtimeSource,
    /let lookup_request = runtime_ui_build_http_active_form_request_base\(request\);/
  );
  assert.match(
    runtimeSource,
    /normalized_request\["session_id"\] = Runtime\.json_to_str\(\s*runtime_ui_http_request_value\(request, "session_id", "sessionId"\)/
  );
  assert.match(
    runtimeSource,
    /normalized_request\["form_instance_id"\] = Runtime\.json_to_str\(\s*runtime_ui_http_request_value\(request, "form_instance_id", "formInstanceId"\)/
  );
  assert.match(
    runtimeSource,
    /normalized_request\["app_id"\] = Runtime\.json_to_str\(\s*runtime_ui_http_request_value\(request, "app_id", "appId"\)/
  );
  assert.match(
    runtimeSource,
    /normalized_request\["form_id"\] = Runtime\.json_to_str\(\s*runtime_ui_http_request_value\(request, "form_id", "formId"\)/
  );
  assert.match(
    runtimeSource,
    /normalized_request\["control_id"\] = Runtime\.json_to_str\(\s*runtime_ui_http_request_value\(request, "control_id", "controlId"\)/
  );
  assert.match(controlsSource, /runtime_ui_lookup_origin_value\(request_origin, "table", "tableName"\)/);
  assert.match(controlsSource, /runtime_ui_lookup_origin_value\(request_origin, "associated_fields", "associatedFields"\)/);
  assert.match(controlsSource, /runtime_ui_lookup_origin_value\(request_origin, "display_field", "displayField"\)/);
  assert.doesNotMatch(controlsSource, /control_metadata\["source_table"\]/);
  assert.doesNotMatch(controlsSource, /control_metadata\["sourceTable"\]/);
  assert.doesNotMatch(controlsSource, /control_metadata\["lookup_table"\]/);
  assert.doesNotMatch(controlsSource, /control_metadata\["lookupTable"\]/);
  assert.doesNotMatch(controlsSource, /control_metadata\["associatedFields"\]/);
  assert.doesNotMatch(controlsSource, /control_metadata\["displayField"\]/);
});

test('business/ui runtime export http accepts both snake_case and camelCase request ids', () => {
  const runtimeSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.functions.bl'),
    'utf8'
  );

  assert.match(
    runtimeSource,
    /private function runtime_ui_build_http_active_form_request_base\(request: Json\): Json \{/
  );
  assert.match(
    runtimeSource,
    /let lookup_request = runtime_ui_build_http_active_form_request_base\(request\);/
  );
  assert.match(
    runtimeSource,
    /let export_request = runtime_ui_build_http_active_form_request_base\(request\);/
  );
  assert.match(
    runtimeSource,
    /normalized_request\["session_id"\] = Runtime\.json_to_str\(\s*runtime_ui_http_request_value\(request, "session_id", "sessionId"\)/
  );
  assert.match(
    runtimeSource,
    /normalized_request\["form_instance_id"\] = Runtime\.json_to_str\(\s*runtime_ui_http_request_value\(request, "form_instance_id", "formInstanceId"\)/
  );
  assert.match(
    runtimeSource,
    /normalized_request\["app_id"\] = Runtime\.json_to_str\(\s*runtime_ui_http_request_value\(request, "app_id", "appId"\)/
  );
  assert.match(
    runtimeSource,
    /normalized_request\["form_id"\] = Runtime\.json_to_str\(\s*runtime_ui_http_request_value\(request, "form_id", "formId"\)/
  );
  assert.match(
    runtimeSource,
    /normalized_request\["control_id"\] = Runtime\.json_to_str\(\s*runtime_ui_http_request_value\(request, "control_id", "controlId"\)/
  );
  assert.match(
    runtimeSource,
    /normalized_request\["context"\] = request\["context"\];/
  );
  assert.match(
    runtimeSource,
    /let session_form_context = runtime_ui_resolve_active_session_form_context\(\s*normalized_session_id,\s*normalized_form_instance_id,\s*normalized_revision,\s*normalized_app_id,\s*normalized_form_id,\s*normalized_session_context\s*\);/
  );
  assert.match(runtimeSource, /let app_session = session_form_context\["app_session"\];/);
  assert.match(runtimeSource, /let form_session = session_form_context\["form_session"\];/);
  assert.match(runtimeSource, /raise runtime_ui_export_app_session_not_found;/);
  assert.match(runtimeSource, /raise runtime_ui_export_form_session_not_found;/);
  assert.match(runtimeSource, /raise runtime_ui_export_session_ownership_mismatch;/);
  assert.match(runtimeSource, /raise runtime_ui_export_session_context_mismatch;/);
  assert.match(runtimeSource, /raise runtime_ui_export_revision_mismatch;/);
  assert.match(runtimeSource, /raise runtime_ui_export_app_id_mismatch;/);
  assert.match(runtimeSource, /raise runtime_ui_export_form_id_mismatch;/);
  assert.match(runtimeSource, /raise runtime_ui_export_app_metadata_not_found;/);
  assert.match(runtimeSource, /raise runtime_ui_export_form_metadata_not_found;/);
  assert.match(runtimeSource, /raise runtime_ui_export_control_metadata_not_found;/);
  assert.match(runtimeSource, /raise runtime_ui_export_session_context_persist_failed;/);
  const exportBlock = runtimeSource
    .split('public function runtime_ui_export(request: RuntimeUiExportRequest): Json {')[1]
    ?.split('@http(method: GET, path: "/ui/catalog")')[0] || '';
  assert.doesNotMatch(exportBlock, /"app_session": app_session/);
  assert.doesNotMatch(exportBlock, /"form_session": form_session/);
});

test('business/ui runtime apply debug keeps routing metadata out of execution payloads', () => {
  const runtimeSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.functions.bl'),
    'utf8'
  );
  const metadataSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );

  assert.doesNotMatch(runtimeSource, /"dispatch_target": execution_dispatch_target/);
  assert.doesNotMatch(runtimeSource, /"handler": execution_handler/);
  assert.doesNotMatch(runtimeSource, /"control_kind": execution_control_kind/);
  assert.doesNotMatch(runtimeSource, /"control_id": execution_control_id/);
  assert.doesNotMatch(runtimeSource, /"event": execution_event_name/);
  assert.doesNotMatch(runtimeSource, /"handled": execution_handled/);
  assert.doesNotMatch(runtimeSource, /"execution": \{/);
  assert.doesNotMatch(runtimeSource, /"navigation": execution_navigation/);
  assert.match(runtimeSource, /"event": normalized_event,/);
  assert.match(runtimeSource, /"debug": null,/);
  assert.match(runtimeSource, /"binding": runtime_ui_build_form_binding_context\(/);
  assert.match(metadataSource, /"handler": handler_debug,/);
  assert.match(metadataSource, /"dispatch": dispatch_debug/);
  assert.match(metadataSource, /"control": control_debug/);
  assert.doesNotMatch(metadataSource, /control_debug = \{\s*"control_id": control_id,/);
  assert.match(metadataSource, /control_debug = \{\s*"control_kind": control_kind\s*\};/);
  assert.doesNotMatch(metadataSource, /"form_source_path": Runtime\.json_to_str\(form_metadata\["source_path"\]\)/);
});

test('business/ui runtime handler lookup keeps local declaration kinds in the debug path', () => {
  const runtimeSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.functions.bl'),
    'utf8'
  );
  const metadataSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );

  assert.match(runtimeSource, /"debug": null,/);
  assert.match(runtimeSource, /"binding": runtime_ui_build_form_binding_context\(/);
  assert.match(metadataSource, /private function runtime_ui_resolve_handler_declaration\(handler_symbol: string\): Json \{/);
  assert.match(metadataSource, /private function runtime_ui_find_named_declaration_in_kinds\(\s*declaration_kinds: Json,\s*symbol_name: string\s*\): Json \{/);
  assert.match(metadataSource, /private function runtime_ui_find_named_handler_declaration_node\(handler_symbol: string\): Json \{/);
  assert.match(metadataSource, /"formEvent"/);
  assert.match(metadataSource, /"buttonEvent"/);
  assert.match(metadataSource, /"controlEvent"/);
  assert.match(metadataSource, /let supported_declaration_kinds: Json = \[[\s\S]*"formEvent"[\s\S]*"buttonEvent"[\s\S]*"controlEvent"[\s\S]*\];/);
  assert.match(metadataSource, /let supported_resolution = runtime_ui_find_named_declaration_in_kinds\(\s*supported_declaration_kinds,\s*normalized_handler_symbol\s*\);/);
  assert.match(metadataSource, /return runtime_ui_resolve_handler_declaration\(handler_symbol\)\["node"\];/);
  assert.match(
    metadataSource,
    /let handler_debug = runtime_ui_build_node_debug_descriptor\(\s*runtime_ui_find_named_handler_declaration_node\(handler_symbol\)\s*\);/s
  );
  assert.match(
    metadataSource,
    /dispatch_debug = runtime_ui_build_node_debug_descriptor\(\s*runtime_ui_find_named_handler_declaration_node\(dispatch_target\)\s*\);/s
  );
  assert.doesNotMatch(metadataSource, /runtime_ui_find_declaration_symbol_property_aliases/);
});

test('business/ui runtime handler guardrails classify unsupported kinds and invalid lowered return contracts', () => {
  const runtimeSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.functions.bl'),
    'utf8'
  );
  const metadataSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );
  const dispatchSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui_dispatch.functions.bl'),
    'utf8'
  );
  const messagesSource = fs.readFileSync(
    path.join(packageRoot, 'src/system/ui/runtime_ui.messages.bl'),
    'utf8'
  );

  assert.match(
    metadataSource,
    /private function runtime_ui_resolve_handler_reference_status\(handler_symbol: string\): string \{/
  );
  assert.match(metadataSource, /let handler_resolution = runtime_ui_resolve_handler_declaration\(normalized_handler_symbol\);/);
  assert.match(metadataSource, /let unsupported_resolution = runtime_ui_find_named_declaration_in_kinds\(\s*unsupported_declaration_kinds,\s*normalized_handler_symbol\s*\);/);
  assert.match(metadataSource, /if \(handler_resolution\["is_supported"\] != true\) \{\s*return "unsupported_kind";\s*\}/s);
  assert.match(metadataSource, /"invalid_return_contract"/);
  assert.match(
    metadataSource,
    /let supported_dispatch_declaration_kinds: Json = \[[\s\S]*"functionDeclaration"[\s\S]*"methodDeclaration"[\s\S]*"annotationMethod"[\s\S]*"formEvent"[\s\S]*"buttonEvent"[\s\S]*"controlEvent"[\s\S]*\];/
  );
  assert.match(
    metadataSource,
    /runtime_ui_build_binding_member_type\(\s*handler_return_type_expression_node_id\s*\)/s
  );
  assert.match(
    runtimeSource,
    /private function runtime_ui_require_resolved_handler_reference\(\s*handler_reference_status: string,\s*error_names: Json\s*\): void \{/
  );
  assert.match(
    runtimeSource,
    /runtime_ui_require_resolved_handler_reference\(form_load_handler_reference_status,\s*\{\s*"unsupported_kind": runtime_ui_open_form_load_handler_unsupported_declaration_kind,\s*"invalid_return_contract": runtime_ui_open_form_load_handler_invalid_return_contract,\s*"not_found": runtime_ui_open_form_load_handler_not_found\s*\}\);/s
  );
  assert.match(
    runtimeSource,
    /runtime_ui_require_resolved_handler_reference\(execution_handler_reference_status,\s*\{\s*"unsupported_kind": runtime_ui_apply_event_handler_unsupported_declaration_kind,\s*"invalid_return_contract": runtime_ui_apply_event_handler_invalid_return_contract,\s*"not_found": runtime_ui_apply_event_handler_not_found\s*\}\);/s
  );
  assert.match(
    runtimeSource,
    /if \(handler_reference_status == "unsupported_kind"\) \{\s*raise error_names\["unsupported_kind"\];\s*\}\s*if \(handler_reference_status == "invalid_return_contract"\) \{\s*raise error_names\["invalid_return_contract"\];\s*\}\s*if \(handler_reference_status != "resolved"\) \{\s*raise error_names\["not_found"\];\s*\}/s
  );
  assert.match(
    runtimeSource,
    /let runtime_context = runtime_ui_require_app_runtime_context\(normalized_app_id\);\s*let app_node_json = runtime_context\["app_node"\];\s*let form_lookup = runtime_context\["form_lookup"\];[\s\S]*let form_metadata = runtime_ui_find_detailed_form_metadata_in_lookup\(\s*form_lookup,\s*normalized_form_id\s*\);/s
  );
  assert.match(
    runtimeSource,
    /private function runtime_ui_resolve_apply_event_control_context\(\s*form_metadata: Json,\s*control_id: string\s*\): Json \{/
  );
  assert.match(
    runtimeSource,
    /let execution_control_context = runtime_ui_resolve_apply_event_control_context\(\s*form_metadata,\s*execution_control_id\s*\);/
  );
  assert.match(runtimeSource, /execution_control_metadata = execution_control_context\["control_metadata"\];/);
  assert.match(runtimeSource, /execution_button_metadata = execution_control_context\["button_metadata"\];/);
  assert.match(runtimeSource, /execution_control_kind = Runtime\.json_to_str\(execution_control_context\["control_kind"\]\);/);
  assert.doesNotMatch(runtimeSource, /raise runtime_ui_apply_event_control_session_not_found;/);
  assert.match(
    runtimeSource,
    /if \(execution_button_metadata != null\) \{\s*let button_click_event = execution_button_metadata\["events"\]\["click"\];\s*let metadata_button_handler = Runtime\.json_to_str\(button_click_event\["handler"\]\);\s*let metadata_button_dispatch_target = Runtime\.json_to_str\(\s*button_click_event\["dispatch_target"\]\s*\);\s*if \(execution_handler == "" && metadata_button_handler != ""\) \{\s*execution_handler = metadata_button_handler;\s*\}\s*if \(metadata_button_dispatch_target != ""\) \{\s*execution_dispatch_target = metadata_button_dispatch_target;\s*\} else \{\s*let resolved_button_dispatch_target =\s*runtime_ui_resolve_button_click_dispatch_target_in_lookup\(\s*form_lookup,\s*effective_form_id,\s*execution_control_id\s*\);/s
  );
  assert.match(
    dispatchSource,
    /if \(!runtime_ui_dispatch_result_json_is_valid\(result_json\)\) \{\s*raise runtime_ui_dispatch_result_contract_invalid;\s*\}/s
  );
  assert.match(messagesSource, /message runtime_ui_open_form_load_handler_unsupported_declaration_kind \{/);
  assert.match(messagesSource, /message runtime_ui_open_form_load_handler_invalid_return_contract \{/);
  assert.match(messagesSource, /message runtime_ui_apply_event_handler_unsupported_declaration_kind \{/);
  assert.match(messagesSource, /message runtime_ui_apply_event_handler_invalid_return_contract \{/);
});

test('business/ui lowering bundle keeps the direct dispatch ABI aligned', () => {
  const bundlePath = path.join(
    packageRoot,
    '..',
    'docs',
    'language',
    'grammar',
    'lowering',
    'bundle.lowering.ir.json'
  );
  const bundle = JSON.parse(fs.readFileSync(bundlePath, 'utf8'));
  const recipe = (bundle.recipe_manifests || []).find(
    (entry) => entry?.name === 'ui_dispatch_handler_native_ir'
  );
  const emittedArgs = recipe?.steps?.[0]?.emitted_call?.args || [];

  assert.deepEqual(recipe?.argument_slots, [
    'dispatch_target_symbol',
    'original_handler_symbol',
    'session_id',
    'form_instance_id',
    'app_id',
    'form_id',
    'control_id',
    'event_name',
    'revision',
    'form_state',
    'binding_state',
    'handler_input',
    'event'
  ]);
  assert.deepEqual(
    emittedArgs.map((arg) => arg?.source_name),
    recipe.argument_slots
  );
});

test('business/ui runtime export keeps the packaged runtime-object dependency surface', () => {
  const { source: runtimeAggregateSource } = readBusinessUiOwnExportSource('./runtime');
  const runtimeSurfaceSource = [
    readBusinessUiOwnExportSource('./runtime/functions').source,
    fs.readFileSync(path.join(packageRoot, 'src/system/ui/runtime_ui.execution.functions.bl'), 'utf8'),
    fs.readFileSync(path.join(packageRoot, 'src/system/ui/runtime_ui.binding.functions.bl'), 'utf8')
  ].join('\n');
  const { source: runtimeObjectFunctionsSource } = readBusinessUiOwnExportSource(
    './runtime-object/functions'
  );
  const { source: runtimeObjectTypesSource } = readBusinessUiOwnExportSource(
    './runtime-object/types'
  );

  assert.match(runtimeAggregateSource, /export \* from "ui\/runtime-object\/functions"/);
  assert.match(runtimeSurfaceSource, /runtime_object_create\(/);
  assert.match(runtimeSurfaceSource, /runtime_object_cast\(/);
  assert.match(runtimeSurfaceSource, /runtime_object_inspect\(/);
  assert.match(runtimeSurfaceSource, /runtime_object_serialize\(/);
  assert.match(runtimeObjectFunctionsSource, /public function runtime_object_create\(/);
  assert.match(runtimeObjectFunctionsSource, /public function runtime_object_cast\(/);
  assert.match(runtimeObjectFunctionsSource, /public function runtime_object_serialize\(/);
  assert.match(runtimeObjectTypesSource, /struct RuntimeObject \{/);
  assert.match(runtimeObjectTypesSource, /struct RuntimeObjectInspection \{/);

  const usedRuntimeObjectFunctions = Array.from(
    new Set(
      collectNamedMatches(runtimeSurfaceSource, /(runtime_object_[A-Za-z0-9_]+)\(/g)
    )
  ).sort();
  const declaredRuntimeObjectFunctions = Array.from(
    new Set(
      collectNamedMatches(
        runtimeObjectFunctionsSource,
        /public function (runtime_object_[A-Za-z0-9_]+)\(/g
      )
    )
  ).sort();

  assert.deepEqual(usedRuntimeObjectFunctions, [
    'runtime_object_cast',
    'runtime_object_create',
    'runtime_object_inspect',
    'runtime_object_matches_type',
    'runtime_object_serialize',
    'runtime_object_set_member'
  ]);
  for (const functionName of usedRuntimeObjectFunctions) {
    assert.equal(declaredRuntimeObjectFunctions.includes(functionName), true);
  }
});

test('business/ui runtime-object module keeps an exact public helper surface', () => {
  const { source: runtimeObjectFunctionsSource } = readBusinessUiOwnExportSource(
    './runtime-object/functions'
  );
  const { source: runtimeObjectTypesSource } = readBusinessUiOwnExportSource(
    './runtime-object/types'
  );

  const declaredRuntimeObjectFunctions = Array.from(
    new Set(
      collectNamedMatches(
        runtimeObjectFunctionsSource,
        /public function (runtime_object_[A-Za-z0-9_]+)\(/g
      )
    )
  ).sort();

  assert.deepEqual(declaredRuntimeObjectFunctions, [
    'runtime_object_cast',
    'runtime_object_create',
    'runtime_object_get_member',
    'runtime_object_has_member',
    'runtime_object_inspect',
    'runtime_object_kind',
    'runtime_object_matches_kind',
    'runtime_object_matches_type',
    'runtime_object_member_metadata',
    'runtime_object_serialize',
    'runtime_object_set_member',
    'runtime_object_type_name'
  ]);
  assert.match(runtimeObjectTypesSource, /struct RuntimeObject \{\s*type_name: string;/);
  assert.match(runtimeObjectTypesSource, /object_kind: string;/);
  assert.match(runtimeObjectTypesSource, /members: Json\?;/);
  assert.match(runtimeObjectTypesSource, /state: Json\?;/);
  assert.match(runtimeObjectTypesSource, /struct RuntimeObjectInspection \{/);
  assert.match(runtimeObjectTypesSource, /member_count: int;/);
  assert.match(runtimeObjectTypesSource, /has_members: bool;/);
  assert.match(runtimeObjectTypesSource, /has_state: bool;/);
});

test('business/ui packed source artifact contains only the packaged runtime surface', () => {
  const { manifest: pkg } = readBusinessUiOwnPackage();
  const { artifactSnapshotPath: packedArtifactPath } = packBusinessUiArtifact({
    tempPrefix: 'business-ui-boundary-surface'
  });

  assert.ok(packedArtifactPath.endsWith(`/ui-${pkg.version}.tgz`));
  assert.equal(fs.existsSync(packedArtifactPath), true);

  const packedEntries = listPackedBusinessUiEntries(packedArtifactPath);

  assert.deepEqual(packedEntries, expectedUiPackageFiles);

  assert.equal(packedEntries.includes('src/customer/master/customer.ui.bl'), false);
  assert.equal(
    packedEntries.includes('src/organization/master/companycode.ui.bl'),
    false
  );
});

test('business/ui packed source artifact contains every exported package file', () => {
  const { manifest: pkg } = readBusinessUiOwnPackage();
  const { artifactSnapshotPath: packedArtifactPath } = packBusinessUiArtifact({
    tempPrefix: 'business-ui-boundary-exports'
  });

  const packedEntries = listPackedBusinessUiEntries(packedArtifactPath);

  const exportedPaths = Object.values(pkg.exports || {})
    .map((entry) => String(entry?.path || '').trim())
    .filter(Boolean)
    .sort();

  for (const exportedPath of exportedPaths) {
    assert.equal(
      packedEntries.includes(exportedPath),
      true,
      `expected packed artifact to include exported path ${exportedPath}`
    );
  }

  assert.equal(
    packedEntries.includes(String(pkg.readme?.path || '').trim()),
    true
  );
});

test('business/ui packed source artifact preserves the exact packaged source files', () => {
  const { artifactSnapshotPath: packedArtifactPath } = packBusinessUiArtifact({
    tempPrefix: 'business-ui-boundary-integrity'
  });

  for (const packedFile of expectedUiPackageFiles) {
    const packedContent = readPackedBusinessUiFile(packedArtifactPath, packedFile);
    const sourceContent = fs.readFileSync(path.join(packageRoot, packedFile), 'utf8');

    assert.equal(
      packedContent,
      sourceContent,
      `expected packed file ${packedFile} to match source content`
    );
  }
});

test('business/ui pack leaves the package source tree unchanged', () => {
  const inventoryBeforePack = listPackageFiles(packageRoot);

  const { packedArtifactPath } = packBusinessUiArtifact({
    tempPrefix: 'business-ui-boundary-pack-root'
  });

  const inventoryAfterPack = listPackageFiles(packageRoot);

  assert.ok(packedArtifactPath.endsWith('.tgz'));
  assert.equal(fs.existsSync(packedArtifactPath), true);
  assert.equal(
    packedArtifactPath.startsWith(`${packageRoot}${path.sep}`),
    false
  );
  assert.deepEqual(inventoryAfterPack, inventoryBeforePack);
});

test('business/ui pack works from a deep package subdirectory without mutating the tree', () => {
  const nestedWorkingDirectory = path.join(packageRoot, 'src/system/ui');
  const inventoryBeforePack = listPackageFiles(packageRoot);
  const { packedArtifactPath } = packBusinessUiArtifact({
    tempPrefix: 'business-ui-boundary-pack-nested',
    cwd: nestedWorkingDirectory
  });

  const inventoryAfterPack = listPackageFiles(packageRoot);

  assert.ok(packedArtifactPath.endsWith('.tgz'));
  assert.equal(fs.existsSync(packedArtifactPath), true);
  assert.equal(
    packedArtifactPath.startsWith(`${packageRoot}${path.sep}`),
    false
  );
  assert.deepEqual(inventoryAfterPack, inventoryBeforePack);
});

test('business/ui pack from root and nested directories produces the same tarball artifact', () => {
  const nestedWorkingDirectory = path.join(packageRoot, 'src/system/ui');

  const { packedArtifactPath: rootPackedArtifactPath, artifactSnapshotPath: rootArtifactSnapshotPath } =
    packBusinessUiArtifact({
      tempPrefix: 'business-ui-boundary-pack-parity-root'
    });
  const rootPackedArtifactBytes = fs.readFileSync(rootArtifactSnapshotPath);

  const {
    packedArtifactPath: nestedPackedArtifactPath,
    artifactSnapshotPath: nestedArtifactSnapshotPath
  } = packBusinessUiArtifact({
    tempPrefix: 'business-ui-boundary-pack-parity-nested',
    cwd: nestedWorkingDirectory
  });
  const nestedPackedArtifactBytes = fs.readFileSync(nestedArtifactSnapshotPath);

  assert.deepEqual(nestedPackedArtifactBytes, rootPackedArtifactBytes);
  assert.ok(rootPackedArtifactPath.endsWith('.tgz'));
  assert.ok(nestedPackedArtifactPath.endsWith('.tgz'));
});

test('business/ui publish path defaults to packages.nezam.ai and fails closed without auth', () => {
  const {
    isolatedDiscoveryPath,
    publishHistoryPath,
    result: publishResult,
    output: publishOutput
  } = runBusinessUiNoAuthPublish({
    tempPrefix: 'business-ui-publish-home'
  });

  assert.equal(publishResult.status, 1);
  assert.match(publishOutput, /https:\/\/packages\.nezam\.ai\//);
  assert.match(publishOutput, /NEZAM_PUBLISH_TOKEN/);
  assert.match(publishOutput, /NEZAM_PUBLISH_TOKEN_FILE/);
  assert.match(
    publishOutput,
    new RegExp(isolatedDiscoveryPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  );

  assert.equal(fs.existsSync(publishHistoryPath), false);
});

test('business/ui failed publish leaves the package source tree unchanged', () => {
  const inventoryBeforePublish = listPackageFiles(packageRoot);
  const { result: publishResult } = runBusinessUiNoAuthPublish({
    tempPrefix: 'business-ui-publish-tree'
  });

  const inventoryAfterPublish = listPackageFiles(packageRoot);

  assert.equal(publishResult.status, 1);
  assert.deepEqual(inventoryAfterPublish, inventoryBeforePublish);
});

test('business/ui failed publish from a deep package subdirectory is fail-closed and side-effect free', () => {
  const nestedWorkingDirectory = path.join(packageRoot, 'src/system/ui');
  const inventoryBeforePublish = listPackageFiles(packageRoot);
  const {
    isolatedDiscoveryPath,
    publishHistoryPath,
    result: publishResult,
    output: publishOutput
  } = runBusinessUiNoAuthPublish({
    tempPrefix: 'business-ui-nested-publish',
    cwd: nestedWorkingDirectory
  });
  const inventoryAfterPublish = listPackageFiles(packageRoot);

  assert.equal(publishResult.status, 1);
  assert.match(publishOutput, /https:\/\/packages\.nezam\.ai\//);
  assert.match(
    publishOutput,
    new RegExp(isolatedDiscoveryPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  );
  assert.equal(fs.existsSync(publishHistoryPath), false);
  assert.deepEqual(inventoryAfterPublish, inventoryBeforePublish);
});

test('business/ui failed publish diagnostics stay consistent between root and nested invocation paths', () => {
  const nestedWorkingDirectory = path.join(packageRoot, 'src/system/ui');
  const {
    isolatedDiscoveryPath,
    result: rootPublishResult,
    output: rootPublishOutput
  } = runBusinessUiNoAuthPublish({
    tempPrefix: 'business-ui-publish-parity-root'
  });
  const {
    isolatedDiscoveryPath: nestedDiscoveryPath,
    result: nestedPublishResult,
    output: nestedPublishOutput
  } = runBusinessUiNoAuthPublish({
    tempPrefix: 'business-ui-publish-parity-nested',
    cwd: nestedWorkingDirectory
  });

  assert.equal(rootPublishResult.status, 1);
  assert.equal(nestedPublishResult.status, 1);
  assert.match(rootPublishOutput, /https:\/\/packages\.nezam\.ai\//);
  assert.match(nestedPublishOutput, /https:\/\/packages\.nezam\.ai\//);
  assert.match(rootPublishOutput, /NEZAM_PUBLISH_TOKEN/);
  assert.match(nestedPublishOutput, /NEZAM_PUBLISH_TOKEN/);
  assert.match(rootPublishOutput, /NEZAM_PUBLISH_TOKEN_FILE/);
  assert.match(nestedPublishOutput, /NEZAM_PUBLISH_TOKEN_FILE/);
  assert.match(
    rootPublishOutput,
    new RegExp(isolatedDiscoveryPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  );
  assert.match(
    nestedPublishOutput,
    new RegExp(nestedDiscoveryPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  );
});
