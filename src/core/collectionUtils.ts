import { Collection, CollectionRequest, ControllerGroup } from './types';

export function findRequest(
  collections: Collection[],
  requestId: string
): { collection: Collection; request: CollectionRequest; controllerName: string } | undefined {
  for (const collection of collections) {
    for (const group of collection.controllers) {
      const request = group.requests.find((r) => r.id === requestId);
      if (request) {
        return { collection, request, controllerName: group.name };
      }
    }
  }
  return undefined;
}

export function mapCollectionRequests(
  collection: Collection,
  fn: (req: CollectionRequest, groupName: string) => CollectionRequest | null
): Collection {
  const controllers: ControllerGroup[] = [];
  for (const group of collection.controllers) {
    const requests: CollectionRequest[] = [];
    for (const req of group.requests) {
      const result = fn(req, group.name);
      if (result) {
        requests.push(result);
      }
    }
    if (requests.length > 0) {
      controllers.push({ name: group.name, requests });
    }
  }
  return { ...collection, controllers };
}

export function countEndpoints(collection: Collection): number {
  return collection.controllers.reduce((n, g) => n + g.requests.length, 0);
}

export function countControllers(collection: Collection): number {
  return collection.controllers.length;
}
