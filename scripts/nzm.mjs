import { spawnSync } from 'node:child_process';
import { resolveEnginePackageManagerCli } from './engine-root.mjs';

let cliPath;
try {
  cliPath = resolveEnginePackageManagerCli();
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  [cliPath, ...process.argv.slice(2)],
  {
    stdio: 'inherit',
    env: process.env
  }
);

if (result.error) {
  process.stderr.write(`${result.error.message}\n`);
  process.exit(1);
}

process.exit(result.status ?? 1);
