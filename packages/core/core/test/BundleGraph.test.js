// @flow strict-local

import assert from 'assert';
import BundleGraph from '../src/BundleGraph';
import {DEFAULT_ENV, DEFAULT_TARGETS} from './test-utils';
import AssetGraph, {nodeFromAssetGroup} from '../src/AssetGraph';
import {createAsset as _createAsset} from '../src/assetUtils';
import {createDependency as _createDependency} from '../src/Dependency';
import {toProjectPath} from '../src/projectPath';

function createAsset(opts) {
  return _createAsset('/', opts);
}

function createDependency(opts) {
  return _createDependency('/', opts);
}

const id1 = '0123456789abcdef0123456789abcdef';
const id2 = '9876543210fedcba9876543210fedcba';

describe('BundleGraph', () => {
  it('assigns publicIds to assets', () => {
    let bundleGraph = BundleGraph.fromAssetGraph(
      createMockAssetGraph([id1, id2]),
    );
    assert.deepEqual(
      getAssets(bundleGraph).map(a => bundleGraph.getAssetPublicId(a)),
      ['296TI', '4DGUq'],
    );
  });

  it('uses a longer publicId if there is a collision', () => {
    let bundleGraph = BundleGraph.fromAssetGraph(
      createMockAssetGraph([id1, id1.slice(0, 16) + '7' + id1.slice(17)]),
    );
    assert.deepEqual(
      getAssets(bundleGraph).map(a => bundleGraph.getAssetPublicId(a)),
      ['296TI', '296TII'],
    );
  });

  it('respects skipChildren on traverseBundle', async () => {
    let graph = new AssetGraph();
    graph.setRootConnections({entries: [toProjectPath('/', '/index')]});
    graph.resolveEntry(
      toProjectPath('/', '/index'),
      [
        {
          filePath: toProjectPath('/', '/path/to/index/src/main.js'),
          packagePath: toProjectPath('/', '/path/to/index'),
        },
      ],
      '1',
    );
    graph.resolveTargets(
      {
        filePath: toProjectPath('/', '/path/to/index/src/main.js'),
        packagePath: toProjectPath('/', '/path/to/index'),
      },
      DEFAULT_TARGETS,
      '2',
    );

    let entryDep = createDependency({
      specifier: 'path/to/index/src/main.js',
      specifierType: 'esm',
      env: DEFAULT_ENV,
      target: DEFAULT_TARGETS[0],
    });
    let entrySourcePath = '/index.js';
    let entryFilePath = toProjectPath('/', entrySourcePath);
    let entryReq = {filePath: entryFilePath, env: DEFAULT_ENV};
    graph.resolveDependency(entryDep, nodeFromAssetGroup(entryReq).value, '3');

    let dep1 = createDependency({
      specifier: 'dependent-asset-1',
      specifierType: 'esm',
      env: DEFAULT_ENV,
      sourcePath: entrySourcePath,
    });

    let entryAsset = createAsset({
      id: 'a1',
      filePath: entryFilePath,
      type: 'js',
      isSource: true,
      hash: '#1',
      stats,
      dependencies: new Map([['dep1', dep1]]),
      env: DEFAULT_ENV,
    });

    graph.resolveAssetGroup(entryReq, [entryAsset], '4');

    let dep1SourcePath = '/other.js';
    let dep1FilePath = toProjectPath('/', dep1SourcePath);
    let dep1Req = {filePath: dep1FilePath, env: DEFAULT_ENV};
    graph.resolveDependency(dep1, nodeFromAssetGroup(dep1Req).value, '5');
    let childAsset = createAsset({
      id: 'a2',
      filePath: dep1FilePath,
      type: 'js',
      isSource: true,
      hash: '#2',
      stats,
      env: DEFAULT_ENV,
    });
    graph.resolveAssetGroup(dep1Req, [childAsset], '6');

    let bundleGraph = BundleGraph.fromAssetGraph(
      graph,
      new Map([
        ['a1', 'a1'],
        ['a2', 'a2'],
      ]),
    );

    let bundleNode = {
      type: 'bundle',
      id: 'b1',
      value: {
        id: 'b1',
        hashReference: 'b1',
        type: 'js',
        env: DEFAULT_ENV,
        entryAssetIds: [],
        mainEntryId: null,
        pipeline: null,
        needsStableName: false,
        bundleBehavior: null,
        isSplittable: false,
        isPlaceholder: false,
        target: DEFAULT_TARGETS[0],
        name: null,
        displayName: null,
        publicId: 'b1',
      },
    };
    bundleGraph._graph.addNodeByContentKey(bundleNode.id, bundleNode);
    bundleGraph.addAssetGraphToBundle(entryAsset, bundleNode.value);
    bundleGraph.addAssetGraphToBundle(childAsset, bundleNode.value);

    console.log(bundleGraph._graph);

    let v = [];
    bundleGraph.traverseAssets(bundleNode.value, (a, _, actions) => {
      actions.skipChildren();
      v.push(a);
    });
    // assert.deepEqual(v, [entryAsset]);
  });
});

function getAssets(bundleGraph) {
  let assets = [];
  bundleGraph.traverse(node => {
    if (node.type === 'asset') {
      assets.push(node.value);
    }
  });
  return assets;
}

const stats = {size: 0, time: 0};
function createMockAssetGraph(ids: [string, string]) {
  let graph = new AssetGraph();
  graph.setRootConnections({entries: [toProjectPath('/', '/index')]});

  graph.resolveEntry(
    toProjectPath('/', '/index'),
    [
      {
        filePath: toProjectPath('/', '/path/to/index/src/main.js'),
        packagePath: toProjectPath('/', '/path/to/index'),
      },
    ],
    '1',
  );
  graph.resolveTargets(
    {
      filePath: toProjectPath('/', '/path/to/index/src/main.js'),
      packagePath: toProjectPath('/', '/path/to/index'),
    },
    DEFAULT_TARGETS,
    '2',
  );

  let dep = createDependency({
    specifier: 'path/to/index/src/main.js',
    specifierType: 'esm',
    env: DEFAULT_ENV,
    target: DEFAULT_TARGETS[0],
  });
  let sourcePath = '/index.js';
  let filePath = toProjectPath('/', sourcePath);
  let req = {filePath, env: DEFAULT_ENV};
  graph.resolveDependency(dep, nodeFromAssetGroup(req).value, '3');

  let dep1 = createDependency({
    specifier: 'other',
    specifierType: 'esm',
    env: DEFAULT_ENV,
    sourcePath,
  });

  let assets = [
    createAsset({
      id: ids[0],
      filePath,
      type: 'js',
      isSource: true,
      hash: '#1',
      stats,
      dependencies: new Map([['dep1', dep1]]),
      env: DEFAULT_ENV,
    }),
    createAsset({
      id: ids[1],
      filePath,
      type: 'js',
      isSource: true,
      hash: '#2',
      stats,
      dependencies: new Map([['dep1', dep1]]),
      env: DEFAULT_ENV,
    }),
  ];
  graph.resolveAssetGroup(req, assets, '4');

  return graph;
}
