import type { DomainOp, ServerOp } from './scenario-app';
import { domainOp, serverOp } from './scenario-app';

export const NOTE_IDS = [
  'n0',
  'n1',
  'n2',
  'n3',
  'n4',
  'n5',
  'n6',
  'n7',
] as const;
export const FOLDER_IDS = ['f0', 'f1', 'f2', 'f3'] as const;
export const SPACE_IDS = ['s0', 's1', 's2', 's3'] as const;

export function exampleSetNoteOp(
  clientId: string,
  id: string,
  body: string
): DomainOp {
  return domainOp(clientId, 'setNote', { id, body, title: '' });
}

export function exampleDeleteNoteOp(clientId: string, id: string): DomainOp {
  return domainOp(clientId, 'deleteNote', { id });
}

export function exampleSetFolderOp(
  clientId: string,
  id: string,
  title: string
): DomainOp {
  return domainOp(clientId, 'setFolder', { id, title });
}

export function exampleCreateSpaceOp(clientId: string, id: string): DomainOp {
  return domainOp(clientId, 'createSpace', { id, title: '' });
}

export function exampleJoinSpaceOp(
  clientId: string,
  spaceId: string
): DomainOp {
  return domainOp(clientId, 'joinSpace', { spaceId });
}

export function exampleLeaveSpaceOp(
  clientId: string,
  spaceId: string
): DomainOp {
  return domainOp(clientId, 'leaveSpace', { spaceId });
}

export function exampleWriteBodySilentOp(
  noteId: string,
  body: string
): ServerOp {
  return serverOp('writeNoteBodySilent', { noteId, body });
}

export function exampleCatalogInsertSilentOp(
  noteId: string,
  body: string
): ServerOp {
  return serverOp('insertCatalogNoteSilent', { noteId, body });
}

export function exampleSeedLargeCatalogOp(count: number): ServerOp {
  return serverOp('seedLargeCatalogSilent', { count });
}
