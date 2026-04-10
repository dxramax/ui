export const expectedUiRepository = {
  type: 'git',
  url: 'https://github.com/dxramax/ui.git'
};

export const expectedUiReadme = {
  path: 'README.md',
  mediaType: 'text/markdown'
};

export const expectedUiArtifacts = [
  {
    id: 'source',
    kind: 'source-tarball',
    required: true,
    public: true,
    description: 'Published source tarball for the business UI package.'
  },
  {
    id: 'generated-c',
    kind: 'generated-c',
    target: 'generated-c',
    required: true,
    public: true,
    description: 'Published precompiled generated-C UI runtime package.'
  }
];

export const expectedUiExports = {
  './object-guard/functions': {
    kind: 'bl-module',
    path: 'src/system/object_guard/object_guard.functions.bl'
  },
  './object-guard/classes': {
    kind: 'bl-module',
    path: 'src/system/object_guard/object_guard.classes.bl'
  },
  './object-guard/tables': {
    kind: 'bl-module',
    path: 'src/system/object_guard/object_guard.tables.bl'
  },
  './runtime-object/functions': {
    kind: 'bl-module',
    path: 'src/system/runtime_object/runtime_object.functions.bl'
  },
  './runtime-object/types': {
    kind: 'bl-module',
    path: 'src/system/runtime_object/runtime_object.types.bl'
  },
  './runtime': {
    kind: 'bl-module',
    path: 'src/system/ui/runtime.bl'
  },
  './runtime/functions': {
    kind: 'bl-module',
    path: 'src/system/ui/runtime_ui.functions.bl'
  },
  './runtime/types': {
    kind: 'bl-module',
    path: 'src/system/ui/runtime_ui.types.bl'
  },
  './runtime/messages': {
    kind: 'bl-module',
    path: 'src/system/ui/runtime_ui.messages.bl'
  },
  './runtime/session': {
    kind: 'bl-module',
    path: 'src/system/ui/runtime_ui_session.functions.bl'
  },
  './runtime/tables': {
    kind: 'bl-module',
    path: 'src/system/ui/runtime_ui.tables.bl'
  },
  './runtime/dispatch': {
    kind: 'bl-module',
    path: 'src/system/ui/runtime_ui_dispatch.functions.bl'
  },
  './readme': {
    kind: 'readme',
    path: 'README.md'
  }
};

export const expectedUiManifestContract = {
  schemaVersion: '1',
  name: 'ui',
  version: '0.1.2',
  packageKind: 'source-only',
  bl: {
    entry: 'src/system/ui/runtime_ui.functions.bl'
  },
  repository: expectedUiRepository,
  readme: expectedUiReadme,
  build: {
    targets: [
      {
        id: 'generated-c',
        kind: 'generated-c',
        languageStandard: 'c11'
      }
    ]
  },
  artifacts: expectedUiArtifacts,
  exports: expectedUiExports
};

export const expectedUiPackageMetadata = {
  description: 'Shared business UI runtime BL source package.',
  license: 'MIT',
  keywords: ['bl', 'business', 'ui'],
  authors: [
    {
      name: 'Nezam Engine Team',
      roles: ['maintainer']
    }
  ]
};

export const expectedUiExportKeys = Object.keys(expectedUiExports);
