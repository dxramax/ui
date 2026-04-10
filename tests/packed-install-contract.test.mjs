import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  assertUiConsumerExportFilesExist,
  assertUiConsumerManifestContract
} from './consumer-contract-helper.mjs';
import {
  assertPackedBusinessUiInstalledPathInsideRoot,
  businessUiNestedRuntimeSourceRoot,
  packAndExtractBusinessUi,
  resolvePackedBusinessUiInstalledPath
} from './packed-artifact-helper.mjs';
import { expectedUiReadme } from './manifest-contract-helper.mjs';

function assertPackedInstallContract({ extractionRoot, manifestPath, manifest }) {
  assertUiConsumerManifestContract(manifest);
  assertUiConsumerExportFilesExist(manifestPath, manifest, 'expected installed business/ui export');
  assert.equal(path.basename(manifestPath), 'nezam.package.json');

  for (const [exportKey, entry] of Object.entries(manifest.exports || {})) {
    const relativePath = String(entry?.path || '');
    const resolvedPath = assertPackedBusinessUiInstalledPathInsideRoot(
      extractionRoot,
      relativePath,
      exportKey
    );
    assert.equal(fs.existsSync(resolvedPath), true, `expected installed file for ${exportKey}`);
  }

  assert.deepEqual(manifest.readme, expectedUiReadme);

  const readmePath = resolvePackedBusinessUiInstalledPath(extractionRoot, manifest.readme.path);
  const readmeSource = fs.readFileSync(readmePath, 'utf8');

  assert.match(readmeSource, /packages\.nezam\.ai/);
  assert.doesNotMatch(readmeSource, /file:\/\//);
  assert.doesNotMatch(readmeSource, /vscode:\/\//);
}

test('business/ui packed artifact stays self-contained as an installed package contract', () => {
  assertPackedInstallContract(
    packAndExtractBusinessUi('business-ui-packed-install')
  );
});

test('business/ui nested packed artifact stays self-contained as an installed package contract', () => {
  assertPackedInstallContract(
    packAndExtractBusinessUi('business-ui-packed-install-nested', {
      cwd: businessUiNestedRuntimeSourceRoot
    })
  );
});
