import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  apiscopeExists,
  ensureApiscopeForCollections,
  getApiscopeDir,
  loadAllCollections,
  loadConfig,
  nextUserCollectionId,
  saveCollection,
} from '../src/storage/ApiScopeStorage';
import { createEmptyUserCollection } from '../src/collections/ScanMerger';
import { listDrafts } from '../src/storage/DraftStorage';
import { listHistorySummaries } from '../src/storage/HistoryService';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

function main() {
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'apiscope-lazy-'));
  try {
    assert(!apiscopeExists(workspaceRoot), 'New workspace should not have .apiscope');
    assert(loadConfig(workspaceRoot).version === 2, 'loadConfig should return defaults without creating files');
    assert(!apiscopeExists(workspaceRoot), 'loadConfig must not create .apiscope');
    assert(loadAllCollections(workspaceRoot).length === 0, 'loadAllCollections should be empty');
    assert(!apiscopeExists(workspaceRoot), 'loadAllCollections must not create .apiscope');
    assert(listDrafts(workspaceRoot).length === 0, 'listDrafts should be empty');
    assert(!apiscopeExists(workspaceRoot), 'listDrafts must not create .apiscope');
  assert(listHistorySummaries(workspaceRoot).length === 0, 'listHistorySummaries should be empty');
  assert(!apiscopeExists(workspaceRoot), 'listHistorySummaries must not create .apiscope');

  ensureApiscopeForCollections(workspaceRoot);
  assert(listHistorySummaries(workspaceRoot).length === 0, 'history should be empty without recursion');

    ensureApiscopeForCollections(workspaceRoot);
    assert(apiscopeExists(workspaceRoot), 'Collections init should create .apiscope');
    assert(fs.existsSync(path.join(getApiscopeDir(workspaceRoot), 'collections')), 'collections/ should exist');

    const collection = createEmptyUserCollection([], nextUserCollectionId(workspaceRoot));
    saveCollection(workspaceRoot, collection);
    assert(loadAllCollections(workspaceRoot).length === 1, 'Saved collection should load back');

    console.log('OK');
  } finally {
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  }
}

main();
