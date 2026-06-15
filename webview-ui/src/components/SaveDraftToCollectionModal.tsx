import { ChevronDown, ChevronRight, Folder } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { getFolderChildren, getRootFolderRefs } from '../lib/collectionTree';
import type { Collection, TreeDocument } from '../types';
import { cn } from '../lib/utils';

interface SaveDraftToCollectionModalProps {
  collections: Collection[];
  draftName: string;
  onConfirm: (collectionId: string, parentFolderId: string | null) => void;
  onCancel: () => void;
}

function resolveTree(collection: Collection | undefined): TreeDocument {
  return collection?.tree ?? { root: [], nodes: {} };
}

function allFolderIds(tree: TreeDocument): string[] {
  return Object.keys(tree.nodes);
}

export function SaveDraftToCollectionModal({
  collections,
  draftName,
  onConfirm,
  onCancel,
}: SaveDraftToCollectionModalProps) {
  const userCollections = useMemo(
    () => collections.filter((c) => c.type === 'user'),
    [collections]
  );
  const [collectionId, setCollectionId] = useState(userCollections[0]?.id ?? '');
  const [parentFolderId, setParentFolderId] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => new Set());

  const selectedCollection = userCollections.find((c) => c.id === collectionId);
  const tree = resolveTree(selectedCollection);
  const folderIdsKey = allFolderIds(tree).sort().join('\0');

  useEffect(() => {
    setParentFolderId(null);
    setExpandedFolders(new Set(allFolderIds(tree)));
  }, [collectionId, folderIdsKey]);

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((current) => {
      const next = new Set(current);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const renderFolder = (folderId: string, depth: number) => {
    const folder = tree.nodes[folderId];
    if (!folder) {
      return null;
    }
    const isOpen = expandedFolders.has(folderId);
    const isSelected = parentFolderId === folderId;
    const childFolders = getFolderChildren(tree, folderId);

    return (
      <div key={folderId}>
        <button
          type="button"
          onClick={() => setParentFolderId(folderId)}
          className={cn(
            'w-full flex items-center gap-1 py-1 text-sm text-left hover:bg-accent min-w-0',
            isSelected && 'bg-accent'
          )}
          style={{ paddingLeft: `${depth * 14 + 8}px` }}
        >
          {childFolders.length > 0 ? (
            <span
              role="presentation"
              className="p-0.5 rounded hover:bg-background shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                toggleFolder(folderId);
              }}
            >
              {isOpen ? (
                <ChevronDown className="w-3 h-3 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-3 h-3 text-muted-foreground" />
              )}
            </span>
          ) : (
            <span className="w-4 shrink-0" />
          )}
          <Folder className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <span className="truncate">{folder.name}</span>
        </button>
        {isOpen &&
          childFolders.map((ref) => renderFolder(ref.id, depth + 1))}
      </div>
    );
  };

  const rootFolders = getRootFolderRefs(tree);
  const hasFolders = allFolderIds(tree).length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded border border-border bg-card shadow-lg text-sm">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="font-semibold">Save to Collection</h2>
          <p className="text-xs text-muted-foreground mt-1 truncate">
            Save &quot;{draftName}&quot; as a request definition. The draft stays available.
          </p>
        </div>
        <div className="p-4 space-y-3">
          {userCollections.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Create a user collection first to save this draft.
            </p>
          ) : (
            <>
              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">Collection</span>
                <select
                  value={collectionId}
                  onChange={(e) => setCollectionId(e.target.value)}
                  className="w-full text-sm bg-background border border-border rounded px-2 py-1"
                >
                  {userCollections.map((col) => (
                    <option key={col.id} value={col.id}>
                      {col.name}
                    </option>
                  ))}
                </select>
              </label>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Folder (optional)</div>
                <button
                  type="button"
                  onClick={() => setParentFolderId(null)}
                  className={cn(
                    'w-full text-left px-2 py-1 rounded text-sm hover:bg-accent',
                    parentFolderId === null && 'bg-accent'
                  )}
                >
                  Collection root
                </button>
                <div className="max-h-56 min-h-[80px] overflow-y-auto border border-border rounded mt-1">
                  {rootFolders.map((ref) => renderFolder(ref.id, 0))}
                  {!hasFolders && (
                    <p className="px-2 py-2 text-xs text-muted-foreground">No folders yet</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-border">
          <button
            type="button"
            onClick={onCancel}
            className="text-xs px-3 py-1.5 rounded border border-border hover:bg-accent"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!collectionId}
            onClick={() => onConfirm(collectionId, parentFolderId)}
            className="text-xs px-3 py-1.5 rounded bg-primary text-background disabled:opacity-50"
          >
            Save Request
          </button>
        </div>
      </div>
    </div>
  );
}
