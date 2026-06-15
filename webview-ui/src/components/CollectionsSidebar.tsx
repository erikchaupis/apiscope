import {
  ChevronDown,
  ChevronRight,
  Code2,
  Folder,
  FolderOpen,
  GripVertical,
  MoreHorizontal,
  PanelLeftClose,
  Plus,
  Upload,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { Collection, CollectionRequest, TreeRef } from '../types';
import {
  buildRequestMap,
  countCollectionRequests,
  countRequestsInFolder,
  countSubfoldersInFolder,
  findFolderIdsForRequest,
  findFolderParentId,
  findRequestParentId,
  hasScannedSource,
  isFolderAncestor,
  nextAvailableCollectionName,
  nextAvailableFolderName,
  requestLabel,
  validateCollectionName,
  validateFolderName,
  validateRequestName,
} from '../lib/collectionTree';
import { resolveCollectionRequestDisplayName } from '../lib/requestDisplayName';
import { cn, methodClass } from '../lib/utils';
import { ContextMenu, type ContextMenuItem } from './ContextMenu';
import { DeleteFolderModal } from './DeleteFolderModal';

export interface RevealRequestTarget {
  requestId: string;
  collectionId: string;
  controllerName?: string;
}

interface CollectionsSidebarProps {
  collections: Collection[];
  selectedCollectionId: string | null;
  selectedRequestId: string | null;
  revealRequest: RevealRequestTarget | null;
  collapsed: boolean;
  savedExpandedCollectionIds?: string[];
  savedExpandedFolderIds?: string[];
  onCollapsedChange: (collapsed: boolean) => void;
  onExpandedStateChange: (collectionIds: string[], folderIds: string[]) => void;
  onSelectCollection: (collectionId: string) => void;
  onSelectRequest: (requestId: string) => void;
  onOpenSource: (requestId: string) => void;
  onRescan: () => void;
  onCreateCollection: (name: string) => void;
  onImportCollection: () => void;
  onExportCollection: (collectionId: string) => void;
  onDuplicateCollection: (collectionId: string) => void;
  onDeleteCollection: (collectionId: string) => void;
  onRenameCollection: (collectionId: string, name: string) => void;
  onCreateFolder: (collectionId: string, parentFolderId: string | null, name: string) => void;
  onCreateRequest: (collectionId: string, parentFolderId: string | null, name: string) => void;
  onRenameFolder: (collectionId: string, folderId: string, name: string) => void;
  onDeleteFolder: (collectionId: string, folderId: string) => void;
  onMoveTreeNode: (
    collectionId: string,
    nodeId: string,
    nodeType: 'folder' | 'request',
    targetFolderId: string | null,
    insertBeforeId?: string
  ) => void;
  onRenameRequest: (collectionId: string, requestId: string, name: string) => void;
  onDuplicateRequest: (collectionId: string, requestId: string) => void;
  onDeleteRequest: (collectionId: string, requestId: string) => void;
}

type DragPayload = {
  collectionId: string;
  nodeId: string;
  nodeType: 'folder' | 'request';
};

const END_DROP = '__end__';

type DropTarget = {
  collectionId: string;
  folderId: string | null;
  insertBeforeId?: string;
  endOfList?: boolean;
};

type InlineRename =
  | { kind: 'collection'; collectionId: string; value: string }
  | { kind: 'folder'; collectionId: string; folderId: string; value: string }
  | { kind: 'request'; collectionId: string; requestId: string; value: string };

type PendingFolderCreate = {
  collectionId: string;
  parentFolderId: string | null;
  value: string;
  pristine: boolean;
  error?: string;
};

type PendingCollectionCreate = {
  value: string;
  pristine: boolean;
  error?: string;
};

type PendingRequestCreate = {
  collectionId: string;
  parentFolderId: string | null;
  value: string;
  pristine: boolean;
  error?: string;
};

type ContextTarget =
  | { kind: 'collection'; collectionId: string; x: number; y: number }
  | { kind: 'folder'; collectionId: string; folderId: string; x: number; y: number }
  | { kind: 'request'; collectionId: string; requestId: string; x: number; y: number };

const INDENT = 12;
const TREE_ROW_BASE =
  'group relative flex items-center h-[22px] min-h-[22px] text-xs leading-tight';
const TREE_ROW_CLASS = `${TREE_ROW_BASE} cursor-grab active:cursor-grabbing`;
const CHEVRON_CLASS = 'w-3.5 h-3.5 shrink-0 text-muted-foreground';
const ICON_CLASS = 'w-3.5 h-3.5 shrink-0';

function treePadding(depth: number): CSSProperties {
  return { paddingLeft: depth * INDENT + 4 };
}

function buildInitialExpandedCollections(
  collections: Collection[],
  saved?: string[]
): Set<string> {
  const ids = new Set(collections.map((c) => c.id));
  if (saved?.length) {
    return new Set(saved.filter((id) => ids.has(id)));
  }
  return ids;
}

function buildInitialExpandedFolders(collections: Collection[], saved?: string[]): Set<string> {
  const valid = new Set<string>();
  for (const col of collections) {
    for (const id of Object.keys(col.tree?.nodes ?? {})) {
      valid.add(`${col.id}:${id}`);
    }
  }
  if (saved?.length) {
    return new Set(saved.filter((key) => valid.has(key)));
  }
  const auto = collections.find((c) => c.type === 'generated');
  if (!auto?.tree) {
    return new Set();
  }
  return new Set(
    auto.tree.root
      .filter((r) => r.type === 'folder')
      .map((r) => `${auto.id}:${r.id}`)
  );
}

function folderKey(collectionId: string, folderId: string): string {
  return `${collectionId}:${folderId}`;
}

export function CollectionsSidebar({
  collections,
  selectedCollectionId,
  selectedRequestId,
  revealRequest,
  collapsed,
  savedExpandedCollectionIds,
  savedExpandedFolderIds,
  onCollapsedChange,
  onExpandedStateChange,
  onSelectCollection,
  onSelectRequest,
  onOpenSource,
  onRescan,
  onCreateCollection,
  onImportCollection,
  onExportCollection,
  onDuplicateCollection,
  onDeleteCollection,
  onRenameCollection,
  onCreateFolder,
  onCreateRequest,
  onRenameFolder,
  onDeleteFolder,
  onMoveTreeNode,
  onRenameRequest,
  onDuplicateRequest,
  onDeleteRequest,
}: CollectionsSidebarProps) {
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(() =>
    buildInitialExpandedCollections(collections, savedExpandedCollectionIds)
  );
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() =>
    buildInitialExpandedFolders(collections, savedExpandedFolderIds)
  );
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextTarget | null>(null);
  const [menuCollectionId, setMenuCollectionId] = useState<string | null>(null);
  const [menuFolderKey, setMenuFolderKey] = useState<string | null>(null);
  const [menuRequestId, setMenuRequestId] = useState<string | null>(null);
  const [inlineRename, setInlineRename] = useState<InlineRename | null>(null);
  const [pendingFolderCreate, setPendingFolderCreate] = useState<PendingFolderCreate | null>(null);
  const [pendingCollectionCreate, setPendingCollectionCreate] =
    useState<PendingCollectionCreate | null>(null);
  const [pendingRequestCreate, setPendingRequestCreate] = useState<PendingRequestCreate | null>(
    null
  );
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<{
    collectionId: string;
    folderId: string;
    folderName: string;
    requestCount: number;
    subfolderCount: number;
  } | null>(null);
  const [dragPayload, setDragPayload] = useState<DragPayload | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const dropTargetRef = useRef<DropTarget | null>(null);
  const skipPersistRef = useRef(true);
  const persistTimerRef = useRef<number>();
  const prevCollectionIdsRef = useRef<string[] | null>(null);
  const initialSavedCollectionsRef = useRef(savedExpandedCollectionIds);
  const initialSavedFoldersRef = useRef(savedExpandedFolderIds);

  useEffect(() => {
    const ids = collections.map((c) => c.id);
    if (ids.length === 0) {
      return;
    }

    if (prevCollectionIdsRef.current === null) {
      prevCollectionIdsRef.current = ids;
      setExpandedCollections(
        buildInitialExpandedCollections(collections, initialSavedCollectionsRef.current)
      );
      setExpandedFolders(
        buildInitialExpandedFolders(collections, initialSavedFoldersRef.current)
      );
      return;
    }

    const prevIds = new Set(prevCollectionIdsRef.current);
    const newIds = ids.filter((id) => !prevIds.has(id));
    const removedIds = prevCollectionIdsRef.current.filter((id) => !ids.includes(id));
    prevCollectionIdsRef.current = ids;

    if (newIds.length === 0 && removedIds.length === 0) {
      return;
    }

    setExpandedCollections((prev) => {
      const next = new Set(prev);
      for (const id of removedIds) {
        next.delete(id);
      }
      for (const id of newIds) {
        next.add(id);
      }
      return next;
    });
  }, [collections]);

  useEffect(() => {
    if (skipPersistRef.current) {
      skipPersistRef.current = false;
      return;
    }
    window.clearTimeout(persistTimerRef.current);
    persistTimerRef.current = window.setTimeout(() => {
      onExpandedStateChange([...expandedCollections], [...expandedFolders]);
    }, 200);
    return () => window.clearTimeout(persistTimerRef.current);
  }, [expandedCollections, expandedFolders, onExpandedStateChange]);

  useEffect(() => {
    if (!revealRequest) {
      return;
    }
    setExpandedCollections((prev) => new Set([...prev, revealRequest.collectionId]));
    const col = collections.find((c) => c.id === revealRequest.collectionId);
    if (col?.tree) {
      const folderIds = findFolderIdsForRequest(col.tree, revealRequest.requestId);
      setExpandedFolders((prev) => {
        const next = new Set(prev);
        for (const folderId of folderIds) {
          next.add(folderKey(revealRequest.collectionId, folderId));
        }
        return next;
      });
    }
    const timer = window.setTimeout(() => {
      document
        .querySelector(`[data-request-id="${revealRequest.requestId}"]`)
        ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, 50);
    return () => window.clearTimeout(timer);
  }, [revealRequest, collections]);

  const toggleCollection = (id: string) => {
    setExpandedCollections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleFolder = (collectionId: string, folderId: string) => {
    const key = folderKey(collectionId, folderId);
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const closeAllMenus = useCallback(() => {
    setContextMenu(null);
    setMenuCollectionId(null);
    setMenuFolderKey(null);
    setMenuRequestId(null);
  }, []);

  useEffect(() => {
    if (!menuCollectionId && !menuFolderKey && !menuRequestId) {
      return;
    }
    const onMouseDown = () => closeAllMenus();
    window.addEventListener('mousedown', onMouseDown);
    return () => window.removeEventListener('mousedown', onMouseDown);
  }, [menuCollectionId, menuFolderKey, menuRequestId, closeAllMenus]);

  const startInlineRename = useCallback((target: InlineRename) => {
    setPendingFolderCreate(null);
    setPendingCollectionCreate(null);
    setPendingRequestCreate(null);
    setInlineRename(target);
    closeAllMenus();
  }, [closeAllMenus]);

  const cancelPendingFolderCreate = useCallback(() => {
    setPendingFolderCreate(null);
  }, []);

  const cancelPendingCollectionCreate = useCallback(() => {
    setPendingCollectionCreate(null);
  }, []);

  const cancelPendingRequestCreate = useCallback(() => {
    setPendingRequestCreate(null);
  }, []);

  const startPendingCollectionCreate = useCallback(() => {
    closeAllMenus();
    setInlineRename(null);
    setPendingFolderCreate(null);
    setPendingRequestCreate(null);
    setPendingCollectionCreate({
      value: nextAvailableCollectionName(collections),
      pristine: true,
    });
  }, [collections, closeAllMenus]);

  const commitPendingCollectionCreate = useCallback(() => {
    if (!pendingCollectionCreate) {
      return;
    }
    const value = pendingCollectionCreate.value.trim();
    const error = validateCollectionName(value, collections);
    if (error) {
      setPendingCollectionCreate({ ...pendingCollectionCreate, error, pristine: false });
      return;
    }
    onCreateCollection(value);
    setPendingCollectionCreate(null);
  }, [pendingCollectionCreate, collections, onCreateCollection]);

  const startPendingFolderCreate = useCallback(
    (collectionId: string, parentFolderId: string | null) => {
      const col = collections.find((c) => c.id === collectionId);
      if (!col) {
        return;
      }
      closeAllMenus();
      setInlineRename(null);
      setPendingCollectionCreate(null);
      setPendingRequestCreate(null);
      const defaultName = nextAvailableFolderName(
        col.tree ?? { root: [], nodes: {} },
        parentFolderId
      );
      setPendingFolderCreate({
        collectionId,
        parentFolderId,
        value: defaultName,
        pristine: true,
      });
      setExpandedCollections((prev) => new Set([...prev, collectionId]));
      if (parentFolderId) {
        setExpandedFolders((prev) => new Set([...prev, folderKey(collectionId, parentFolderId)]));
      }
    },
    [collections, closeAllMenus]
  );

  const commitPendingFolderCreate = useCallback(() => {
    if (!pendingFolderCreate) {
      return;
    }
    const col = collections.find((c) => c.id === pendingFolderCreate.collectionId);
    if (!col) {
      setPendingFolderCreate(null);
      return;
    }
    const value = pendingFolderCreate.value.trim();
    const error = validateFolderName(
      col.tree ?? { root: [], nodes: {} },
      value,
      pendingFolderCreate.parentFolderId
    );
    if (error) {
      setPendingFolderCreate({ ...pendingFolderCreate, error, pristine: false });
      return;
    }
    onCreateFolder(
      pendingFolderCreate.collectionId,
      pendingFolderCreate.parentFolderId,
      value
    );
    setPendingFolderCreate(null);
  }, [pendingFolderCreate, collections, onCreateFolder]);

  const commitInlineRename = useCallback(() => {
    if (!inlineRename) {
      return;
    }
    const value = inlineRename.value.trim();
    if (inlineRename.kind === 'collection') {
      const error = validateCollectionName(value, collections, inlineRename.collectionId);
      if (error) {
        return;
      }
      onRenameCollection(inlineRename.collectionId, value);
    } else if (inlineRename.kind === 'folder') {
      const col = collections.find((c) => c.id === inlineRename.collectionId);
      if (!col) {
        return;
      }
      const parentFolderId = findFolderParentId(col.tree, inlineRename.folderId);
      const error = validateFolderName(col.tree, value, parentFolderId, inlineRename.folderId);
      if (error) {
        return;
      }
      onRenameFolder(inlineRename.collectionId, inlineRename.folderId, value);
    } else {
      if (!value) {
        return;
      }
      onRenameRequest(inlineRename.collectionId, inlineRename.requestId, value);
    }
    setInlineRename(null);
  }, [inlineRename, collections, onRenameCollection, onRenameFolder, onRenameRequest]);

  const setDropTargetLive = useCallback((target: DropTarget | null) => {
    dropTargetRef.current = target;
    setDropTarget(target);
  }, []);

  const createFolderInContext = useCallback(
    (collectionId: string, parentFolderId: string | null) => {
      startPendingFolderCreate(collectionId, parentFolderId);
    },
    [startPendingFolderCreate]
  );

  const createRequestInContext = useCallback(
    (collectionId: string, parentFolderId: string | null) => {
      const col = collections.find((c) => c.id === collectionId);
      if (!col || col.type === 'generated') {
        return;
      }
      closeAllMenus();
      setInlineRename(null);
      setPendingFolderCreate(null);
      setPendingCollectionCreate(null);
      setPendingRequestCreate({
        collectionId,
        parentFolderId,
        value: 'New Request',
        pristine: true,
      });
      setExpandedCollections((prev) => new Set([...prev, collectionId]));
      if (parentFolderId) {
        setExpandedFolders((prev) => new Set([...prev, folderKey(collectionId, parentFolderId)]));
      }
    },
    [collections, closeAllMenus]
  );

  const commitPendingRequestCreate = useCallback(() => {
    if (!pendingRequestCreate) {
      return;
    }
    const value = pendingRequestCreate.value.trim();
    const error = validateRequestName(value);
    if (error) {
      setPendingRequestCreate({ ...pendingRequestCreate, error, pristine: false });
      return;
    }
    onCreateRequest(pendingRequestCreate.collectionId, pendingRequestCreate.parentFolderId, value);
    setPendingRequestCreate(null);
  }, [pendingRequestCreate, onCreateRequest]);

  const getCollectionMenuItems = (col: Collection): ContextMenuItem[] => {
    const items: ContextMenuItem[] = [
      {
        id: 'new-folder',
        label: 'New Folder',
        onClick: () => createFolderInContext(col.id, null),
      },
      {
        id: 'export',
        label: 'Export Collection...',
        onClick: () => {
          closeAllMenus();
          onExportCollection(col.id);
        },
      },
    ];
    if (col.type !== 'generated') {
      items.push({
        id: 'new-request',
        label: 'New Request',
        onClick: () => createRequestInContext(col.id, null),
      });
    }
    if (col.type === 'generated') {
      items.push(
        {
          id: 'duplicate',
          label: 'Duplicate',
          onClick: () => {
            closeAllMenus();
            onDuplicateCollection(col.id);
          },
        },
        {
          id: 'rescan',
          label: 'Rescan',
          onClick: () => {
            closeAllMenus();
            onRescan();
          },
        }
      );
    } else {
      items.push(
        {
          id: 'rename',
          label: 'Rename',
          onClick: () =>
            startInlineRename({
              kind: 'collection',
              collectionId: col.id,
              value: col.name,
            }),
        },
        {
          id: 'duplicate',
          label: 'Duplicate',
          onClick: () => {
            closeAllMenus();
            onDuplicateCollection(col.id);
          },
        },
        {
          id: 'delete',
          label: 'Delete',
          danger: true,
          onClick: () => {
            closeAllMenus();
            onDeleteCollection(col.id);
          },
        }
      );
    }
    return items;
  };

  const getFolderMenuItems = (col: Collection, folderId: string): ContextMenuItem[] => {
    const node = col.tree.nodes[folderId];
    if (!node) {
      return [];
    }
    const stats = {
      requestCount: countRequestsInFolder(col.tree, folderId),
      subfolderCount: countSubfoldersInFolder(col.tree, folderId),
    };
    return [
      {
        id: 'new-folder',
        label: 'New Folder',
        onClick: () => createFolderInContext(col.id, folderId),
      },
      ...(col.type !== 'generated'
        ? [
            {
              id: 'new-request',
              label: 'New Request',
              onClick: () => createRequestInContext(col.id, folderId),
            } satisfies ContextMenuItem,
          ]
        : []),
      {
        id: 'rename',
        label: 'Rename',
        onClick: () =>
          startInlineRename({
            kind: 'folder',
            collectionId: col.id,
            folderId,
            value: node.name,
          }),
      },
      {
        id: 'delete',
        label: 'Delete',
        danger: true,
        onClick: () => {
          closeAllMenus();
          setDeleteFolderTarget({
            collectionId: col.id,
            folderId,
            folderName: node.name,
            requestCount: stats.requestCount,
            subfolderCount: stats.subfolderCount,
          });
        },
      },
    ];
  };

  const getRequestMenuItems = (col: Collection, req: CollectionRequest): ContextMenuItem[] => {
    const showSource = hasScannedSource(req);
    const items: ContextMenuItem[] = [];
    if (showSource) {
      items.push({
        id: 'open-source',
        label: 'Open Source',
        onClick: () => {
          closeAllMenus();
          onOpenSource(req.id);
        },
      });
    }
    items.push(
      {
        id: 'rename',
        label: 'Rename',
        onClick: () =>
          startInlineRename({
            kind: 'request',
            collectionId: col.id,
            requestId: req.id,
            value: requestLabel(req),
          }),
      },
      {
        id: 'duplicate',
        label: 'Duplicate',
        onClick: () => {
          closeAllMenus();
          onDuplicateRequest(col.id, req.id);
        },
      },
      {
        id: 'delete',
        label: 'Delete',
        danger: true,
        onClick: () => {
          closeAllMenus();
          onDeleteRequest(col.id, req.id);
        },
      }
    );
    return items;
  };

  const canDrop = (
    col: Collection,
    payload: DragPayload,
    target: DropTarget
  ): boolean => {
    if (payload.collectionId !== target.collectionId) {
      return false;
    }
    if (payload.nodeType === 'folder' && target.folderId) {
      if (payload.nodeId === target.folderId) {
        return false;
      }
      if (isFolderAncestor(col.tree, payload.nodeId, target.folderId)) {
        return false;
      }
    }
    return true;
  };

  const handleDropAt = useCallback(
    (target: DropTarget) => {
      const payload = dragPayload;
      if (!payload) {
        return;
      }
      const col = collections.find((c) => c.id === target.collectionId);
      if (!col || !canDrop(col, payload, target)) {
        return;
      }
      onMoveTreeNode(
        payload.collectionId,
        payload.nodeId,
        payload.nodeType,
        target.folderId,
        target.endOfList ? undefined : target.insertBeforeId
      );
      setDragPayload(null);
      setDropTargetLive(null);
    },
    [dragPayload, collections, onMoveTreeNode, setDropTargetLive]
  );

  const renderDropIndicator = (target: DropTarget) => {
    if (!dragPayload || !dropTarget) {
      return null;
    }
    const matches =
      dropTarget.collectionId === target.collectionId &&
      dropTarget.folderId === target.folderId &&
      dropTarget.endOfList === target.endOfList &&
      dropTarget.insertBeforeId === target.insertBeforeId;
    if (!matches) {
      return null;
    }
    return <div className="h-0.5 bg-primary mx-2 rounded-full shrink-0" />;
  };

  const renderEndDropZone = (
    col: Collection,
    folderId: string | null,
    depth: number
  ) => (
    <div
      key={`${col.id}:${folderId ?? 'root'}:${END_DROP}`}
      className="min-h-[6px]"
      style={treePadding(depth)}
      onDragOver={(e) => {
        if (!dragPayload || dragPayload.collectionId !== col.id) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        setDropTargetLive({
          collectionId: col.id,
          folderId,
          endOfList: true,
        });
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        handleDropAt({
          collectionId: col.id,
          folderId,
          endOfList: true,
        });
      }}
    >
      {renderDropIndicator({
        collectionId: col.id,
        folderId,
        endOfList: true,
      })}
    </div>
  );

  const renderInlineInput = (
    value: string,
    onChange: (v: string) => void,
    onCommit: () => void,
    onCancel: () => void,
    options?: { pristine?: boolean; onPristineChange?: (pristine: boolean) => void; error?: string }
  ) => (
    <input
      autoFocus
      value={value}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => {
        options?.onPristineChange?.(false);
        onChange(e.target.value);
      }}
      onKeyDown={(e) => {
        if (
          options?.pristine &&
          e.key.length === 1 &&
          !e.ctrlKey &&
          !e.metaKey &&
          !e.altKey &&
          e.key !== 'Enter' &&
          e.key !== 'Escape'
        ) {
          e.preventDefault();
          options.onPristineChange?.(false);
          onChange(e.key);
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          onCommit();
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          onCancel();
        }
      }}
      onBlur={onCommit}
      className={cn(
        'flex-1 min-w-0 bg-background border rounded px-1 py-0 text-xs outline-none',
        options?.error ? 'border-destructive' : 'border-primary'
      )}
      title={options?.error}
    />
  );

  const renderPendingFolderCreate = (
    col: Collection,
    parentFolderId: string | null,
    depth: number
  ) => {
    if (
      !pendingFolderCreate ||
      pendingFolderCreate.collectionId !== col.id ||
      pendingFolderCreate.parentFolderId !== parentFolderId
    ) {
      return null;
    }

    return (
      <div style={treePadding(depth)} className="py-0.5 pr-1">
        <div className={cn(TREE_ROW_CLASS, 'bg-[var(--as-tree-selected)]')}>
          <span className={CHEVRON_CLASS} aria-hidden />
          <Folder className={cn(ICON_CLASS, 'text-[var(--as-folder)]')} />
          {renderInlineInput(
            pendingFolderCreate.value,
            (v) =>
              setPendingFolderCreate({
                ...pendingFolderCreate,
                value: v,
                pristine: false,
                error: undefined,
              }),
            commitPendingFolderCreate,
            cancelPendingFolderCreate,
            {
              pristine: pendingFolderCreate.pristine,
              onPristineChange: (pristine) =>
                setPendingFolderCreate((prev) => (prev ? { ...prev, pristine } : prev)),
              error: pendingFolderCreate.error,
            }
          )}
        </div>
        {pendingFolderCreate.error ? (
          <p className="mt-0.5 pl-8 text-[10px] leading-tight text-destructive">
            {pendingFolderCreate.error}
          </p>
        ) : null}
      </div>
    );
  };

  const renderPendingRequestCreate = (
    col: Collection,
    parentFolderId: string | null,
    depth: number
  ) => {
    if (
      !pendingRequestCreate ||
      pendingRequestCreate.collectionId !== col.id ||
      pendingRequestCreate.parentFolderId !== parentFolderId
    ) {
      return null;
    }

    return (
      <div style={treePadding(depth)} className="py-0.5 pr-1">
        <div className={cn(TREE_ROW_CLASS, 'bg-[var(--as-tree-selected)]')}>
          <span className={CHEVRON_CLASS} aria-hidden />
          <span className={cn('font-semibold w-10 shrink-0 tabular-nums', methodClass('GET'))}>
            GET
          </span>
          {renderInlineInput(
            pendingRequestCreate.value,
            (v) =>
              setPendingRequestCreate({
                ...pendingRequestCreate,
                value: v,
                pristine: false,
                error: undefined,
              }),
            commitPendingRequestCreate,
            cancelPendingRequestCreate,
            {
              pristine: pendingRequestCreate.pristine,
              onPristineChange: (pristine) =>
                setPendingRequestCreate((prev) => (prev ? { ...prev, pristine } : prev)),
              error: pendingRequestCreate.error,
            }
          )}
        </div>
        {pendingRequestCreate.error ? (
          <p className="mt-0.5 pl-10 text-[10px] leading-tight text-destructive">
            {pendingRequestCreate.error}
          </p>
        ) : null}
      </div>
    );
  };

  const renderPendingCollectionCreate = () => {
    if (!pendingCollectionCreate) {
      return null;
    }

    return (
      <div className={cn(TREE_ROW_BASE, 'bg-[var(--as-tree-selected)] pr-1')}>
        <span className={cn(CHEVRON_CLASS, 'ml-2')} aria-hidden />
        {renderInlineInput(
            pendingCollectionCreate.value,
            (v) =>
              setPendingCollectionCreate({
                ...pendingCollectionCreate,
                value: v,
                pristine: false,
                error: undefined,
              }),
            commitPendingCollectionCreate,
            cancelPendingCollectionCreate,
            {
              pristine: pendingCollectionCreate.pristine,
              onPristineChange: (pristine) =>
                setPendingCollectionCreate((prev) => (prev ? { ...prev, pristine } : prev)),
              error: pendingCollectionCreate.error,
            }
          )}
        {pendingCollectionCreate.error ? (
          <p className="absolute left-8 top-full z-10 px-2 text-[10px] leading-tight text-destructive">
            {pendingCollectionCreate.error}
          </p>
        ) : null}
      </div>
    );
  };

  const renderRequest = (
    col: Collection,
    req: CollectionRequest,
    depth: number
  ) => {
    const isSelected = selectedRequestId === req.id;
    const isDragging =
      dragPayload?.collectionId === col.id &&
      dragPayload.nodeId === req.id &&
      dragPayload.nodeType === 'request';
    const parentFolderId = findRequestParentId(col.tree, req.id);
    const showSource = hasScannedSource(req);

    return (
      <div key={req.id}>
        {renderDropIndicator({
          collectionId: col.id,
          folderId: parentFolderId,
          insertBeforeId: req.id,
        })}
        <div
          data-request-id={req.id}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = 'move';
            setDragPayload({ collectionId: col.id, nodeId: req.id, nodeType: 'request' });
          }}
          onDragEnd={() => {
            setDragPayload(null);
            setDropTargetLive(null);
          }}
          onDragOver={(e) => {
            if (!dragPayload || dragPayload.collectionId !== col.id) {
              return;
            }
            if (dragPayload.nodeId === req.id && dragPayload.nodeType === 'request') {
              return;
            }
            e.preventDefault();
            e.stopPropagation();
            setDropTargetLive({
              collectionId: col.id,
              folderId: parentFolderId,
              insertBeforeId: req.id,
            });
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleDropAt({
              collectionId: col.id,
              folderId: parentFolderId,
              insertBeforeId: req.id,
            });
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            setContextMenu({
              kind: 'request',
              collectionId: col.id,
              requestId: req.id,
              x: e.clientX,
              y: e.clientY,
            });
          }}
          className={cn(
            TREE_ROW_CLASS,
            isSelected && 'bg-[var(--as-tree-selected)] tree-row-selected',
            !isSelected && 'hover:bg-[var(--as-tree-hover)]',
            isDragging && 'opacity-50'
          )}
          style={treePadding(depth)}
        >
          <GripVertical className="absolute left-0.5 w-3 h-3 text-muted-foreground/30 opacity-0 group-hover:opacity-100 pointer-events-none" />
          <span className={CHEVRON_CLASS} aria-hidden />
          <button
            type="button"
            onClick={() => onSelectRequest(req.id)}
            title={`${req.method} ${req.path}`}
            className="flex flex-1 items-center gap-1.5 min-w-0 text-left pr-1"
          >
            {inlineRename?.kind === 'request' &&
            inlineRename.requestId === req.id &&
            inlineRename.collectionId === col.id ? (
              renderInlineInput(
                inlineRename.value,
                (v) => setInlineRename({ ...inlineRename, value: v }),
                commitInlineRename,
                () => setInlineRename(null)
              )
            ) : (
              <>
                <span
                  className={cn(
                    'font-semibold w-10 shrink-0 tabular-nums',
                    methodClass(req.method)
                  )}
                >
                  {req.method}
                </span>
                <span className="truncate min-w-0">
                  {resolveCollectionRequestDisplayName(req)}
                </span>
              </>
            )}
          </button>
          <TreeRowActions visible={menuRequestId === req.id}>
            {showSource && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenSource(req.id);
                }}
                className="p-0.5 hover:bg-accent rounded text-muted-foreground hover:text-foreground"
                title="Open Source"
              >
                <Code2 className="w-3 h-3" />
              </button>
            )}
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuRequestId(menuRequestId === req.id ? null : req.id);
                  setMenuCollectionId(null);
                  setMenuFolderKey(null);
                  setContextMenu(null);
                }}
                className="p-0.5 hover:bg-accent rounded text-muted-foreground hover:text-foreground"
                title="Request actions"
              >
                <MoreHorizontal className="w-3 h-3" />
              </button>
              {menuRequestId === req.id && (
                <InlineActionMenu items={getRequestMenuItems(col, req)} />
              )}
            </div>
          </TreeRowActions>
        </div>
      </div>
    );
  };

  const renderFolder = (
    col: Collection,
    folderId: string,
    depth: number
  ) => {
    const node = col.tree.nodes[folderId];
    if (!node) {
      return null;
    }
    const key = folderKey(col.id, folderId);
    const isOpen = expandedFolders.has(key);
    const count = countRequestsInFolder(col.tree, folderId);
    const isDragging =
      dragPayload?.collectionId === col.id &&
      dragPayload.nodeId === folderId &&
      dragPayload.nodeType === 'folder';

    const childRefs: TreeRef[] = node.children.map((id) => ({
      id,
      type: col.tree.nodes[id] ? 'folder' : 'request',
    }));

    return (
      <div key={folderId}>
        {renderDropIndicator({
          collectionId: col.id,
          folderId: findFolderParentId(col.tree, folderId),
          insertBeforeId: folderId,
        })}
        <div
          draggable
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = 'move';
            setDragPayload({ collectionId: col.id, nodeId: folderId, nodeType: 'folder' });
          }}
          onDragEnd={() => {
            setDragPayload(null);
            setDropTargetLive(null);
          }}
          onDragOver={(e) => {
            if (!dragPayload || dragPayload.collectionId !== col.id) {
              return;
            }
            if (dragPayload.nodeId === folderId && dragPayload.nodeType === 'folder') {
              return;
            }
            e.preventDefault();
            e.stopPropagation();
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const onFolderBody = e.clientY > rect.top + rect.height * 0.3;
            if (onFolderBody && dragPayload.nodeType !== 'folder') {
              setDropTargetLive({ collectionId: col.id, folderId, endOfList: true });
            } else {
              setDropTargetLive({
                collectionId: col.id,
                folderId: findFolderParentId(col.tree, folderId),
                insertBeforeId: folderId,
              });
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const onFolderBody = e.clientY > rect.top + rect.height * 0.3;
            if (onFolderBody && dragPayload?.nodeType !== 'folder') {
              handleDropAt({ collectionId: col.id, folderId, endOfList: true });
            } else {
              handleDropAt({
                collectionId: col.id,
                folderId: findFolderParentId(col.tree, folderId),
                insertBeforeId: folderId,
              });
            }
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            setContextMenu({
              kind: 'folder',
              collectionId: col.id,
              folderId,
              x: e.clientX,
              y: e.clientY,
            });
          }}
          className={cn(
            TREE_ROW_CLASS,
            selectedFolderId === folderId &&
              selectedCollectionId === col.id &&
              'bg-[var(--as-tree-selected)]',
            selectedFolderId !== folderId && 'hover:bg-[var(--as-tree-hover)]',
            dragPayload &&
              dropTarget?.collectionId === col.id &&
              dropTarget.folderId === folderId &&
              'ring-1 ring-inset ring-primary/40',
            isDragging && 'opacity-50'
          )}
          style={treePadding(depth)}
        >
          <GripVertical className="absolute left-0.5 w-3 h-3 text-muted-foreground/30 opacity-0 group-hover:opacity-100 pointer-events-none" />
          <button
            type="button"
            onClick={() => toggleFolder(col.id, folderId)}
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            {isOpen ? (
              <ChevronDown className={CHEVRON_CLASS} />
            ) : (
              <ChevronRight className={CHEVRON_CLASS} />
            )}
          </button>
          {isOpen ? (
            <FolderOpen className={cn(ICON_CLASS, 'text-[var(--as-folder)]')} />
          ) : (
            <Folder className={cn(ICON_CLASS, 'text-[var(--as-folder)]')} />
          )}
          <button
            type="button"
            onClick={() => {
              setSelectedFolderId(folderId);
              onSelectCollection(col.id);
              if (!isOpen) {
                toggleFolder(col.id, folderId);
              }
            }}
            className="flex flex-1 items-center gap-1.5 min-w-0 text-left font-medium pr-1"
          >
            {inlineRename?.kind === 'folder' &&
            inlineRename.folderId === folderId &&
            inlineRename.collectionId === col.id ? (
              renderInlineInput(
                inlineRename.value,
                (v) => setInlineRename({ ...inlineRename, value: v }),
                commitInlineRename,
                () => setInlineRename(null)
              )
            ) : (
              <>
                <span className="truncate min-w-0">{node.name}</span>
                <span className="ml-auto text-muted-foreground font-normal tabular-nums shrink-0 pl-2">
                  {count}
                </span>
              </>
            )}
          </button>
          <TreeRowActions visible={menuFolderKey === folderKey(col.id, folderId)}>
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const key = folderKey(col.id, folderId);
                  setMenuFolderKey(menuFolderKey === key ? null : key);
                  setMenuCollectionId(null);
                  setMenuRequestId(null);
                  setContextMenu(null);
                }}
                className="p-0.5 hover:bg-accent rounded text-muted-foreground hover:text-foreground"
                title="Folder actions"
              >
                <MoreHorizontal className="w-3 h-3" />
              </button>
              {menuFolderKey === folderKey(col.id, folderId) && (
                <InlineActionMenu items={getFolderMenuItems(col, folderId)} />
              )}
            </div>
          </TreeRowActions>
        </div>
        {isOpen && (
          <>
            {childRefs.map((ref) => {
              if (ref.type === 'folder') {
                return renderFolder(col, ref.id, depth + 1);
              }
              const req = buildRequestMap(col).get(ref.id);
              return req ? renderRequest(col, req, depth + 1) : null;
            })}
            {renderEndDropZone(col, folderId, depth + 1)}
            {renderPendingFolderCreate(col, folderId, depth + 1)}
            {renderPendingRequestCreate(col, folderId, depth + 1)}
          </>
        )}
      </div>
    );
  };

  const renderTree = (col: Collection, depth = 1) => {
    const requestMap = buildRequestMap(col);
    const tree = col.tree ?? { root: [], nodes: {} };
    return (
      <>
        {tree.root.map((ref) => {
          if (ref.type === 'folder') {
            return renderFolder(col, ref.id, depth);
          }
          const req = requestMap.get(ref.id);
          return req ? renderRequest(col, req, depth) : null;
        })}
        {renderEndDropZone(col, null, depth)}
        {renderPendingFolderCreate(col, null, depth)}
        {renderPendingRequestCreate(col, null, depth)}
      </>
    );
  };

  const buildContextItems = (): ContextMenuItem[] => {
    if (!contextMenu) {
      return [];
    }
    if (contextMenu.kind === 'collection') {
      const col = collections.find((c) => c.id === contextMenu.collectionId);
      return col ? getCollectionMenuItems(col) : [];
    }
    if (contextMenu.kind === 'folder') {
      const col = collections.find((c) => c.id === contextMenu.collectionId);
      return col ? getFolderMenuItems(col, contextMenu.folderId) : [];
    }
    const col = collections.find((c) => c.id === contextMenu.collectionId);
    const req = col ? buildRequestMap(col).get(contextMenu.requestId) : undefined;
    return col && req ? getRequestMenuItems(col, req) : [];
  };

  if (collapsed) {
    return (
      <aside className="w-full flex flex-col flex-1 min-h-0 items-center py-2">
        <button
          type="button"
          onClick={() => onCollapsedChange(false)}
          className="flex flex-col items-center gap-1 p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
          title="Show Collections"
        >
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-[10px] font-medium" style={{ writingMode: 'vertical-rl' }}>
            Collections
          </span>
        </button>
      </aside>
    );
  }

  if (!collections.length) {
    return (
      <aside className="w-full flex flex-col flex-1 min-h-0">
        <Header
          onCollapse={() => onCollapsedChange(true)}
          onNewCollection={startPendingCollectionCreate}
          onImportCollection={onImportCollection}
        />
        {pendingCollectionCreate ? (
          <div className="px-1 py-1">{renderPendingCollectionCreate()}</div>
        ) : (
          <p className="p-3 text-sm text-muted-foreground">
            No collections yet. Run Rescan Project to discover endpoints.
          </p>
        )}
      </aside>
    );
  }

  return (
    <>
      <aside className="w-full flex flex-col flex-1 min-h-0 overflow-hidden">
        <Header
          onCollapse={() => onCollapsedChange(true)}
          onNewCollection={startPendingCollectionCreate}
          onImportCollection={onImportCollection}
        />
        <div className="flex-1 min-h-0 overflow-y-auto py-0.5">
          {collections.map((col) => {
            const isOpen = expandedCollections.has(col.id);
            const isSelected = selectedCollectionId === col.id;
            const requestCount = countCollectionRequests(col.tree ?? { root: [], nodes: {} });

            return (
              <div key={col.id}>
                <div
                  onContextMenu={(e) => {
                    e.preventDefault();
                    closeAllMenus();
                    setContextMenu({
                      kind: 'collection',
                      collectionId: col.id,
                      x: e.clientX,
                      y: e.clientY,
                    });
                  }}
                  className={cn(
                    TREE_ROW_BASE,
                    isSelected && 'bg-[var(--as-tree-selected)] tree-row-selected',
                    !isSelected && 'hover:bg-[var(--as-tree-hover)]'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => toggleCollection(col.id)}
                    className="shrink-0 pl-2 text-muted-foreground hover:text-foreground"
                    aria-label={isOpen ? 'Collapse collection' : 'Expand collection'}
                  >
                    {isOpen ? (
                      <ChevronDown className={CHEVRON_CLASS} />
                    ) : (
                      <ChevronRight className={CHEVRON_CLASS} />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectCollection(col.id);
                      setSelectedFolderId(null);
                    }}
                    className="flex flex-1 items-center gap-1 min-w-0 text-left font-medium pr-1"
                  >
                    {inlineRename?.kind === 'collection' &&
                    inlineRename.collectionId === col.id ? (
                      renderInlineInput(
                        inlineRename.value,
                        (v) => setInlineRename({ ...inlineRename, value: v }),
                        commitInlineRename,
                        () => setInlineRename(null)
                      )
                    ) : (
                      <>
                        <span className="truncate min-w-0">{col.name}</span>
                        <span className="ml-auto text-muted-foreground tabular-nums shrink-0 pl-2">
                          {requestCount}
                        </span>
                        {col.type === 'generated' && col.isDirty && (
                          <span className="text-warning text-[10px] shrink-0">●</span>
                        )}
                      </>
                    )}
                  </button>
                  <TreeRowActions visible={menuCollectionId === col.id}>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuCollectionId(menuCollectionId === col.id ? null : col.id);
                          setMenuFolderKey(null);
                          setMenuRequestId(null);
                          setContextMenu(null);
                        }}
                        className="p-0.5 hover:bg-accent rounded text-muted-foreground hover:text-foreground"
                        title="Collection actions"
                      >
                        <MoreHorizontal className="w-3 h-3" />
                      </button>
                      {menuCollectionId === col.id && (
                        <InlineActionMenu items={getCollectionMenuItems(col)} />
                      )}
                    </div>
                  </TreeRowActions>
                </div>
                {isOpen && renderTree(col)}
              </div>
            );
          })}
          {renderPendingCollectionCreate()}
        </div>
      </aside>
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={buildContextItems()}
          onClose={closeAllMenus}
        />
      )}
      {deleteFolderTarget && (
        <DeleteFolderModal
          folderName={deleteFolderTarget.folderName}
          requestCount={deleteFolderTarget.requestCount}
          subfolderCount={deleteFolderTarget.subfolderCount}
          onConfirm={() => {
            onDeleteFolder(deleteFolderTarget.collectionId, deleteFolderTarget.folderId);
            setDeleteFolderTarget(null);
          }}
          onCancel={() => setDeleteFolderTarget(null)}
        />
      )}
    </>
  );
}

function TreeRowActions({
  visible = false,
  children,
}: {
  visible?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'absolute right-0 top-0 bottom-0 flex items-center gap-0.5 pr-0.5 pl-3',
        visible ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
      )}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}

function InlineActionMenu({ items }: { items: ContextMenuItem[] }) {
  return (
    <div
      className="absolute right-0 top-full z-30 mt-1 min-w-[168px] rounded border border-border bg-card shadow-lg text-xs py-1"
      onMouseDown={(e) => e.stopPropagation()}
      role="menu"
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="menuitem"
          disabled={item.disabled}
          className={cn(
            'w-full px-2.5 py-1.5 text-left hover:bg-accent disabled:opacity-40 disabled:pointer-events-none',
            item.danger && 'text-danger'
          )}
          onClick={() => {
            if (!item.disabled) {
              item.onClick?.();
            }
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function Header({
  onCollapse,
  onNewCollection,
  onImportCollection,
}: {
  onCollapse: () => void;
  onNewCollection: () => void;
  onImportCollection: () => void;
}) {
  return (
    <div className="flex items-center gap-1 px-2 py-2 border-b border-border shrink-0 sticky top-0 bg-card z-10">
      <span className="flex-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Collections
      </span>
      <button
        type="button"
        onClick={onImportCollection}
        className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
        title="Import Collection..."
        aria-label="Import Collection"
      >
        <Upload className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={onNewCollection}
        className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
        title="New Collection"
        aria-label="New Collection"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={onCollapse}
        className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
        title="Hide Collections"
      >
        <PanelLeftClose className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
