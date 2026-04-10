import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { prepareUiConsumerBoundary } from './consumer-contract-helper.mjs';

export const businessUiPackageRoot = path.resolve(import.meta.dirname, '..');
export const businessUiSourceManifestPath = path.resolve(
  businessUiPackageRoot,
  'nezam.package.json'
);

export function resolveBusinessUiSourceManifestPath(fromDir) {
  return path.resolve(fromDir, 'nezam.package.json');
}

export function readBusinessUiSourcePackage(fromDir) {
  const manifestPath = resolveBusinessUiSourceManifestPath(fromDir);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  return {
    manifestPath,
    manifest
  };
}

export function readBusinessUiOwnPackage() {
  const manifest = JSON.parse(fs.readFileSync(businessUiSourceManifestPath, 'utf8'));
  return {
    manifestPath: businessUiSourceManifestPath,
    manifest
  };
}

export function resolveBusinessUiSourceExportPath(manifestPath, pkg, exportKey) {
  const entry = pkg.exports?.[exportKey];
  assert.ok(entry, `expected export ${exportKey}`);
  assert.equal(entry.kind, exportKey === './readme' ? 'readme' : 'bl-module');
  return path.resolve(path.dirname(manifestPath), entry.path);
}

export function readBusinessUiOwnExportSource(exportKey) {
  const { manifest } = readBusinessUiOwnPackage();
  const exportPath = resolveBusinessUiSourceExportPath(
    businessUiSourceManifestPath,
    manifest,
    exportKey
  );
  const source = fs.readFileSync(exportPath, 'utf8');
  return {
    manifest,
    exportPath,
    source
  };
}

export function prepareBusinessUiSourceBoundary(fromDir, messagePrefix) {
  const { manifestPath, manifest } = readBusinessUiSourcePackage(fromDir);
  const runtimeFunctionsSource = prepareUiConsumerBoundary(
    manifestPath,
    manifest,
    messagePrefix
  );
  return {
    manifestPath,
    manifest,
    runtimeFunctionsSource
  };
}
