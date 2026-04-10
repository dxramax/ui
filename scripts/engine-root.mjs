import fs from 'node:fs';
import path from 'node:path';

export const uiRepoRoot = path.resolve(import.meta.dirname, '..');

function resolveConfiguredPath(value, fallbackPath) {
  if (typeof value === 'string' && value.trim().length > 0) {
    return path.resolve(value);
  }
  return fallbackPath;
}

function requireDirectory(directoryPath, label) {
  if (!fs.existsSync(directoryPath) || !fs.statSync(directoryPath).isDirectory()) {
    throw new Error(`${label} directory does not exist: ${directoryPath}`);
  }
  return directoryPath;
}

function requireFile(filePath, label) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    throw new Error(`${label} file does not exist: ${filePath}`);
  }
  return filePath;
}

export function resolveEngineRepoRoot() {
  return requireDirectory(
    resolveConfiguredPath(process.env.ENGINE_REPO_ROOT, path.resolve(uiRepoRoot, '../engine')),
    'ENGINE_REPO_ROOT'
  );
}

export function resolveEnginePackageManagerCli() {
  return requireFile(
    path.join(resolveEngineRepoRoot(), 'packages/package-manager/src/cli.js'),
    'engine package-manager CLI'
  );
}

export function resolveEngineBusinessSourceRoot() {
  return requireDirectory(
    path.join(resolveEngineRepoRoot(), 'packages/business/src'),
    'engine business source root'
  );
}
