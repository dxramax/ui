import assert from 'node:assert/strict';
import {
  assertRuntimeUiRoutesPresent,
  expectedErpRuntimeUiBoundaryRoutes,
  expectedRuntimeUiHttpRoutes
} from './route-contract-helper.mjs';

export const expectedUiWidgetRuntimePaths = {
  detail: '/__meta/apps/',
  openForm: '/ui/session/open',
  sync: '/ui/session/sync',
  event: '/ui/events/fire',
  lookup: '/ui/lookup',
  export: '/ui/export'
};

export const expectedErpRuntimeUiPaths = {
  catalog: '/ui/catalog',
  appDetail: '/ui/app-info/{app_name}',
  openForm: '/ui/forms/open',
  encodedAppDetailExample: '/ui/app-info/app%2F42'
};

export function collectUiWidgetRuntimePaths({
  detailPath,
  openFormPath,
  syncPath,
  eventPath,
  lookupPath,
  exportPath
}) {
  return {
    detail: detailPath,
    openForm: openFormPath,
    sync: syncPath,
    event: eventPath,
    lookup: lookupPath,
    export: exportPath
  };
}

export function collectErpRuntimeUiPaths({
  catalogPath,
  appDetailPath,
  openFormPath,
  encodedAppDetailExample
}) {
  return {
    catalog: catalogPath,
    appDetail: appDetailPath,
    openForm: openFormPath,
    encodedAppDetailExample
  };
}

export function assertUiWidgetRuntimePathContract(paths) {
  assert.deepEqual(paths, expectedUiWidgetRuntimePaths);
}

export function assertErpRuntimeUiPathContract(paths) {
  assert.deepEqual(paths, expectedErpRuntimeUiPaths);
}

export function assertUiWidgetRuntimePathConstants(constants) {
  assertUiWidgetRuntimePathContract(collectUiWidgetRuntimePaths(constants));
}

export function assertErpRuntimeUiPathConstants(constants) {
  assertErpRuntimeUiPathContract(collectErpRuntimeUiPaths(constants));
}

export function assertErpRuntimeUiPathHelpers({
  catalogPath,
  appDetailPath,
  openFormPath,
  buildCatalogPath,
  buildAppDetailPath,
  sampleAppId = 'app/42'
}) {
  assertErpRuntimeUiPathConstants({
    catalogPath,
    appDetailPath,
    openFormPath,
    encodedAppDetailExample: buildAppDetailPath(sampleAppId)
  });
  assert.equal(buildCatalogPath(), catalogPath);
}

export function assertUiWidgetRuntimeBoundary({ runtimeFunctionsSource, ...constants }) {
  assertRuntimeUiRoutesPresent(runtimeFunctionsSource, expectedRuntimeUiHttpRoutes);
  assertUiWidgetRuntimePathConstants(constants);
}

export function assertErpRuntimeUiBoundary({ runtimeFunctionsSource, ...constants }) {
  assertRuntimeUiRoutesPresent(runtimeFunctionsSource, expectedErpRuntimeUiBoundaryRoutes);
  assertErpRuntimeUiPathConstants(constants);
}
