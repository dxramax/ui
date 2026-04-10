import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { businessUiPackageRoot } from './source-package-helper.mjs';

const businessUiPublishCliPath = path.resolve(
  businessUiPackageRoot,
  'scripts/nzm.mjs'
);

function withoutPublishTokenEnv(env) {
  const nextEnv = { ...env };
  delete nextEnv.NEZAM_PUBLISH_TOKEN;
  delete nextEnv.NEZAM_PUBLISH_TOKEN_FILE;
  return nextEnv;
}

export function createBusinessUiNoAuthPublishContext(tempPrefix) {
  const isolatedHome = fs.mkdtempSync(path.join(os.tmpdir(), `${tempPrefix}-`));
  const isolatedConfigHome = path.join(isolatedHome, '.config');
  const isolatedDiscoveryPath = path.join(isolatedHome, 'missing-publish-token');
  const env = withoutPublishTokenEnv({
    ...process.env,
    HOME: isolatedHome,
    XDG_CONFIG_HOME: isolatedConfigHome,
    NEZAM_PUBLISH_TOKEN_DISCOVERY_FILE: isolatedDiscoveryPath
  });

  return {
    isolatedHome,
    isolatedConfigHome,
    isolatedDiscoveryPath,
    env
  };
}

export function runBusinessUiNoAuthPublish({
  tempPrefix,
  cwd = businessUiPackageRoot,
  cliPath = businessUiPublishCliPath
} = {}) {
  const context = createBusinessUiNoAuthPublishContext(
    tempPrefix || 'business-ui-no-auth-publish'
  );
  const result = spawnSync(
    'node',
    [cliPath, 'publish', '--json', 'true'],
    {
      cwd,
      encoding: 'utf8',
      env: context.env
    }
  );

  return {
    ...context,
    cwd,
    cliPath,
    result,
    output: `${result.stdout || ''}${result.stderr || ''}`,
    publishHistoryPath: path.join(
      context.isolatedConfigHome,
      'nezam',
      'publish-history'
    )
  };
}
