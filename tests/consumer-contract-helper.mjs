import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  expectedUiManifestContract
} from './manifest-contract-helper.mjs';

export function assertUiConsumerManifestContract(pkg) {
  assert.equal(pkg.schemaVersion, expectedUiManifestContract.schemaVersion);
  assert.equal(pkg.name, expectedUiManifestContract.name);
  assert.equal(pkg.version, expectedUiManifestContract.version);
  assert.equal(pkg.packageKind, expectedUiManifestContract.packageKind);
  assert.deepEqual(pkg.repository, expectedUiManifestContract.repository);
  assert.deepEqual(pkg.readme, expectedUiManifestContract.readme);
  assert.deepEqual(pkg.artifacts, expectedUiManifestContract.artifacts);
  assert.deepEqual(pkg.exports, expectedUiManifestContract.exports);
}

export function resolveUiConsumerExportPath(manifestPath, pkg, exportKey) {
  const entry = pkg.exports?.[exportKey];
  assert.ok(entry, `expected export ${exportKey}`);
  assert.equal(entry.kind, exportKey === './readme' ? 'readme' : 'bl-module');
  return path.resolve(path.dirname(manifestPath), entry.path);
}

export function assertUiConsumerExportFilesExist(manifestPath, pkg, messagePrefix) {
  for (const exportKey of Object.keys(pkg.exports || {})) {
    const exportPath = resolveUiConsumerExportPath(manifestPath, pkg, exportKey);
    assert.equal(
      fs.existsSync(exportPath),
      true,
      `${messagePrefix} ${exportKey} to exist`
    );
  }

  const readmeExport = pkg.exports?.['./readme'];
  assert.ok(readmeExport, 'expected ./readme export');
  assert.equal(readmeExport.kind, 'readme');
  assert.equal(readmeExport.path, pkg.readme.path);
}

export function resolveUiConsumerRuntimeFunctionsPath(manifestPath, pkg) {
  return resolveUiConsumerExportPath(manifestPath, pkg, './runtime/functions');
}

export function readUiConsumerRuntimeFunctionsSource(manifestPath, pkg) {
  return fs.readFileSync(resolveUiConsumerRuntimeFunctionsPath(manifestPath, pkg), 'utf8');
}

export function prepareUiConsumerBoundary(manifestPath, pkg, messagePrefix) {
  assertUiConsumerManifestContract(pkg);
  assertUiConsumerExportFilesExist(manifestPath, pkg, messagePrefix);
  return readUiConsumerRuntimeFunctionsSource(manifestPath, pkg);
}
