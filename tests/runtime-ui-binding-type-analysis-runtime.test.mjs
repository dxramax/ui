import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { businessUiPackageRoot } from './source-package-helper.mjs';

test('business/ui runtime binding reuses one type-expression analysis per reflected binding member', () => {
  const bindingSource = fs.readFileSync(
    path.join(businessUiPackageRoot, 'src/system/ui/runtime_ui.binding.functions.bl'),
    'utf8'
  );

  assert.match(
    bindingSource,
    /private function runtime_ui_analyze_binding_member_type_expression\(\s*type_expression_node_id: string\s*\): Json \{/
  );
  assert.match(bindingSource, /"member_type": member_type,/);
  assert.match(bindingSource, /"value_type": value_type,/);
  assert.match(bindingSource, /"numeric_properties": numeric_properties/);

  assert.match(
    bindingSource,
    /private function runtime_ui_build_binding_member_type\(type_expression_node_id: string\): Json \{\s*return runtime_ui_analyze_binding_member_type_expression\(type_expression_node_id\)\["member_type"\];\s*\}/s
  );
  assert.match(
    bindingSource,
    /private function runtime_ui_resolve_binding_member_value_type\(type_expression_node_id: string\): string \{\s*return Runtime\.json_to_str\(\s*runtime_ui_analyze_binding_member_type_expression\(type_expression_node_id\)\["value_type"\]\s*\);\s*\}/s
  );
  assert.match(
    bindingSource,
    /private function runtime_ui_collect_binding_member_type_numeric_properties\(\s*type_expression_node_id: string\s*\): Json \{\s*return runtime_ui_analyze_binding_member_type_expression\(type_expression_node_id\)\[\s*"numeric_properties"\s*\] \?\? \{\};\s*\}/s
  );

  assert.match(bindingSource, /let type_analysis = runtime_ui_analyze_binding_member_type_expression\(/);
  assert.match(bindingSource, /let value_type = Runtime\.json_to_str\(type_analysis\["value_type"\]\);/);
  assert.match(bindingSource, /let type_numeric_properties = type_analysis\["numeric_properties"\] \?\? \{\};/);
  assert.match(bindingSource, /"member_type": type_analysis\["member_type"\],/);
});
