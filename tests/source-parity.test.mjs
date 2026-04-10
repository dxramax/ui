import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { expectedUiBusinessSourceParityPairs } from './inventory-contract-helper.mjs';
import { resolveEngineBusinessSourceRoot } from '../scripts/engine-root.mjs';

const packageRoot = path.resolve(import.meta.dirname, '..');
const businessSourceRoot = resolveEngineBusinessSourceRoot();

test('business/ui packaged shared modules stay byte-identical to canonical business source modules', () => {
  for (const [packageRelativePath, businessSourceRelativePath] of expectedUiBusinessSourceParityPairs) {
    const packagedPath = path.join(packageRoot, packageRelativePath);
    const businessSourcePath = path.join(businessSourceRoot, businessSourceRelativePath);

    assert.equal(fs.existsSync(packagedPath), true, `expected packaged file ${packageRelativePath}`);
    assert.equal(
      fs.existsSync(businessSourcePath),
      true,
      `expected business source file ${businessSourceRelativePath}`
    );

    const packagedContent = fs.readFileSync(packagedPath, 'utf8');
    const businessSourceContent = fs.readFileSync(businessSourcePath, 'utf8');

    assert.equal(
      packagedContent,
      businessSourceContent,
      `expected ${packageRelativePath} to stay aligned with ${businessSourceRelativePath}`
    );
  }
});
