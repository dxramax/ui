import fs from 'node:fs';
import path from 'node:path';

export function collectNamedMatches(source, expression) {
  return Array.from(source.matchAll(expression), (match) => match[1]).sort();
}

export function collectMessageDefinitions(source) {
  return Array.from(
    source.matchAll(
      /message (runtime_ui_[A-Za-z0-9_]+) \{[\s\S]*?code: "(BUI-UI-[0-9]{4})";/g
    ),
    (match) => ({
      name: match[1],
      code: match[2]
    })
  );
}

export function collectRuntimeUiHttpRoutes(source) {
  return Array.from(
    source.matchAll(
      /@http\(method: (GET|POST), path: "([^"]+)"\)\s*public function (runtime_ui_http_[A-Za-z0-9_]+)/g
    ),
    (match) => ({
      method: match[1],
      path: match[2],
      handler: match[3]
    })
  ).sort((left, right) => {
    const leftKey = `${left.method} ${left.path} ${left.handler}`;
    const rightKey = `${right.method} ${right.path} ${right.handler}`;
    return leftKey.localeCompare(rightKey);
  });
}

export function listPackageFiles(root, current = root) {
  const entries = fs.readdirSync(current, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name === '.git' || entry.name === '.nezam') {
      continue;
    }
    const fullPath = path.join(current, entry.name);
    if (entry.isDirectory()) {
      files.push(...listPackageFiles(root, fullPath));
      continue;
    }
    files.push(path.relative(root, fullPath).replaceAll(path.sep, '/'));
  }

  return files.sort();
}

export function listPackageBlFiles(root) {
  return listPackageFiles(root).filter((file) => file.endsWith('.bl'));
}
