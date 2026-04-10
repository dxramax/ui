import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { prepareUiConsumerBoundary } from './consumer-contract-helper.mjs';

const businessUiPackageRoot = path.resolve(import.meta.dirname, '..');
const businessUiPackCliPath = path.resolve(
  businessUiPackageRoot,
  'scripts/nzm.mjs'
);
export const businessUiNestedRuntimeSourceRoot = path.join(
  businessUiPackageRoot,
  'src/system/ui'
);

export function readPackedBusinessUiPackage(manifestPath) {
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

export function listPackedBusinessUiEntries(artifactPath) {
  return execFileSync('tar', ['-tzf', artifactPath], {
    cwd: businessUiPackageRoot,
    encoding: 'utf8'
  })
    .trim()
    .split('\n')
    .filter(Boolean)
    .sort();
}

export function readPackedBusinessUiFile(artifactPath, packedFile) {
  return execFileSync('tar', ['-xOzf', artifactPath, packedFile], {
    cwd: businessUiPackageRoot,
    encoding: 'utf8'
  });
}

export function resolvePackedBusinessUiInstalledPath(extractionRoot, relativePath) {
  return path.resolve(extractionRoot, String(relativePath || ''));
}

export function assertPackedBusinessUiInstalledPathInsideRoot(
  extractionRoot,
  relativePath,
  label
) {
  const resolvedPath = resolvePackedBusinessUiInstalledPath(extractionRoot, relativePath);

  assert.notEqual(String(relativePath || '').trim(), '', `expected non-blank path for ${label}`);
  assert.equal(path.isAbsolute(String(relativePath || '')), false, `expected relative path for ${label}`);
  assert.equal(
    resolvedPath === extractionRoot || resolvedPath.startsWith(`${extractionRoot}${path.sep}`),
    true,
    `expected ${label} to resolve inside the extracted package root`
  );

  return resolvedPath;
}

export function packBusinessUiArtifact({
  tempPrefix = 'business-ui-packed-artifact',
  cwd = businessUiPackageRoot
} = {}) {
  const isolatedHome = fs.mkdtempSync(path.join(os.tmpdir(), `${tempPrefix}-home-`));
  const isolatedEnv = {
    ...process.env,
    HOME: isolatedHome,
    XDG_CONFIG_HOME: path.join(isolatedHome, '.config')
  };
  const packedArtifactPath = execFileSync(
    'node',
    [businessUiPackCliPath, 'pack'],
    {
      cwd,
      encoding: 'utf8',
      env: isolatedEnv
    }
  ).trim();

  const extractionRoot = fs.mkdtempSync(path.join(os.tmpdir(), `${tempPrefix}-extract-`));
  const artifactSnapshotPath = path.join(extractionRoot, path.basename(packedArtifactPath));
  fs.copyFileSync(packedArtifactPath, artifactSnapshotPath);

  return {
    packedArtifactPath,
    artifactSnapshotPath,
    extractionRoot
  };
}

export function packAndExtractBusinessUi(
  tempPrefix = 'business-ui-packed-artifact',
  options = {}
) {
  const { artifactSnapshotPath, extractionRoot } = packBusinessUiArtifact({
    tempPrefix,
    ...options
  });
  execFileSync('tar', ['-xzf', artifactSnapshotPath, '-C', extractionRoot], {
    cwd: businessUiPackageRoot,
    encoding: 'utf8'
  });

  const manifestPath = path.join(extractionRoot, 'nezam.package.json');
  const manifest = readPackedBusinessUiPackage(manifestPath);

  return {
    extractionRoot,
    artifactSnapshotPath,
    manifestPath,
    manifest
  };
}

export function preparePackedBusinessUiBoundary(tempPrefix, messagePrefix, options = {}) {
  const { extractionRoot, artifactSnapshotPath, manifestPath, manifest } =
    packAndExtractBusinessUi(tempPrefix, options);
  const runtimeFunctionsSource = prepareUiConsumerBoundary(
    manifestPath,
    manifest,
    messagePrefix
  );
  return {
    extractionRoot,
    artifactSnapshotPath,
    manifestPath,
    manifest,
    runtimeFunctionsSource
  };
}
