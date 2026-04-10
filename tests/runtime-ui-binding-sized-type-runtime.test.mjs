import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { businessUiPackageRoot } from './source-package-helper.mjs';

test('business/ui runtime binding extracts sized string lengths from canonical AST suffix nodes', () => {
  const bindingSource = fs.readFileSync(
    path.join(businessUiPackageRoot, 'src/system/ui/runtime_ui.binding.functions.bl'),
    'utf8'
  );

  assert.match(
    bindingSource,
    /private function runtime_ui_find_first_descendant_positive_int_literal_value\(node_id: string\): Json \{/
  );
  assert.match(bindingSource, /let node_kind = runtime_ui_node_kind\(node_json\);/);
  assert.match(bindingSource, /node_kind == "integerLiteral"/);
  assert.match(bindingSource, /node_kind == "literal"/);
  assert.match(bindingSource, /node_kind == "typeLiteralParameters"/);
  assert.match(bindingSource, /node_kind == "typeSuffix"/);
  assert.match(bindingSource, /node_kind == "typeSuffixList"/);
  assert.match(bindingSource, /let numeric_value = Runtime\.json_to_i64\(/);
  assert.match(bindingSource, /numeric_properties\["max_length"\] = max_length;/);
});

test('business/ui public app-info preserves sizing metadata for projected fields and grid columns', () => {
  const metadataSource = fs.readFileSync(
    path.join(businessUiPackageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );

  const masterFieldBlock = metadataSource.match(
    /private function runtime_ui_build_master_field_info\(control_metadata: Json\): Json \{[\s\S]*?\n\}\n/
  )?.[0] ?? '';
  const masterGridColumnBlock = metadataSource.match(
    /private function runtime_ui_build_master_grid_column_info\(column_metadata: Json\): Json \{[\s\S]*?\n\}\n/
  )?.[0] ?? '';

  assert.match(masterFieldBlock, /field_info\["max_length"\] = control_metadata\["max_length"\];/);
  assert.match(masterFieldBlock, /field_info\["display_length"\] = control_metadata\["display_length"\];/);
  assert.match(masterFieldBlock, /field_info\["input_width"\] = control_metadata\["input_width"\];/);
  assert.match(masterGridColumnBlock, /column_info\["max_length"\] = column_metadata\["max_length"\];/);
  assert.match(masterGridColumnBlock, /column_info\["display_length"\] = column_metadata\["display_length"\];/);
  assert.match(masterGridColumnBlock, /column_info\["input_width"\] = column_metadata\["input_width"\];/);
});

test('business/ui runtime binding reuses one reflection accumulator across field subtrees', () => {
  const bindingSource = fs.readFileSync(
    path.join(businessUiPackageRoot, 'src/system/ui/runtime_ui.binding.functions.bl'),
    'utf8'
  );

  assert.match(
    bindingSource,
    /private function runtime_ui_apply_binding_member_reflection\(\s*node_id: string,\s*property_names: Json,\s*reflection: Json\s*\): Json \{/
  );
  assert.match(
    bindingSource,
    /return runtime_ui_apply_binding_member_reflection\(\s*normalized_node_id,\s*property_names,\s*reflection\s*\);/s
  );
  assert.match(
    bindingSource,
    /runtime_ui_apply_binding_member_reflection\(\s*Runtime\.json_to_str\(child_node_id\),\s*property_names,\s*reflection\s*\);/s
  );
  assert.doesNotMatch(bindingSource, /let child_reflection = runtime_ui_collect_binding_member_reflection\(/);
});

test('business/ui skips binding reflection when internal form state is unbound', () => {
  const bindingSource = fs.readFileSync(
    path.join(businessUiPackageRoot, 'src/system/ui/runtime_ui.binding.functions.bl'),
    'utf8'
  );

  assert.match(
    bindingSource,
    /private function runtime_ui_build_internal_form_state\(\s*form_metadata: Json,\s*form_state: Json,\s*open_args: Json\s*\): RuntimeUiInternalFormState \{/s
  );
  assert.match(
    bindingSource,
    /internal_state\["binding_type"\] = runtime_ui_resolve_form_binding_type\(form_metadata\);\s*internal_state\["state"\] = form_state \?\? \{};\s*internal_state\["open_args"\] = open_args;\s*if \(Runtime\.json_to_str\(internal_state\.binding_type\) != ""\) \{/s
  );
  assert.match(
    bindingSource,
    /internal_state\["binding_kind"\] = runtime_ui_resolve_form_binding_kind\(form_metadata\);\s*internal_state\["binding_members"\] = runtime_ui_build_binding_members\(form_metadata\);\s*internal_state\["binding_key_fields"\] = runtime_ui_build_binding_key_fields\(form_metadata\);/s
  );
  assert.match(
    bindingSource,
    /\} else \{\s*internal_state\["binding_kind"\] = "";\s*internal_state\["binding_members"\] = \{};\s*internal_state\["binding_key_fields"\] = \[];/s
  );
});

test('business/ui button metadata reuses one property scan for text and boolean flags', () => {
  const metadataSource = fs.readFileSync(
    path.join(businessUiPackageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );

  assert.match(
    metadataSource,
    /private function runtime_ui_collect_button_property_node_analyses\(button_node_json: Json\): Json \{/s
  );
  assert.match(
    metadataSource,
    /private function runtime_ui_collect_button_property_metadata\(button_node_json: Json\): Json \{/s
  );
  assert.match(
    metadataSource,
    /let button_property_analyses = runtime_ui_collect_button_property_node_analyses\(button_node_json\);/s
  );
  assert.match(
    metadataSource,
    /let button_property_metadata = runtime_ui_collect_button_property_metadata\(button_node_json\);/s
  );
  assert.match(
    metadataSource,
    /let button_icon_only = button_property_metadata\["icon_only"\] == true;/s
  );
  assert.match(
    metadataSource,
    /let has_button_requires_selection = button_property_metadata\["has_requires_selection"\] == true;/s
  );
  assert.match(
    metadataSource,
    /let button_requires_selection = button_property_metadata\["requires_selection"\] == true;/s
  );
  assert.match(
    metadataSource,
    /let has_button_visible = button_property_metadata\["has_visible"\] == true;/s
  );
  assert.match(
    metadataSource,
    /let has_button_enabled = button_property_metadata\["has_enabled"\] == true;/s
  );
  assert.doesNotMatch(
    metadataSource,
    /runtime_ui_collect_declaration_text_properties\(\s*button_node_json,\s*\["label", "icon", "shortcut", "aria_label", "description", "ribbon_size", "placement"\]\s*\)/s
  );
  assert.doesNotMatch(metadataSource, /runtime_ui_resolve_metadata_bool_flag\(button_node_json, "icon_only"\)/);
  assert.doesNotMatch(metadataSource, /runtime_ui_resolve_metadata_bool_flag\(button_node_json, "requires_selection"\)/);
  assert.doesNotMatch(metadataSource, /runtime_ui_has_authored_metadata_value\(button_node_json, "visible"\)/);
  assert.doesNotMatch(metadataSource, /runtime_ui_has_authored_metadata_value\(button_node_json, "enabled"\)/);
});

test('business/ui button metadata provides canonical visual defaults for standard button families', () => {
  const metadataSource = fs.readFileSync(
    path.join(businessUiPackageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );
  const buttonVisualDefaultsBlock = metadataSource.match(
    /private function runtime_ui_resolve_button_visual_defaults\([\s\S]*?\n\}\n/
  )?.[0] ?? '';

  assert.match(
    metadataSource,
    /private function runtime_ui_resolve_button_visual_defaults\(\s*button_node_json: Json,\s*button_argument_analysis: Json\s*\): Json \{/s
  );
  assert.match(
    metadataSource,
    /let button_visual_defaults = runtime_ui_resolve_button_visual_defaults\(\s*button_node_json,\s*button_argument_analysis\s*\);/s
  );
  assert.doesNotMatch(
    buttonVisualDefaultsBlock,
    /runtime_ui_analyze_button_argument_metadata\(button_node_json\)/
  );
  assert.match(
    metadataSource,
    /if \(button_label == ""\) \{\s*button_label = Runtime\.json_to_str\(button_visual_defaults\["label"\]\);\s*\}/s
  );
  assert.match(
    metadataSource,
    /if \(button_icon == ""\) \{\s*button_icon = Runtime\.json_to_str\(button_visual_defaults\["icon"\]\);\s*\}/s
  );
  assert.match(
    metadataSource,
    /button_declaration_symbol == "CreateFormButton"[\s\S]*defaults\["label"\] = "New";[\s\S]*defaults\["icon"\] = "add";/s
  );
  assert.match(
    metadataSource,
    /button_declaration_symbol == "ViewSelectionButton"[\s\S]*defaults\["label"\] = "View";[\s\S]*defaults\["icon"\] = "view";/s
  );
  assert.match(
    metadataSource,
    /button_declaration_symbol == "EditSelectionButton"[\s\S]*defaults\["label"\] = "Edit";[\s\S]*defaults\["icon"\] = "edit";/s
  );
  assert.match(
    metadataSource,
    /button_declaration_symbol == "EditRecordButton"[\s\S]*defaults\["label"\] = "Edit";[\s\S]*defaults\["icon"\] = "edit";/s
  );
});

test('business/ui compact master button metadata preserves declarative navigation argument paths', () => {
  const metadataSource = fs.readFileSync(
    path.join(businessUiPackageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );

  assert.match(
    metadataSource,
    /private function runtime_ui_build_master_button_info\(button_metadata: Json\): Json \{/s
  );
  assert.match(
    metadataSource,
    /if \(button_metadata\["selection_path"\] != null\) \{\s*button_info\["selection_path"\] = button_metadata\["selection_path"\];\s*\}/s
  );
  assert.match(
    metadataSource,
    /if \(button_metadata\["record_path"\] != null\) \{\s*button_info\["record_path"\] = button_metadata\["record_path"\];\s*\}/s
  );
  assert.match(
    metadataSource,
    /if \(button_metadata\["form_arg_expr"\] != null\) \{\s*button_info\["form_arg_expr"\] = button_metadata\["form_arg_expr"\];\s*\}/s
  );
});

test('business/ui compact master button metadata preserves compact presentation flags', () => {
  const metadataSource = fs.readFileSync(
    path.join(businessUiPackageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );

  assert.match(
    metadataSource,
    /if \(button_metadata\["aria_label"\] != null\) \{\s*button_info\["aria_label"\] = button_metadata\["aria_label"\];\s*\}/s
  );
  assert.match(
    metadataSource,
    /if \(button_metadata\["placement"\] != null\) \{\s*button_info\["placement"\] = button_metadata\["placement"\];\s*\}/s
  );
  assert.match(
    metadataSource,
    /if \(button_metadata\["icon_only"\] == true\) \{\s*button_info\["icon_only"\] = true;\s*\}/s
  );
});

test('business/ui master datagrid metadata preserves explicit height_lines and prefers control-specific pagination', () => {
  const metadataSource = fs.readFileSync(
    path.join(businessUiPackageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );

  assert.match(
    metadataSource,
    /if \(character == "_" \|\| character == "-" \|\| character == " "\) \{\s*continue;\s*\}\s*normalized_text = normalized_text \+ Runtime\.json_to_str\(character\);/s
  );
  assert.match(
    metadataSource,
    /let non_default_match = "";\s*let non_default_count = 0;/s
  );
  assert.match(
    metadataSource,
    /let lower_control_id = Runtime\.to_lower\(Runtime\.json_to_str\(control_id\)\);/s
  );
  assert.match(
    metadataSource,
    /let state_field_value_type = Runtime\.json_to_str\(state_field\["value_type"\]\);\s*if \(state_field_value_type == "Limiter" && lower_field_name != "limiter"\) \{\s*if \(non_default_match == ""\) \{\s*non_default_match = field_name;\s*\}\s*non_default_count = non_default_count \+ 1;\s*\}\s*\n\s*let normalized_field_name = runtime_ui_normalize_identifier_text\(field_name\);/s
  );
  assert.match(
    metadataSource,
    /if \(\s*lower_control_id != ""\s*&& lower_control_id != "ui"\s*&& non_default_count == 1\s*&& non_default_match != ""\s*\) \{\s*return non_default_match;\s*\}/s
  );
  assert.match(metadataSource, /let preferred_pagination_field_name = "";/s);
  assert.match(
    metadataSource,
    /let lower_control_base = runtime_ui_trim_lower_grid_suffix\(control_id\);/s
  );
  assert.match(
    metadataSource,
    /preferred_pagination_field_name = runtime_ui_find_matching_pagination_state_field_name\(\s*state_fields,\s*Runtime\.json_to_str\(control_metadata\["id"\]\)\s*\);/s
  );
  assert.match(
    metadataSource,
    /lower_field_name == lower_control_base \+ "_limiter"/s
  );
  assert.match(
    metadataSource,
    /Runtime\.json_to_str\(effective_pagination_path\) == "state\.limiter"\s*&& preferred_pagination_field_name != "limiter"/s
  );
  assert.match(
    metadataSource,
    /if \(control_metadata\["height_lines"\] != null\) \{\s*master_datagrid\["height_lines"\] = control_metadata\["height_lines"\];\s*\}/s
  );
});

test('business/ui deferred grid form metadata falls back to authored title text', () => {
  const metadataSource = fs.readFileSync(
    path.join(businessUiPackageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );

  assert.match(
    metadataSource,
    /let form_title = Runtime\.json_to_str\(\s*runtime_ui_published_property_value\(form_node_json, "title"\)\s*\);\s*if \(form_title == ""\) \{\s*form_title = runtime_ui_find_declaration_text_property\(form_node_json, "title"\);\s*\}/s
  );
});

test('business/ui master form metadata falls back to authored title text', () => {
  const metadataSource = fs.readFileSync(
    path.join(businessUiPackageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );

  assert.match(
    metadataSource,
    /private function runtime_ui_build_master_form_metadata\(form_node_json: Json\): Json \{[\s\S]*let form_title = Runtime\.json_to_str\(\s*runtime_ui_published_property_value\(form_node_json, "title"\)\s*\);\s*if \(form_title == ""\) \{\s*form_title = runtime_ui_find_declaration_text_property\(form_node_json, "title"\);\s*\}/s
  );
});

test('business/ui core form metadata repairs symbol-name title fallback from authored title text', () => {
  const metadataSource = fs.readFileSync(
    path.join(businessUiPackageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );

  assert.match(
    metadataSource,
    /let form_title = runtime_ui_resolve_published_string_property_with_reflected_text\(\s*form_node_json,\s*"title",\s*form_text_properties\s*\);\s*if \(form_title == "" \|\| form_title == form_id\) \{\s*let declared_form_title = runtime_ui_find_declaration_text_property\(\s*form_node_json,\s*"title"\s*\);[\s\S]*form_title = declared_form_title;/s
  );
});

test('business/ui master form metadata reflects load handlers without direct load-property flags', () => {
  const metadataSource = fs.readFileSync(
    path.join(businessUiPackageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );

  assert.match(
    metadataSource,
    /if \(include_runtime_details\) \{\s*if \(direct_form_structure\["has_load_property"\] == true\) \{/s
  );
  assert.match(
    metadataSource,
    /let form_header_property_analysis = form_metadata\["_form_header_property_analysis"\] \?\? \{\};/s
  );
  assert.match(
    metadataSource,
    /form_header_property_analysis\["symbol_properties"\]\["load"\]/s
  );
  assert.match(
    metadataSource,
    /form_metadata\["load"\] == null\s*\|\|\s*Runtime\.json_to_str\(form_metadata\["load"\]\["handler"\]\) == ""/s
  );
  assert.match(
    metadataSource,
    /form_metadata\["load_param"\] = inferred_load_param;/s
  );
  assert.match(
    metadataSource,
    /let binding_key_field = Runtime\.json_to_str\(binding_key_fields\[0\]\);/s
  );
  assert.match(
    metadataSource,
    /Runtime\.json_to_str\(load_param\) == inferred_load_param/s
  );
});

test('business/ui form metadata falls back to direct form-header load reflection when published load is sparse', () => {
  const metadataSource = fs.readFileSync(
    path.join(businessUiPackageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );

  assert.match(
    metadataSource,
    /if \(reflected_load_handler == ""\) \{\s*reflected_load_handler = runtime_ui_find_form_header_symbol_property\(\s*form_node_json,\s*"load"\s*\);\s*\}/s
  );
});

test('business/ui load handler input falls back from load_param to binding key fields', () => {
  const executionSource = fs.readFileSync(
    path.join(businessUiPackageRoot, 'src/system/ui/runtime_ui.execution.functions.bl'),
    'utf8'
  );

  assert.match(
    executionSource,
    /private function runtime_ui_resolve_form_load_handler_key_field_input_value\(\s*internal_form_state: RuntimeUiInternalFormState,\s*execution_form_state: Json\s*\): Json \{/s
  );
  assert.match(
    executionSource,
    /for \(binding_key_field in internal_form_state\.binding_key_fields \?\? \[]\) \{/s
  );
  assert.match(
    executionSource,
    /load_input_value = runtime_ui_resolve_form_load_handler_key_field_input_value\(\s*internal_form_state,\s*execution_form_state\s*\);/s
  );
});

test('business/ui apply event identity accepts canonical top-level event fields', () => {
  const executionSource = fs.readFileSync(
    path.join(businessUiPackageRoot, 'src/system/ui/runtime_ui.execution.functions.bl'),
    'utf8'
  );

  assert.match(
    executionSource,
    /let event_name = Runtime\.json_to_str\(event\["event_name"\]\);\s*if \(event_name != ""\) \{\s*return event_name;\s*\}\s*event_name = Runtime\.json_to_str\(event\["name"\]\);/s
  );
  assert.match(executionSource, /event_name = Runtime\.json_to_str\(context\["eventName"\]\);/);
  assert.match(executionSource, /event_name = Runtime\.json_to_str\(context\["event_name"\]\);/);
  assert.match(
    executionSource,
    /let control_id = Runtime\.json_to_str\(event\["control_id"\]\);\s*if \(control_id != ""\) \{\s*return control_id;\s*\}\s*control_id = Runtime\.json_to_str\(event\["controlId"\]\);/s
  );
  assert.match(executionSource, /control_id = Runtime\.json_to_str\(context\["controlId"\]\);/);
  assert.match(executionSource, /control_id = Runtime\.json_to_str\(context\["control_id"\]\);/);
});

test('business/ui http apply and fire-event preserve event context on canonical requests', () => {
  const runtimeSource = fs.readFileSync(
    path.join(businessUiPackageRoot, 'src/system/ui/runtime_ui.functions.bl'),
    'utf8'
  );

  assert.match(
    runtimeSource,
    /apply_request\["event"\] = request\["event"\] \?\? \{\s*"context": request\["context"\],[\s\S]*"event_name": Runtime\.json_to_str\(/s
  );
  assert.match(
    runtimeSource,
    /apply_request\["event"\] = \{\s*"context": request\.context,\s*"control_id": request\.control_id,\s*"event_name": request\.event_name,\s*"payload": event_payload,[\s\S]*"target_form_id": target_form_id,/s
  );
  assert.match(
    runtimeSource,
    /let fire_event_request = runtime_ui_build_http_active_form_request_base\(request\);[\s\S]*fire_event_request\["control_id"\] = Runtime\.json_to_str\(\s*runtime_ui_http_request_value\(request, "control_id", "controlId"\)\s*\);[\s\S]*fire_event_request\["event_name"\] = Runtime\.json_to_str\(/s
  );
});

test('business/ui apply button event overrides read canonical published click metadata', () => {
  const runtimeSource = fs.readFileSync(
    path.join(businessUiPackageRoot, 'src/system/ui/runtime_ui.functions.bl'),
    'utf8'
  );

  assert.match(
    runtimeSource,
    /let button_click_event = button_metadata\["events"\]\["click"\];/
  );
  assert.doesNotMatch(
    runtimeSource,
    /let button_click_event = button_metadata\["events"\]\["on_click"\];/
  );
});

test('business/ui button ui state leaves requires-selection buttons to renderer selection logic when no selection path exists', () => {
  const controlsSource = fs.readFileSync(
    path.join(businessUiPackageRoot, 'src/system/ui/runtime_ui.controls.functions.bl'),
    'utf8'
  );

  assert.match(
    controlsSource,
    /let selection_disabled = null;\s*let selection_path = Runtime\.json_to_str\(button_metadata\["selection_path"\]\);\s*if \(selection_path != ""\) \{\s*selection_disabled = runtime_ui_resolve_form_state_path\(/s
  );
  assert.doesNotMatch(
    controlsSource,
    /else if \(requires_selection\) \{\s*selection_disabled = true;\s*\}/s
  );
});

test('business/ui control source reflection resolves form field property handlers directly before descendant fallback', () => {
  const metadataSource = fs.readFileSync(
    path.join(businessUiPackageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );

  assert.match(
    metadataSource,
    /private function runtime_ui_resolve_form_field_property_handler\(\s*form_field_property_node_id: string,\s*excluded_symbol_names: Json\s*\): string \{/s
  );
  assert.match(
    metadataSource,
    /private function runtime_ui_find_direct_form_field_property_handler_by_key\(\s*control_node_id: string,\s*property_key_symbol_name: string\s*\): string \{/s
  );
  assert.match(
    metadataSource,
    /let handler_symbol_name = runtime_ui_resolve_node_symbol_name\(\s*ast\.node_to_json\(normalized_child_node_id\)\s*\);/s
  );
  assert.match(
    metadataSource,
    /if \(handler_symbol_name == ""\) \{\s*handler_symbol_name = runtime_ui_find_first_descendant_symbol_name\(\s*normalized_child_node_id\s*\);\s*\}/s
  );
  assert.match(
    metadataSource,
    /load_event_handler = runtime_ui_find_direct_form_field_property_handler_by_key\(\s*container_node_id,\s*"load"\s*\);/s
  );
  assert.match(
    metadataSource,
    /private function runtime_ui_resolve_reflected_control_source_handler\(\s*control_node_id: string,\s*control_source_node_id: string\s*\): string \{/s
  );
  assert.match(
    metadataSource,
    /let explicit_load_handler = "";\s*if \(normalized_control_node_id != ""\) \{[\s\S]*explicit_load_handler = runtime_ui_find_form_field_property_handler\(\s*normalized_control_node_id,\s*\[\s*"load"\s*\]\s*\);[\s\S]*return runtime_ui_reflect_control_source_handler\(control_source_node_id\);/s
  );
  assert.match(
    metadataSource,
    /let property_key_symbol = runtime_ui_find_first_descendant_symbol_name\(\s*property_key_node_id\s*\);/s
  );
});

test('business/ui grid binding metadata uses one projection helper', () => {
  const metadataSource = fs.readFileSync(
    path.join(businessUiPackageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );
  const bindingSource = fs.readFileSync(
    path.join(businessUiPackageRoot, 'src/system/ui/runtime_ui.binding.functions.bl'),
    'utf8'
  );

  assert.match(
    metadataSource,
    /private function runtime_ui_build_grid_binding_projection\(\s*binding_members: Json\s*\): Json \{/s
  );
  assert.match(
    bindingSource,
    /private function runtime_ui_build_grid_binding_projection_for_type\(\s*binding_type: string\s*\): Json \{/s
  );
  assert.match(
    metadataSource,
    /grid_binding_projection = runtime_ui_build_grid_binding_projection_for_type\(\s*grid_binding_type\s*\);/s
  );
  assert.doesNotMatch(
    metadataSource,
    /private function runtime_ui_build_grid_columns_from_binding_members\(/s
  );
});

test('business/ui control type analysis owns formControlTypeReference fallback', () => {
  const metadataSource = fs.readFileSync(
    path.join(businessUiPackageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );

  assert.match(
    metadataSource,
    /private function runtime_ui_resolve_control_type_analysis\(\s*type_expression_node_id: string\s*\): Json \{[\s\S]*formControlTypeReference[\s\S]*fallback_control_type_symbol[\s\S]*return \{/s
  );
  assert.match(
    metadataSource,
    /if \(normalized_control_type_symbol == "datagrid"\) \{\s*normalized_control_type_symbol = "DataGrid";\s*\} else if \(normalized_control_type_symbol == "grid"\) \{\s*normalized_control_type_symbol = "Grid";\s*\}/s
  );
  assert.doesNotMatch(
    metadataSource,
    /let control_type_symbol = Runtime\.json_to_str\(control_type_analysis\["control_type_symbol"\]\);\s*if \(control_type_symbol == "" \|\| \(control_type_symbol != "DataGrid" && control_type_symbol != "Grid"\)\) \{/s
  );
});

test('business/ui direct form structure detection uses one child pass for ui_from and load analysis', () => {
  const metadataSource = fs.readFileSync(
    path.join(businessUiPackageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );

  assert.match(
    metadataSource,
    /for \(child_node_id in runtime_ui_list_child_node_ids\(form_node_id\)\) \{/s
  );
  assert.match(
    metadataSource,
    /"ui_from": null,[\s\S]*"load_handler": ""/s
  );
  assert.match(
    metadataSource,
    /if \(child_kind == "formField" \|\| child_kind == "formInlineControlField"\) \{/s
  );
  assert.match(
    metadataSource,
    /let control_structure = runtime_ui_analyze_control_structure\(child_node_json\);\s*let control_type_analysis = runtime_ui_resolve_control_type_analysis\(\s*Runtime\.json_to_str\(control_structure\["type_expression_node_id"\]\)\s*\);\s*let control_type_symbol = Runtime\.json_to_str\(\s*control_type_analysis\["control_type_symbol"\]\s*\);/s
  );
  assert.match(
    metadataSource,
    /analysis\["has_ui_field"\] = true;[\s\S]*if \(Runtime\.json_to_str\(analysis\["ui_from"\]\) == ""\) \{\s*let field_from_node_id = runtime_ui_find_child_node_id_by_kind\(\s*normalized_child_node_id,\s*"formFieldFrom"\s*\);[\s\S]*ui_from != ""[\s\S]*control_type_symbol != "DataGrid"[\s\S]*control_type_symbol != "Grid"[\s\S]*analysis\["ui_from"\] = ui_from;/s
  );
  assert.match(
    metadataSource,
    /if \(Runtime\.json_to_str\(analysis\["load_handler"\]\) == ""\) \{[\s\S]*runtime_ui_find_form_field_property_handler\(\s*normalized_child_node_id,\s*\[\s*"load"\s*\]\s*\);[\s\S]*ui_load_handler != ""[\s\S]*control_type_symbol != "DataGrid"[\s\S]*control_type_symbol != "Grid"[\s\S]*analysis\["load_handler"\] = ui_load_handler;/s
  );
  assert.match(
    metadataSource,
    /child_kind == "formHeaderProperty"\s*\|\|\s*child_kind == "formInlineHeaderProperty"/s
  );
  assert.match(
    metadataSource,
    /child_kind == "formDeclarationWithHeader"\s*\|\|\s*child_kind == "formDeclarationWithoutHeader"\s*\|\|\s*child_kind == "formInlineBodyItem"\s*\|\|\s*child_kind == "formBody"\s*\|\|\s*child_kind == "formBodyMember"\s*\|\|\s*child_kind == "formBodySection"\s*\|\|\s*child_kind == "formSection"/s
  );
  assert.match(
    metadataSource,
    /if \(Runtime\.json_to_str\(analysis\["load_handler"\]\) == ""\) \{\s*analysis\["load_handler"\] = Runtime\.json_to_str\(child_analysis\["load_handler"\]\);\s*\}/s
  );
  assert.match(
    metadataSource,
    /} else if \(child_kind == "formField"\) \{\s*if \(collect_control_nodes\) \{\s*collected_nodes\["control_nodes"\]\[control_count\] = child_node_json;\s*control_count = control_count \+ 1;\s*\}\s*continue;\s*} else if \(child_kind == "formInlineControlField"\) \{/s
  );
  assert.match(
    metadataSource,
    /private function runtime_ui_resolve_shorthand_ui_from_from_control_nodes\(control_nodes: Json\): string \{/s
  );
  assert.match(
    metadataSource,
    /let control_structure = runtime_ui_analyze_control_structure\(control_node_json\);[\s\S]*if \(Runtime\.json_to_str\(control_structure\["control_id"\]\) != "ui"\) \{\s*continue;\s*\}/s
  );
  assert.match(
    metadataSource,
    /let form_field_from_node_id = Runtime\.json_to_str\(control_structure\["form_field_from_node_id"\]\);[\s\S]*let ui_from = runtime_ui_find_first_descendant_symbol_name\(form_field_from_node_id\);/s
  );
  assert.match(
    metadataSource,
    /reflected_shorthand_ui_from = runtime_ui_resolve_shorthand_ui_from_from_control_nodes\(\s*direct_form_metadata_nodes\["control_nodes"\]\s*\);/s
  );
  assert.match(
    metadataSource,
    /private function runtime_ui_is_form_declaration_kind\(kind: string\): bool \{[\s\S]*formDeclarationWithHeader[\s\S]*formDeclarationWithoutHeader/s
  );
});

test('business/ui declaration text analysis reuses one property-node traversal for literals and symbols', () => {
  const metadataSource = fs.readFileSync(
    path.join(businessUiPackageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );

  assert.match(
    metadataSource,
    /private function runtime_ui_analyze_property_node\(property_node_id: string\): Json \{/s
  );
  assert.match(
    metadataSource,
    /"literal_text": "",\s*"symbol_names": \[\]/s
  );
  assert.match(
    metadataSource,
    /let property_node_analysis = runtime_ui_analyze_property_node\(property_node_id\);/s
  );
  assert.doesNotMatch(
    metadataSource,
    /let property_literal_text = runtime_ui_find_first_descendant_literal_text\(property_node_id\);\s*if \(property_literal_text == ""\) \{\s*continue;\s*\}\s*let property_symbol_names = runtime_ui_collect_descendant_symbol_names\(property_node_id\);/s
  );
});

test('business/ui startup form detection reuses one subtree analysis per app child', () => {
  const metadataSource = fs.readFileSync(
    path.join(businessUiPackageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );

  assert.match(
    metadataSource,
    /private function runtime_ui_analyze_startup_form_reference\(node_id: string\): Json \{/s
  );
  assert.match(
    metadataSource,
    /"has_startup_section": false,\s*"first_symbol_name": ""/s
  );
  assert.match(
    metadataSource,
    /let startup_form_reference_analysis = runtime_ui_analyze_startup_form_reference\(child_node_id\);/s
  );
  assert.doesNotMatch(
    metadataSource,
    /if \(!runtime_ui_node_or_descendant_has_kind\(child_node_id, "startupSection"\)\) \{\s*continue;\s*\}\s*let startup_form_id = runtime_ui_find_first_descendant_symbol_name\(child_node_id\);/s
  );
});

test('business/ui mounted form resolution avoids rebuilding the full mount index for one source lookup', () => {
  const metadataSource = fs.readFileSync(
    path.join(businessUiPackageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );

  assert.match(
    metadataSource,
    /private function runtime_ui_find_mounted_form_target_in_app_mounts\(\s*app_node_json: Json,\s*mounted_form_id: string\s*\): string \{/s
  );
  assert.match(
    metadataSource,
    /let mounted_target_form = runtime_ui_find_mounted_form_target_in_app_mounts\(\s*app_node_json,\s*normalized_mounted_form_reference\s*\);/s
  );
  assert.doesNotMatch(
    metadataSource,
    /let mounted_target_form = runtime_ui_find_mounted_form_target_for_app\(\s*app_node_json,\s*normalized_mounted_form_reference\s*\);/s
  );
});

test('business/ui form mount parsing reuses one analyzer for index and direct lookup paths', () => {
  const metadataSource = fs.readFileSync(
    path.join(businessUiPackageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );

  assert.match(
    metadataSource,
    /private function runtime_ui_analyze_form_mount_node\(form_mount_node_id: string\): Json \{/s
  );
  assert.match(
    metadataSource,
    /let form_mount_analysis = runtime_ui_analyze_form_mount_node\(form_mount_node_id\);/s
  );
  assert.doesNotMatch(
    metadataSource,
    /let mounted_target = "";\s*let mounted_alias = "";\s*for \(form_mount_child_node_id in runtime_ui_list_child_node_ids\(form_mount_node_id\)\) \{/s
  );
});

test('business/ui form summary reuses core header analysis instead of rescanning headers', () => {
  const metadataSource = fs.readFileSync(
    path.join(businessUiPackageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );

  assert.match(
    metadataSource,
    /"_form_header_property_analysis": form_header_property_analysis,/s
  );
  assert.match(
    metadataSource,
    /let form_header_property_analysis = form_metadata\["_form_header_property_analysis"\] \?\? \{\};/s
  );
  assert.doesNotMatch(
    metadataSource,
    /private function runtime_ui_build_form_summary\(form_node_json: Json\): Json \{[\s\S]*let form_header_property_analysis = runtime_ui_collect_form_header_property_analysis\(\s*form_node_json\s*\);/s
  );
});

test('business/ui declaration text lookup reuses property-node analysis for matching and literals', () => {
  const metadataSource = fs.readFileSync(
    path.join(businessUiPackageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );

  assert.match(
    metadataSource,
    /private function runtime_ui_find_declaration_text_property\(\s*node_json: Json,\s*property_name: string\s*\): string \{/s
  );
  assert.match(
    metadataSource,
    /private function runtime_ui_collect_declaration_text_properties\(\s*node_json: Json,\s*property_names: Json\s*\): Json \{/s
  );
  assert.match(
    metadataSource,
    /for \(button_property_analysis in runtime_ui_collect_button_property_node_analyses\(node_json\)\) \{/s
  );
  assert.match(
    metadataSource,
    /let property_node_analysis = runtime_ui_analyze_property_node\(property_node_id\);/s
  );
  assert.match(
    metadataSource,
    /let property_symbol_names = property_node_analysis\["symbol_names"\] \?\? \[\];/s
  );
  assert.match(
    metadataSource,
    /private function runtime_ui_is_app_declaration_kind\(kind: string\): bool \{[\s\S]*appDeclarationWithHeader[\s\S]*appDeclarationWithoutHeader/s
  );
  assert.match(
    metadataSource,
    /if \(runtime_ui_is_form_declaration_kind\(node_kind\)\) \{[\s\S]*formHeaderProperty[\s\S]*formInlineHeaderProperty/s
  );
  assert.match(
    metadataSource,
    /} else if \(runtime_ui_is_app_declaration_kind\(node_kind\)\) \{[\s\S]*appHeaderProperty[\s\S]*appInlineHeaderProperty/s
  );
  assert.doesNotMatch(
    metadataSource,
    /runtime_ui_node_or_descendant_has_symbol_name\(form_header_node_id, normalized_property_name\)[\s\S]*runtime_ui_find_first_descendant_literal_text\(form_header_node_id\)/s
  );
});

test('business/ui app and form lookup collect wrapped declaration kinds', () => {
  const metadataSource = fs.readFileSync(
    path.join(businessUiPackageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );
  const runtimeSource = fs.readFileSync(
    path.join(businessUiPackageRoot, 'src/system/ui/runtime_ui.functions.bl'),
    'utf8'
  );

  assert.match(
    metadataSource,
    /private function runtime_ui_collect_form_declaration_matches\(\): Json \{[\s\S]*formDeclarationWithHeader[\s\S]*formDeclarationWithoutHeader/s
  );
  assert.match(
    metadataSource,
    /private function runtime_ui_collect_app_declaration_matches\(\): Json \{[\s\S]*appDeclarationWithHeader[\s\S]*appDeclarationWithoutHeader/s
  );
  assert.match(
    metadataSource,
    /let form_nodes = runtime_ui_collect_form_declaration_matches\(\);/s
  );
  assert.match(
    metadataSource,
    /let app_nodes = runtime_ui_collect_app_declaration_matches\(\);/s
  );
  assert.match(
    runtimeSource,
    /let app_nodes = runtime_ui_collect_app_declaration_matches\(\);/s
  );
  assert.match(
    metadataSource,
    /private function runtime_ui_resolve_declaration_primary_symbol_name\(node_json: Json\): string \{/s
  );
  assert.match(
    metadataSource,
    /let form_id = runtime_ui_resolve_declaration_primary_symbol_name\(form_node_json\);/s
  );
  assert.match(
    metadataSource,
    /let app_id = runtime_ui_resolve_declaration_primary_symbol_name\(app_node_json\);/s
  );
  assert.match(
    metadataSource,
    /let symbol_name = runtime_ui_resolve_declaration_primary_symbol_name\(app_node_json\);/s
  );
});

test('business/ui declaration symbol lookup reuses one child-subtree analysis for symbols and callable target', () => {
  const metadataSource = fs.readFileSync(
    path.join(businessUiPackageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );

  assert.match(
    metadataSource,
    /private function runtime_ui_analyze_symbol_property_subtree\(node_id: string\): Json \{/s
  );
  assert.match(
    metadataSource,
    /let child_property_analysis = runtime_ui_analyze_symbol_property_subtree\(child_node_id\);/s
  );
  assert.match(
    metadataSource,
    /let callable_symbol = Runtime\.json_to_str\(property_analysis\["first_callable_symbol"\]\);/s
  );
  assert.doesNotMatch(
    metadataSource,
    /let child_symbol_names = runtime_ui_collect_descendant_symbol_names\(child_node_id\);\s*if \(!runtime_ui_symbol_list_contains\(child_symbol_names, normalized_property_name\)\) \{\s*continue;\s*\}\s*let callable_symbol = runtime_ui_find_first_descendant_callable_symbol_name\(child_node_id\);/s
  );
});

test('business/ui button event metadata reuses one analysis pass for click handler resolution', () => {
  const metadataSource = fs.readFileSync(
    path.join(businessUiPackageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );
  const buttonEventAnalysisBlock = metadataSource.match(
    /private function runtime_ui_analyze_button_event_metadata\([\s\S]*?\n\}\n\nprivate function runtime_ui_resolve_button_click_dispatch_target/m
  )?.[0] ?? '';
  const buttonEventArgumentAnalysisBlock = metadataSource.match(
    /private function runtime_ui_analyze_button_event_argument_metadata\([\s\S]*?\n\}\n\nprivate function runtime_ui_analyze_button_event_metadata/m
  )?.[0] ?? '';

  assert.match(
    metadataSource,
    /let click_handler = Runtime\.json_to_str\(button_event_analysis\["click_handler"\]\);/
  );
  assert.match(
    metadataSource,
    /private function runtime_ui_analyze_button_event_argument_metadata\(\s*button_event_node_id: string\s*\): Json \{/
  );
  assert.match(
    buttonEventAnalysisBlock,
    /if \(click_dispatch_target != "" && click_dispatch_target != navigate_target_form\) \{\s*analysis\["click_handler"\] = click_dispatch_target;\s*\} else \{/s
  );
  assert.match(
    buttonEventAnalysisBlock,
    /let button_event_argument_analysis = runtime_ui_analyze_button_event_argument_metadata\(\s*button_event_node_id\s*\);/
  );
  assert.match(
    buttonEventAnalysisBlock,
    /let reflected_handler = runtime_ui_find_declaration_symbol_property\(button_node_json, "on_click"\);/
  );
  assert.match(
    buttonEventAnalysisBlock,
    /if \(reflected_handler == ""\) \{\s*reflected_handler = runtime_ui_find_declaration_symbol_property\(button_node_json, "click"\);\s*\}/s
  );
  assert.match(
    buttonEventArgumentAnalysisBlock,
    /runtime_ui_collect_descendant_node_matches_by_kind\(\s*normalized_button_event_node_id,\s*"navigateExpression"\s*\)/
  );
  assert.match(
    buttonEventArgumentAnalysisBlock,
    /let arguments_node_id = runtime_ui_find_child_node_id_by_kind\(\s*navigate_expression_node_id,\s*"arguments"\s*\);/
  );
  assert.match(
    buttonEventArgumentAnalysisBlock,
    /analysis\["form_arg_expr"\] = argument_expression;/
  );
  assert.doesNotMatch(metadataSource, /private function runtime_ui_resolve_button_click_handler\(/);
});

test('business/ui symbol resolution reuses one identifier-node lookup helper', () => {
  const metadataSource = fs.readFileSync(
    path.join(businessUiPackageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );
  const normalizedSymbolBlock = metadataSource.match(
    /private function runtime_ui_resolve_node_normalized_symbol_name\([\s\S]*?\n\}\n\nprivate function runtime_ui_matches_app_id/m
  )?.[0] ?? '';
  const symbolNameBlock = metadataSource.match(
    /private function runtime_ui_resolve_node_symbol_name\([\s\S]*?\n\}\n\nprivate function runtime_ui_build_node_debug_descriptor/m
  )?.[0] ?? '';

  assert.match(
    metadataSource,
    /private function runtime_ui_find_symbol_identifier_node_id\(node_json: Json\): string \{/s
  );
  assert.match(
    metadataSource,
    /private function runtime_ui_identifier_node_has_direct_symbol_name\(identifier_node_id: string\): bool \{/s
  );
  assert.match(
    normalizedSymbolBlock,
    /let identifier_node_id = runtime_ui_find_symbol_identifier_node_id\(node_json\);/s
  );
  assert.match(
    symbolNameBlock,
    /let identifier_node_id = runtime_ui_find_symbol_identifier_node_id\(node_json\);/s
  );
  assert.doesNotMatch(
    normalizedSymbolBlock,
    /let descendant_identifier_matches = runtime_ui_collect_descendant_node_matches_by_kind\(\s*node_id,\s*"identifier"\s*\)/s
  );
  assert.doesNotMatch(
    symbolNameBlock,
    /let descendant_identifier_matches = runtime_ui_collect_descendant_node_matches_by_kind\(\s*node_id,\s*"identifier"\s*\)/s
  );
  assert.match(
    metadataSource,
    /if \(\s*identifier_node_id != ""\s*&& !runtime_ui_identifier_node_has_direct_symbol_name\(identifier_node_id\)\s*\) \{\s*identifier_node_id = "";\s*\}/s
  );
  assert.match(
    metadataSource,
    /runtime_ui_identifier_node_has_direct_symbol_name\(\s*Runtime\.json_to_str\(descendant_identifier_node_id\)\s*\)/s
  );
  assert.match(
    metadataSource,
    /if \(identifier_node_id == ""\) \{\s*identifier_node_id = runtime_ui_find_first_child_node_id_by_kinds\(/s
  );
});

test('business/ui grid runtime state avoids persisting rows and reuses the pre-source snapshot', () => {
  const controlsSource = fs.readFileSync(
    path.join(businessUiPackageRoot, 'src/system/ui/runtime_ui.controls.functions.bl'),
    'utf8'
  );

  assert.match(
    controlsSource,
    /let next_control_runtime_state = runtime_ui_build_control_runtime_state\([\s\S]*?let source_input = runtime_ui_build_control_source_input\([\s\S]*?source_result = runtime_ui_normalize_grid_source_result\(/s
  );
  assert.match(
    controlsSource,
    /if \(next_control_runtime_state\["pagination"\] != null && total_count != null\) \{[\s\S]*next_pagination_state\["total_count"\] = runtime_ui_normalize_numeric_json\(total_count\);/s
  );
  assert.match(
    controlsSource,
    /if \(total_count != null\) \{\s*next_control_runtime_state\["totalRows"\] = runtime_ui_normalize_numeric_json\(total_count\);\s*\}/s
  );
  assert.match(
    controlsSource,
    /control_runtime_updates\[control_runtime_update_count\] = \{[\s\S]*"runtime_state": next_control_runtime_state[\s\S]*continue;/s
  );
  assert.doesNotMatch(
    controlsSource,
    /runtime_state\["rows"\] = form_state\[contract\.control_id\];/s
  );
  assert.doesNotMatch(
    controlsSource,
    /serialized_runtime_state\["rows"\] = runtime_state\.rows;/s
  );
});

test('business/ui client form state preserves declared state fields while omitting source-backed grid rows', () => {
  const controlsSource = fs.readFileSync(
    path.join(businessUiPackageRoot, 'src/system/ui/runtime_ui.controls.functions.bl'),
    'utf8'
  );

  assert.match(
    controlsSource,
    /private function runtime_ui_build_client_form_state\(\s*form_metadata: Json,\s*form_state: Json\s*\): Json \{[\s\S]*client_form_state\[control_id\] = null;[\s\S]*let state_fields = form_metadata\["state_fields"\] \?\? \[\];[\s\S]*client_form_state\[field_name\] = normalized_form_state\[field_name\];[\s\S]*return client_form_state;/s
  );
});

test('business/ui binding reflection stops recursing into type expressions', () => {
  const bindingSource = fs.readFileSync(
    path.join(businessUiPackageRoot, 'src/system/ui/runtime_ui.binding.functions.bl'),
    'utf8'
  );

  assert.match(
    bindingSource,
    /if \(node_kind == "typeExpression"\) \{\s*return reflection;\s*\}/s
  );
});

test('business/ui exposes compact master-data builders for app, form, field, datagrid, button, and toolbar info', () => {
  const metadataSource = fs.readFileSync(
    path.join(businessUiPackageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );

  assert.match(metadataSource, /private function runtime_ui_build_master_field_info\(control_metadata: Json\): Json \{/s);
  assert.match(metadataSource, /private function runtime_ui_build_master_datagrid_info\(control_metadata: Json\): Json \{/s);
  assert.match(metadataSource, /private function runtime_ui_build_master_button_info\(button_metadata: Json\): Json \{/s);
  assert.match(metadataSource, /private function runtime_ui_build_master_toolbar_info\(form_metadata: Json\): Json \{/s);
  assert.match(metadataSource, /private function runtime_ui_build_master_form_info\(form_metadata: Json\): Json \{/s);
  assert.match(metadataSource, /private function runtime_ui_build_master_app_info\(app_metadata: Json\): Json \{/s);
  assert.match(metadataSource, /"readonly": form_metadata\["readonly"\],/s);
  assert.match(metadataSource, /"load": form_metadata\["load"\],/s);
  assert.match(metadataSource, /"load_param": form_metadata\["load_param"\],/s);
  assert.match(metadataSource, /"binding_key_fields": form_metadata\["binding_key_fields"\],/s);
});

test('business/ui compact datagrid metadata preserves navigation form hints', () => {
  const metadataSource = fs.readFileSync(
    path.join(businessUiPackageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );

  assert.match(
    metadataSource,
    /let control_declaration_json = control_node_json;/s
  );
  assert.match(
    metadataSource,
    /control_declaration_json = ast\.node_to_json\(control_node_id\);/s
  );
  assert.match(
    metadataSource,
    /let on_select_form = runtime_ui_find_declaration_text_property\(\s*control_declaration_json,\s*"on_select_form"\s*\);/s
  );
  assert.match(
    metadataSource,
    /let on_double_click_form = runtime_ui_find_declaration_text_property\(\s*control_declaration_json,\s*"on_double_click_form"\s*\);/s
  );
  assert.match(metadataSource, /control_metadata\["on_select_form"\] = on_select_form;/);
  assert.match(metadataSource, /control_metadata\["on_double_click_form"\] = on_double_click_form;/);
  assert.match(metadataSource, /let on_select_form = runtime_ui_property_value\(control_metadata, "on_select_form"\);/);
  assert.match(metadataSource, /let on_double_click_form = runtime_ui_property_value\(control_metadata, "on_double_click_form"\);/);
  assert.match(metadataSource, /let declared_select_form = runtime_ui_find_declaration_text_property\(control_metadata, "on_select_form"\);/);
  assert.match(metadataSource, /let declared_double_click_form = runtime_ui_find_declaration_text_property\(control_metadata, "on_double_click_form"\);/);
  assert.match(metadataSource, /let row_double_click_event = events_metadata\["row_double_click"\];/);
  assert.match(metadataSource, /let row_double_click_navigate = row_double_click_event\["navigate"\];/);
  assert.match(metadataSource, /on_double_click_form = row_double_click_navigate\["target_form_id"\];/);
  assert.match(metadataSource, /master_datagrid\["on_select_form"\] = on_select_form;/);
  assert.match(metadataSource, /master_datagrid\["on_double_click_form"\] = on_double_click_form;/);
  assert.match(metadataSource, /let merged_controls = published_controls != null\s+\? runtime_ui_merge_control_metadata_entries\(base_controls, published_controls\)\s+: base_controls;/s);
  assert.match(metadataSource, /"form_body": runtime_ui_build_form_body_metadata\(merged_controls\),/);
  assert.match(metadataSource, /for \(published_entry in published_entries \?\? \[\]\) \{/);
  assert.match(metadataSource, /let base_entry = runtime_ui_find_metadata_entry_by_id\(base_entries, entry_id\);/);
  assert.match(metadataSource, /merged_entries\[merged_count\] = runtime_ui_merge_control_metadata_entry\(base_entry, published_entry\);/);
  assert.match(metadataSource, /if \(runtime_ui_find_metadata_entry_by_id\(published_entries, entry_id\) == null\) \{\s*merged_entries\[merged_count\] = base_entry;/s);
  assert.match(metadataSource, /if \(property_node_kind == "onPropertyKey"\) \{/);
  assert.match(metadataSource, /analysis\["symbol_names"\]\[symbol_count\] = "on_" \+ on_property_suffix;/);
  assert.match(metadataSource, /runtime_ui_collect_form_metadata_nodes_internal\(form_node_id, true\)/);
});

test('business/ui exposes app-info api by app name only for compact master metadata', () => {
  const metadataSource = fs.readFileSync(
    path.join(businessUiPackageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );
  const runtimeSource = fs.readFileSync(
    path.join(businessUiPackageRoot, 'src/system/ui/runtime_ui.functions.bl'),
    'utf8'
  );

  assert.match(metadataSource, /private function runtime_ui_build_master_button_info\(button_metadata: Json\): Json \{/s);
  assert.match(metadataSource, /if \(button_metadata\["icon"\] != null\) \{\s*button_info\["icon"\] = button_metadata\["icon"\];\s*\}/s);
  assert.match(runtimeSource, /public function runtime_ui_get_app_info\(app_name: string\): Json \{/s);
  assert.match(runtimeSource, /let master_app_info = runtime_ui_build_master_app_info_from_lookup\(\s*app_node_json,\s*form_lookup\s*\);/s);
  assert.match(runtimeSource, /return \{\s*"app": master_app_info\s*\};/s);
  assert.match(runtimeSource, /@http\(method: GET, path: "\/ui\/app-info\/\{app_name\}"\)/s);
  assert.match(runtimeSource, /public function runtime_ui_http_get_app_info\(app_name: string\): Json \{/s);
});

test('business/ui exposes explicit event-fire api that reuses the apply pipeline', () => {
  const runtimeSource = fs.readFileSync(
    path.join(businessUiPackageRoot, 'src/system/ui/runtime_ui.functions.bl'),
    'utf8'
  );
  const runtimeTypesSource = fs.readFileSync(
    path.join(businessUiPackageRoot, 'src/system/ui/runtime_ui.types.bl'),
    'utf8'
  );

  assert.match(runtimeTypesSource, /struct RuntimeUiFireEventRequest \{/s);
  assert.match(runtimeTypesSource, /struct RuntimeUiEventResponse \{/s);
  assert.match(runtimeSource, /public function runtime_ui_fire_event\(request: RuntimeUiFireEventRequest\): Json \{/s);
  assert.match(runtimeSource, /let apply_response = runtime_ui_apply\(apply_request\);/s);
  assert.match(runtimeSource, /let event_response = runtime_ui_build_event_response\(/s);
  assert.match(runtimeSource, /return runtime_ui_merge_grid_response_envelope\(event_response,\s*apply_response\);/s);
  assert.match(runtimeSource, /@http\(method: POST, path: "\/ui\/events\/fire"\)/s);
  assert.match(runtimeSource, /public function runtime_ui_http_fire_event\(request: Json\): Json \{/s);
  assert.match(runtimeSource, /fire_event_request\["event_name"\] = Runtime\.json_to_str\(/s);
});

test('business/ui exposes explicit session-open and session-sync apis on the split runtime surface', () => {
  const runtimeSource = fs.readFileSync(
    path.join(businessUiPackageRoot, 'src/system/ui/runtime_ui.functions.bl'),
    'utf8'
  );
  const runtimeTypesSource = fs.readFileSync(
    path.join(businessUiPackageRoot, 'src/system/ui/runtime_ui.types.bl'),
    'utf8'
  );

  assert.match(runtimeTypesSource, /struct RuntimeUiSessionOpenRequest \{/s);
  assert.match(runtimeTypesSource, /struct RuntimeUiSessionResumeRequest \{/s);
  assert.match(runtimeTypesSource, /struct RuntimeUiSessionCloseRequest \{/s);
  assert.match(runtimeTypesSource, /struct RuntimeUiSessionSyncRequest \{/s);
  assert.match(runtimeTypesSource, /struct RuntimeUiSessionResponse \{/s);
  assert.match(runtimeSource, /private function runtime_ui_prepare_open_form_template\(\s*app_id: string,\s*requested_form_id: string,\s*open_args: Json,\s*defer_data_load: bool\s*\): Json \{/s);
  assert.match(runtimeSource, /private function runtime_ui_prepare_open_form_runtime\(\s*request: RuntimeUiOpenFormRequest\s*\): Json \{/s);
  assert.match(runtimeSource, /private function runtime_ui_try_resolve_persisted_session_open\(\s*request: RuntimeUiSessionOpenRequest\s*\): Json\? \{/s);
  assert.match(runtimeSource, /public function runtime_ui_session_open\(request: RuntimeUiSessionOpenRequest\): Json \{/s);
  assert.match(runtimeSource, /let existing_session_response = runtime_ui_try_resolve_persisted_session_open\(request\);/s);
  assert.match(runtimeSource, /if \(existing_session_response != null\) \{\s*return existing_session_response;\s*\}/s);
  assert.match(runtimeSource, /let defer_data_load = request\["defer_data_load"\] == true;/s);
  assert.match(runtimeSource, /let open_template = runtime_ui_prepare_open_form_template\(\s*normalized_app_id,\s*request\.form_id,\s*normalized_open_args,\s*defer_data_load\s*\);/s);
  assert.match(runtimeSource, /let form_metadata = open_template\["form_metadata"\];/s);
  assert.match(runtimeSource, /let form_metadata = runtime_ui_find_open_form_metadata_in_lookup\(\s*form_lookup,\s*normalized_form_id,\s*defer_data_load\s*\);/s);
  assert.match(runtimeSource, /private function runtime_ui_can_defer_initial_open_session_persist\(\s*previous_app_session: Json,\s*previous_form_session: Json,\s*form_load_handler: string,\s*form_load_dispatch_target: string\s*\): bool \{/s);
  assert.match(runtimeSource, /private function runtime_ui_build_pending_open_app_session\(\s*session_id: string,\s*app_id: string,\s*normalized_session_context: Json\s*\): AppSession \{/s);
  assert.match(runtimeSource, /private function runtime_ui_build_pending_open_form_session\(\s*form_instance_id: string,\s*session_id: string,\s*app_id: string,\s*form_id: string,\s*bootstrap_revision: int,\s*normalized_session_context: Json\s*\): FormSession \{/s);
  assert.match(runtimeSource, /let can_defer_initial_open_session_persist = runtime_ui_can_defer_initial_open_session_persist\(\s*previous_app_session,\s*previous_form_session,\s*form_load_handler,\s*form_load_dispatch_target\s*\);/s);
  assert.match(runtimeSource, /if \(can_defer_initial_open_session_persist\) \{\s*app_session = runtime_ui_build_pending_open_app_session\(/s);
  assert.match(runtimeSource, /let previous_control_session_snapshots: Json = \[\];/s);
  assert.match(runtimeSource, /if \(!defer_data_load\) \{\s*let synced_initial_form_state = runtime_ui_require_open_synced_control_state\(/s);
  assert.match(runtimeSource, /"uiState": runtime_ui_build_state_sync_ui_state\(\s*form_instance_id,\s*form_metadata,\s*initial_form_state,\s*initial_control_runtime_updates,\s*persisted_ui_state,\s*defer_data_load\s*\)/s);
  assert.match(runtimeSource, /if \(previous_app_session is null && previous_form_session is null\) \{\s*let persisted_form_session = runtime_ui_save_form_session\(form_session\);\s*if \(defer_app_session_persist\) \{\s*persisted_open_bundle = persisted_form_session != null;\s*\} else \{\s*let persisted_app_session = runtime_ui_save_app_session\(app_session\);/s);
  assert.match(runtimeSource, /private function runtime_ui_http_request_app_identifier\(request: Json\): string \{/s);
  assert.match(runtimeSource, /return Runtime\.json_to_str\(runtime_ui_http_request_value\(request, "app_name", "appName"\)\);/s);
  assert.match(runtimeSource, /session_open_request\["app_id"\] = runtime_ui_http_request_app_identifier\(request\);/s);
  assert.match(runtimeSource, /session_open_request\["defer_data_load"\] = request\["defer_data_load"\] \?\? request\["deferDataLoad"\];/s);
  assert.match(runtimeSource, /Runtime\.json_to_str\(form_session\.session_id\)/s);
  assert.match(runtimeSource, /let defer_data_load = request\["defer_data_load"\] == true;/s);
  assert.match(runtimeSource, /if \(!defer_data_load\) \{\s*let synced_initial_form_state = runtime_ui_require_open_synced_control_state\(/s);
  assert.match(runtimeSource, /runtime_ui_require_resumable_session_context\(\s*request\.session_id,\s*request\.form_instance_id,\s*request\.app_id,\s*request\.form_id,\s*request\.context\s*\);/s);
  assert.match(runtimeSource, /let app_session = runtime_ui_get_app_session\(\s*normalized_session_id\s*\);/s);
  assert.match(runtimeSource, /let form_session = runtime_ui_get_form_session\(\s*normalized_form_instance_id\s*\);/s);
  assert.match(runtimeSource, /if \(app_session is null\) \{\s*app_session = runtime_ui_get_or_create_app_session\(\s*normalized_session_id,\s*Runtime\.json_to_str\(form_session\.app_id\),\s*session_context\s*\);/s);
  assert.match(runtimeSource, /let normalized_revision = Runtime\.json_to_i64\(form_session\["revision"\]\);|let normalized_revision = form_session\.revision;/s);
  assert.match(runtimeSource, /let open_runtime = runtime_ui_prepare_open_form_runtime\(request\);/s);
  assert.match(runtimeSource, /public function runtime_ui_session_resume\(request: RuntimeUiSessionResumeRequest\): Json \{/s);
  assert.match(runtimeSource, /public function runtime_ui_session_close\(request: RuntimeUiSessionCloseRequest\): Json \{/s);
  assert.match(runtimeSource, /public function runtime_ui_session_sync\(request: RuntimeUiSessionSyncRequest\): Json \{/s);
  assert.match(runtimeSource, /let apply_response = runtime_ui_apply\(apply_request\);/s);
  assert.match(runtimeSource, /let sync_response = runtime_ui_build_session_response\(/s);
  assert.match(runtimeSource, /return runtime_ui_merge_grid_response_envelope\(sync_response, apply_response\);/s);
  assert.match(runtimeSource, /let sync_response = runtime_ui_build_session_response\(/s);
  assert.match(runtimeSource, /return runtime_ui_merge_grid_response_envelope\(sync_response,\s*apply_response\);/s);
  assert.match(runtimeSource, /let event_response = runtime_ui_build_event_response\(/s);
  assert.match(runtimeSource, /return runtime_ui_merge_grid_response_envelope\(event_response,\s*apply_response\);/s);
  assert.match(runtimeSource, /private function runtime_ui_skip_post_execution_control_sync\(\s*control_metadata: Json,\s*control_kind: string,\s*event_name: string\s*\): bool \{/s);
  assert.match(runtimeSource, /private function runtime_ui_resolve_post_execution_sync_target_control_id\(\s*control_metadata: Json,\s*control_id: string,\s*control_kind: string,\s*event_name: string\s*\): string \{/s);
  assert.match(runtimeSource, /if \(!runtime_ui_skip_post_execution_control_sync\(control_metadata, control_kind, event_name\)\) \{\s*return "";\s*\}/s);
  assert.match(runtimeSource, /let post_execution_sync_target_control_id =\s*runtime_ui_resolve_post_execution_sync_target_control_id\(\s*execution_control_metadata,\s*execution_control_id,\s*execution_control_kind,\s*execution_event_name\s*\);/s);
  assert.match(runtimeSource, /let synced_execution_form_state = runtime_ui_sync_control_sessions\(\s*normalized_session_id,\s*normalized_form_instance_id,\s*effective_app_id,\s*effective_form_id,\s*next_revision,\s*form_metadata,\s*internal_form_state\.state,\s*null,\s*persisted_ui_state,\s*post_execution_sync_target_control_id,\s*sync_only_grid_source_handler\s*\);/s);
  assert.match(runtimeSource, /@http\(method: POST, path: "\/ui\/session\/open"\)/s);
  assert.match(runtimeSource, /@http\(method: POST, path: "\/ui\/session\/resume"\)/s);
  assert.match(runtimeSource, /@http\(method: POST, path: "\/ui\/session\/sync"\)/s);
  assert.match(runtimeSource, /@http\(method: POST, path: "\/ui\/session\/close"\)/s);
  assert.match(runtimeSource, /\n  open_request\["args"\] = request\["args"\] \?\? request\["payload"\];/s);
  assert.doesNotMatch(runtimeSource, /\n  open_request\["args"\] = request\["args"\] \?\? request\["payload"\] \?\? request\["__payload"\];/s);
  assert.match(runtimeSource, /\n  session_open_request\["args"\] = request\["args"\] \?\? request\["payload"\];/s);
  assert.match(runtimeSource, /\n  session_open_request\["defer_data_load"\] = request\["defer_data_load"\] \?\? request\["deferDataLoad"\];/s);
  assert.doesNotMatch(runtimeSource, /\n  session_open_request\["args"\] = request\["args"\] \?\? request\["payload"\] \?\? request\["__payload"\];/s);
});

test('business/ui deferred open uses lightweight published form metadata before detailed fallback', () => {
  const metadataSource = fs.readFileSync(
    path.join(businessUiPackageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );

  assert.match(metadataSource, /private function runtime_ui_build_minimal_deferred_grid_open_control_metadata\(\s*control_node_json: Json\s*\): Json \{/s);
  assert.match(metadataSource, /private function runtime_ui_build_minimal_deferred_grid_open_form_metadata\(\s*form_node_json: Json\s*\): Json \{/s);
  assert.match(metadataSource, /private function runtime_ui_build_published_unbound_open_form_metadata\(\s*form_node_json: Json\s*\): Json \{/s);
  assert.match(metadataSource, /let published_body = runtime_ui_published_property_value\(form_node_json, "body"\);/s);
  assert.match(metadataSource, /let published_controls = published_body != null \? published_body\["controls"\] : null;/s);
  assert.match(metadataSource, /for \(control_metadata in published_controls \?\? \[\]\) \{/s);
  assert.match(metadataSource, /let has_grid_like_control = false;/s);
  assert.match(metadataSource, /if \(control_type == "DataGrid" \|\| control_type == "Grid"\) \{/s);
  assert.match(metadataSource, /private function runtime_ui_build_lightweight_open_form_metadata\(\s*form_node_json: Json\s*\): Json \{/s);
  assert.match(metadataSource, /let form_metadata = runtime_ui_build_form_metadata_core\(form_node_json, false\);/s);
  assert.match(metadataSource, /private function runtime_ui_find_open_form_metadata_in_lookup\(\s*form_lookup: Json,\s*form_id: string,\s*prefer_lightweight_runtime_metadata: bool\s*\): Json \{/s);
  assert.match(metadataSource, /if \(prefer_lightweight_runtime_metadata\) \{\s*let minimal_deferred_grid_form_metadata = runtime_ui_build_minimal_deferred_grid_open_form_metadata\(/s);
  assert.match(metadataSource, /let published_form_metadata = runtime_ui_build_published_unbound_open_form_metadata\(/s);
  assert.match(metadataSource, /let lightweight_form_metadata = runtime_ui_build_lightweight_open_form_metadata\(/s);
  assert.match(metadataSource, /return runtime_ui_build_form_metadata\(form_node_json\);/s);
});

test('business/ui legacy apply bridge requires canonical top-level runtime fields', () => {
  const runtimeSource = fs.readFileSync(
    path.join(businessUiPackageRoot, 'src/system/ui/runtime_ui.functions.bl'),
    'utf8'
  );

  assert.match(runtimeSource, /public function runtime_ui_http_apply\(request: Json\): Json \{/s);
  assert.match(runtimeSource, /let apply_request = runtime_ui_build_http_active_form_request_base\(request\);/s);
  assert.doesNotMatch(runtimeSource, /let transaction = request\["transaction"\];/s);
  assert.doesNotMatch(runtimeSource, /transaction\["sessionId"\]/s);
  assert.doesNotMatch(runtimeSource, /transaction\["formInstanceId"\]/s);
  assert.doesNotMatch(runtimeSource, /transaction\["app_id"\]/s);
  assert.doesNotMatch(runtimeSource, /transaction\["formId"\]/s);
  assert.doesNotMatch(runtimeSource, /transaction\["revision"\]/s);
  assert.match(runtimeSource, /apply_request\["event"\] = request\["event"\] \?\? \{/s);
  assert.match(runtimeSource, /runtime_ui_http_request_value\(request, "event_name", "eventName"\)/s);
  assert.match(runtimeSource, /"payload": request\["payload"\]/s);
  assert.doesNotMatch(runtimeSource, /"payload": request\["payload"\] \?\? request\["__payload"\]/s);
  assert.match(runtimeSource, /apply_request\["context"\] = request\["context"\];/s);
});

test('business/ui apply transaction builder is removed from the canonical path', () => {
  const executionSource = fs.readFileSync(
    path.join(businessUiPackageRoot, 'src/system/ui/runtime_ui.execution.functions.bl'),
    'utf8'
  );

  assert.doesNotMatch(
    executionSource,
    /private function runtime_ui_build_apply_transaction\(/s
  );
});

test('business/ui apply and event-fire responses expose canonical top-level effects and navigation', () => {
  const runtimeSource = fs.readFileSync(
    path.join(businessUiPackageRoot, 'src/system/ui/runtime_ui.functions.bl'),
    'utf8'
  );
  const controlsSource = fs.readFileSync(
    path.join(businessUiPackageRoot, 'src/system/ui/runtime_ui.controls.functions.bl'),
    'utf8'
  );

  assert.match(
    runtimeSource,
    /let apply_response: Json = \{[\s\S]*"messages": execution_messages,[\s\S]*"effects": execution_effects,[\s\S]*"navigation": execution_navigation,[\s\S]*"data": execution_transfer_payload,[\s\S]*"__ui": \{/s
  );
  assert.doesNotMatch(
    runtimeSource,
    /let apply_response: Json = \{[\s\S]*"__payload": execution_transfer_payload/s
  );
  assert.doesNotMatch(
    runtimeSource,
    /let apply_response: Json = \{[\s\S]*"transaction": runtime_ui_build_apply_transaction\(/s
  );
  assert.match(
    runtimeSource,
    /let apply_grid_response_control_id = runtime_ui_resolve_apply_grid_response_control_id\(\s*form_metadata,\s*execution_control_id,\s*normalized_state_sync\["uiState"\] \?\? \{\},\s*normalized_ui_state\s*\);[\s\S]*if \(apply_grid_response\["rows"\] == null\) \{[\s\S]*runtime_ui_build_grid_response_envelope\(\s*form_metadata,\s*normalized_form_state,\s*apply_grid_response_control_id\s*\);/s
  );
  assert.match(
    runtimeSource,
    /private function runtime_ui_resolve_apply_grid_response_control_id\(\s*form_metadata: Json,\s*execution_control_id: string,\s*request_ui_state: Json,\s*normalized_ui_state: Json\s*\): string \{[\s\S]*if \(normalized_execution_control_id != ""\) \{\s*return normalized_execution_control_id;\s*\}[\s\S]*let preferred_grid_control_id = runtime_ui_resolve_preferred_grid_control_id\(\s*form_metadata,\s*request_ui_state,\s*normalized_ui_state\s*\);[\s\S]*if \(preferred_grid_control_id != ""\) \{\s*return preferred_grid_control_id;\s*\}/s
  );
  assert.match(
    controlsSource,
    /private function runtime_ui_build_grid_response_envelope\(\s*form_metadata: Json,\s*form_state: Json,\s*preferred_control_id: string\?\s*\): Json \{[\s\S]*let normalized_preferred_control_id = Runtime\.json_to_str\(preferred_control_id\);[\s\S]*runtime_ui_find_control_metadata\(\s*form_metadata,\s*normalized_preferred_control_id\s*\)/s
  );
  assert.match(
    controlsSource,
    /private function runtime_ui_sync_control_sessions\(\s*session_id: string,\s*form_instance_id: string,\s*app_id: string,\s*form_id: string,\s*revision: int,\s*form_metadata: Json,\s*form_state: Json,\s*request_ui_state: Json,\s*persisted_ui_state: Json,\s*preferred_control_id: string\?,\s*preferred_source_handler: string\?\s*\): RuntimeUiControlSyncResult\? \{[\s\S]*let normalized_preferred_control_id = Runtime\.json_to_str\(preferred_control_id\);[\s\S]*let normalized_preferred_source_handler = Runtime\.json_to_str\(preferred_source_handler\);[\s\S]*if \(normalized_preferred_control_id == ""\) \{\s*normalized_preferred_control_id = runtime_ui_resolve_preferred_grid_control_id\(\s*form_metadata,\s*request_ui_state,\s*null\s*\);\s*\}[\s\S]*if \(\s*normalized_preferred_source_handler != ""\s*&&\s*normalized_preferred_control_id != ""\s*&&\s*control_id == normalized_preferred_control_id\s*\) \{\s*source_handler = normalized_preferred_source_handler;\s*\}[\s\S]*if \(\s*normalized_preferred_control_id != ""\s*&&\s*control_id != normalized_preferred_control_id\s*\) \{\s*continue;\s*\}[\s\S]*sync_result\["grid_response"\] = runtime_ui_build_grid_response_envelope\(\s*form_metadata,\s*next_form_state,\s*normalized_preferred_control_id\s*\);/s
  );
  assert.match(
    controlsSource,
    /private function runtime_ui_resolve_preferred_grid_control_id\(\s*form_metadata: Json,\s*request_ui_state: Json,\s*persisted_ui_state: Json\s*\): string \{[\s\S]*let primary_control_metadata = runtime_ui_find_control_metadata\(form_metadata, "ui"\);[\s\S]*if \(\s*\(primary_control_kind == "DataGrid" \|\| primary_control_kind == "Grid"\)\s*&& runtime_ui_is_source_backed_grid_control\(primary_control_metadata\)\s*\) \{\s*return "ui";\s*\}[\s\S]*let controls = runtime_ui_form_controls\(form_metadata\);[\s\S]*if \(!runtime_ui_is_source_backed_grid_control\(control_metadata\)\) \{\s*continue;\s*\}[\s\S]*if \(request_ui_state != null && request_ui_state\[control_id\] != null\) \{\s*return control_id;\s*\}[\s\S]*if \(persisted_ui_state != null && persisted_ui_state\[control_id\] != null\) \{\s*return control_id;\s*\}/s
  );
  assert.match(
    controlsSource,
    /private function runtime_ui_sync_only_grid_event\(control_kind: string, event_name: string\): bool \{[\s\S]*if \(normalized_event_name == "load"\) \{\s*return true;\s*\}/s
  );
  assert.match(
    runtimeSource,
    /execution_handler = Runtime\.json_to_str\(execution_targets\["handler"\]\);[\s\S]*execution_dispatch_target = Runtime\.json_to_str\(execution_targets\["dispatch_target"\]\);[\s\S]*if \(runtime_ui_sync_only_grid_event\(execution_control_kind, execution_event_name\)\) \{\s*sync_only_grid_source_handler = execution_handler;\s*execution_handler = "";\s*execution_dispatch_target = "";\s*\}/s
  );
  assert.match(
    runtimeSource,
    /public function runtime_ui_fire_event\(request: RuntimeUiFireEventRequest\): Json \{[\s\S]*let apply_response = runtime_ui_apply\(apply_request\);[\s\S]*apply_response\["effects"\] \?\? \[\],[\s\S]*apply_response\["navigation"\],[\s\S]*apply_response\["data"\]/s
  );
  assert.match(
    runtimeSource,
    /public function runtime_ui_fire_event\(request: RuntimeUiFireEventRequest\): Json \{[\s\S]*let event_payload = request\.payload;[\s\S]*"payload": event_payload/s
  );
  assert.match(
    runtimeSource,
    /public function runtime_ui_fire_event\(request: RuntimeUiFireEventRequest\): Json \{[\s\S]*let event_payload = request\.payload;[\s\S]*let target_form_id = request\["target_form_id"\] \?\? request\["targetFormId"\];[\s\S]*event_payload\["target_form_id"\][\s\S]*"target_form_id": target_form_id,[\s\S]*"targetFormId": target_form_id/s
  );
  assert.match(
    runtimeSource,
    /public function runtime_ui_http_fire_event\(request: Json\): Json \{[\s\S]*let payload = request\["payload"\];[\s\S]*fire_event_request\["payload"\] = payload;/s
  );
  assert.match(
    runtimeSource,
    /public function runtime_ui_http_fire_event\(request: Json\): Json \{[\s\S]*let payload = request\["payload"\];[\s\S]*fire_event_request\["target_form_id"\] = runtime_ui_http_request_value\([\s\S]*payload\["target_form_id"\][\s\S]*payload\["targetFormId"\][\s\S]*payload\["form_id"\][\s\S]*payload\["form"\]/s
  );
  assert.doesNotMatch(
    runtimeSource,
    /public function runtime_ui_http_fire_event\(request: Json\): Json \{[\s\S]*request\["__payload"\]/s
  );
});

test('business/ui lightweight open-form metadata keeps runtime binding details for load-backed forms', () => {
  const metadataSource = fs.readFileSync(
    path.join(businessUiPackageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );

  const lightweightBlock = metadataSource.match(
    /private function runtime_ui_build_lightweight_open_form_metadata\([\s\S]*?\n\}\n/
  )?.[0] ?? '';

  assert.match(
    lightweightBlock,
    /let form_metadata = runtime_ui_build_form_metadata_core\(form_node_json, true\);/
  );
});

test('business/ui form declaration lookup only collects canonical formDeclaration nodes', () => {
  const metadataSource = fs.readFileSync(
    path.join(businessUiPackageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );

  const lookupBlock = metadataSource.match(
    /private function runtime_ui_collect_form_declaration_matches\(\): Json \{[\s\S]*?\n\}\n/
  )?.[0] ?? '';

  assert.match(
    lookupBlock,
    /return runtime_ui_collect_nodes_by_kinds\(\[\s*"formDeclaration"\s*\]\);/s
  );
  assert.doesNotMatch(lookupBlock, /formDeclarationWithHeader/);
  assert.doesNotMatch(lookupBlock, /formDeclarationWithoutHeader/);
});

test('business/ui form metadata analyzes wrapped declaration nodes for header and body reflection', () => {
  const metadataSource = fs.readFileSync(
    path.join(businessUiPackageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );

  assert.match(
    metadataSource,
    /private function runtime_ui_resolve_form_analysis_node\(node_json: Json\): Json \{[\s\S]*"formDeclarationWithHeader"[\s\S]*"formDeclarationWithoutHeader"/s
  );
  assert.match(
    metadataSource,
    /private function runtime_ui_build_form_metadata_core\([\s\S]*let form_analysis_node_json = runtime_ui_resolve_form_analysis_node\(form_node_json\);[\s\S]*runtime_ui_analyze_direct_form_structure\(form_analysis_node_json\);[\s\S]*runtime_ui_collect_form_header_property_analysis\(\s*form_analysis_node_json\s*\)/s
  );
});

test('business/ui form metadata can recover binding type from load handler return types', () => {
  const metadataSource = fs.readFileSync(
    path.join(businessUiPackageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );

  assert.match(
    metadataSource,
    /private function runtime_ui_find_handler_return_type_expression_node_id\(\s*handler_declaration_node_id: string\s*\): string \{[\s\S]*"functionReturnType"[\s\S]*runtime_ui_find_first_descendant_node_id_by_kind\([\s\S]*"typeExpression"[\s\S]*runtime_ui_find_child_node_id_by_kind\([\s\S]*"typeExpression"/s
  );
  assert.match(
    metadataSource,
    /private function runtime_ui_find_handler_return_reference_symbol_name\(handler_symbol: string\): string \{/s
  );
  assert.match(
    metadataSource,
    /let handler_return_type_expression_node_id = runtime_ui_find_handler_return_type_expression_node_id\(\s*handler_declaration_node_id\s*\);[\s\S]*let handler_return_contract = runtime_ui_build_binding_member_type\(\s*handler_return_type_expression_node_id\s*\);[\s\S]*let handler_return_reference_symbol = Runtime\.json_to_str\([\s\S]*runtime_ui_resolve_binding_declaration_kind\(handler_return_reference_symbol\) != ""[\s\S]*let handler_return_symbol_names = runtime_ui_collect_descendant_symbol_names\([\s\S]*for \(handler_return_symbol_name in handler_return_symbol_names \?\? \[]\) \{[\s\S]*runtime_ui_resolve_binding_declaration_kind\(normalized_handler_return_symbol_name\) != ""[\s\S]*return normalized_handler_return_symbol_name;[\s\S]*return "";/s
  );
  assert.match(
    metadataSource,
    /let reflected_load_return_binding_type = "";\s*if \(\s*include_runtime_details\s*&& load_handler != null\s*&& Runtime\.json_to_str\(load_handler\["handler"\]\) != ""\s*\) \{[\s\S]*runtime_ui_find_handler_return_reference_symbol_name\(\s*Runtime\.json_to_str\(load_handler\["handler"\]\)\s*\);[\s\S]*let reflected_load_return_binding_kind = runtime_ui_resolve_binding_declaration_kind\([\s\S]*Runtime\.json_to_str\(ui_from\) == ""[\s\S]*reflected_load_return_binding_kind != ""[\s\S]*ui_from = reflected_load_return_binding_type;/s
  );
  assert.match(
    metadataSource,
    /let should_repair_binding_from_load_return =[\s\S]*reflected_load_return_binding_type != ""[\s\S]*reflected_load_return_binding_kind != ""[\s\S]*Runtime\.json_to_str\(binding_kind\) == ""[\s\S]*!runtime_ui_has_any_items\(binding_members\)[\s\S]*!runtime_ui_has_any_items\(binding_key_fields\)[\s\S]*!runtime_ui_has_any_controls\(controls\)[\s\S]*if \(should_repair_binding_from_load_return\) \{[\s\S]*ui_from = reflected_load_return_binding_type;[\s\S]*binding_kind = reflected_load_return_binding_kind;[\s\S]*binding_members = runtime_ui_build_binding_members_for_type\([\s\S]*binding_key_fields = runtime_ui_build_binding_key_fields_from_members\(binding_members\);[\s\S]*controls = runtime_ui_build_form_controls_from_binding_members\(binding_members\);/s
  );
});

test('business/ui form metadata recovers empty control surfaces from binding fallback sources', () => {
  const metadataSource = fs.readFileSync(
    path.join(businessUiPackageRoot, 'src/system/ui/runtime_ui.metadata.functions.bl'),
    'utf8'
  );

  assert.match(
    metadataSource,
    /let recovered_binding_type = "";/s
  );
  assert.match(
    metadataSource,
    /if \(include_runtime_details && !runtime_ui_has_any_controls\(controls\)\) \{[\s\S]*recovered_binding_type = Runtime\.json_to_str\(ui_from\);/s
  );
  assert.match(
    metadataSource,
    /recovered_binding_type = Runtime\.json_to_str\(direct_form_structure\["ui_from"\]\);/s
  );
  assert.match(
    metadataSource,
    /recovered_binding_type = reflected_shorthand_ui_from;/s
  );
  assert.match(
    metadataSource,
    /recovered_binding_type = runtime_ui_find_handler_return_reference_symbol_name\(/s
  );
  assert.match(
    metadataSource,
    /let reflected_binding_members = runtime_ui_build_binding_members_for_type\(\s*recovered_binding_type\s*\);[\s\S]*binding_members = reflected_binding_members;/s
  );
  assert.match(
    metadataSource,
    /if \(!runtime_ui_has_any_items\(binding_members\)\) \{[\s\S]*runtime_ui_build_binding_members_for_type\(/s
  );
  assert.match(
    metadataSource,
    /if \(!runtime_ui_has_any_items\(binding_key_fields\)\) \{[\s\S]*runtime_ui_build_binding_key_fields_from_members\(binding_members\);/s
  );
  assert.match(
    metadataSource,
    /let reflected_controls = runtime_ui_build_form_controls_from_binding_members\(\s*binding_members\s*\);[\s\S]*controls = reflected_controls;/s
  );
  assert.match(
    metadataSource,
    /"readonly": runtime_ui_form_has_direct_modifier\(canonical_form_node_id, "formModifier"\)\s*\|\|\s*runtime_ui_form_has_direct_modifier\(form_node_id, "formModifier"\)/s
  );
});
