import assert from 'node:assert/strict';

export const expectedRuntimeUiHttpRoutes = [
  {
    method: 'GET',
    path: '/ui/apps/{app_id}',
    handler: 'runtime_ui_http_get_app'
  },
  {
    method: 'GET',
    path: '/ui/app-info/{app_name}',
    handler: 'runtime_ui_http_get_app_info'
  },
  {
    method: 'GET',
    path: '/ui/catalog',
    handler: 'runtime_ui_http_get_catalog'
  },
  {
    method: 'POST',
    path: '/ui/apply',
    handler: 'runtime_ui_http_apply'
  },
  {
    method: 'POST',
    path: '/ui/session/open',
    handler: 'runtime_ui_http_session_open'
  },
  {
    method: 'POST',
    path: '/ui/session/resume',
    handler: 'runtime_ui_http_session_resume'
  },
  {
    method: 'POST',
    path: '/ui/session/sync',
    handler: 'runtime_ui_http_session_sync'
  },
  {
    method: 'POST',
    path: '/ui/session/close',
    handler: 'runtime_ui_http_session_close'
  },
  {
    method: 'POST',
    path: '/ui/events/fire',
    handler: 'runtime_ui_http_fire_event'
  },
  {
    method: 'POST',
    path: '/ui/export',
    handler: 'runtime_ui_http_export'
  },
  {
    method: 'POST',
    path: '/ui/forms/open',
    handler: 'runtime_ui_http_open_form'
  },
  {
    method: 'POST',
    path: '/ui/lookup',
    handler: 'runtime_ui_http_lookup'
  }
];

export const expectedErpRuntimeUiBoundaryRoutes = [
  {
    method: 'GET',
    path: '/ui/catalog',
    handler: 'runtime_ui_http_get_catalog'
  },
  {
    method: 'GET',
    path: '/ui/app-info/{app_name}',
    handler: 'runtime_ui_http_get_app_info'
  },
  {
    method: 'POST',
    path: '/ui/forms/open',
    handler: 'runtime_ui_http_open_form'
  }
];

export function runtimeUiRoutePattern(path, handler, method) {
  const escapedPath = path
    .replaceAll('/', '\\/')
    .replaceAll('{', '\\{')
    .replaceAll('}', '\\}');
  return new RegExp(
    `@http\\(method: ${method}, path: "${escapedPath}"\\)\\s*public function ${handler}`
  );
}

export function assertRuntimeUiRoutesPresent(source, routes) {
  for (const route of routes) {
    assert.match(source, runtimeUiRoutePattern(route.path, route.handler, route.method));
  }
}
