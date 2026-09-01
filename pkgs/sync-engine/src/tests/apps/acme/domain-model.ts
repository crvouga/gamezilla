import type { DomainOp, ServerOp } from '../../system/actions';
import { domainOp, serverOp } from '../../system/model';

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

export type AcmeDomainModel = {
  readonly knownEntityIds: Set<string>;
  readonly pendingSilentEntities: Set<string>;
};

export function initialAcmeDomainModel(): AcmeDomainModel {
  return {
    knownEntityIds: new Set(),
    pendingSilentEntities: new Set(),
  };
}

function noteIdFromArgs(args: Record<string, unknown>): string | null {
  const id = args['id'];
  return typeof id === 'string' ? id : null;
}

export function acmeDomainAllows(
  model: AcmeDomainModel,
  op: DomainOp | ServerOp
): boolean {
  if (op.kind === 'domain') {
    if (op.mutation === 'deleteNote') {
      const id = noteIdFromArgs(op.args);
      if (id !== null && model.pendingSilentEntities.has(id)) return false;
    }
    if (op.mutation === 'setNote') {
      const id = noteIdFromArgs(op.args);
      if (id !== null && model.pendingSilentEntities.has(id)) return false;
    }
    return true;
  }
  if (op.name === 'insertCatalogNoteSilent') {
    const id = op.args['noteId'];
    return typeof id === 'string' && !model.knownEntityIds.has(id);
  }
  if (op.name === 'writeNoteBodySilent') {
    const id = op.args['noteId'];
    return typeof id === 'string' && model.knownEntityIds.has(id);
  }
  if (op.name === 'seedLargeCatalogSilent') {
    return !model.knownEntityIds.has('__large_catalog__');
  }
  return true;
}

export function acmeDomainApply(
  model: AcmeDomainModel,
  op: DomainOp | ServerOp
): void {
  if (op.kind === 'domain') {
    if (op.mutation === 'setNote' || op.mutation === 'deleteNote') {
      const id = noteIdFromArgs(op.args);
      if (id !== null) model.knownEntityIds.add(id);
    }
    return;
  }
  if (op.name === 'insertCatalogNoteSilent') {
    const id = op.args['noteId'];
    if (typeof id === 'string') {
      model.knownEntityIds.add(id);
      model.pendingSilentEntities.add(id);
    }
    return;
  }
  if (op.name === 'writeNoteBodySilent') {
    const id = op.args['noteId'];
    if (typeof id === 'string') model.knownEntityIds.add(id);
    return;
  }
  if (op.name === 'seedLargeCatalogSilent') {
    model.knownEntityIds.add('__large_catalog__');
  }
}

export function acmeDomainOnHeal(model: AcmeDomainModel): void {
  model.pendingSilentEntities.clear();
}

export function acmeSetNoteOp(
  clientId: string,
  id: string,
  body: string
): DomainOp {
  return domainOp(clientId, 'setNote', { id, body, title: '' });
}

export function acmeDeleteNoteOp(clientId: string, id: string): DomainOp {
  return domainOp(clientId, 'deleteNote', { id });
}

export function acmeSetFolderOp(
  clientId: string,
  id: string,
  title: string
): DomainOp {
  return domainOp(clientId, 'setFolder', { id, title });
}

export function acmeCreateSpaceOp(clientId: string, id: string): DomainOp {
  return domainOp(clientId, 'createSpace', { id, title: '' });
}

export function acmeJoinSpaceOp(clientId: string, spaceId: string): DomainOp {
  return domainOp(clientId, 'joinSpace', { spaceId });
}

export function acmeLeaveSpaceOp(clientId: string, spaceId: string): DomainOp {
  return domainOp(clientId, 'leaveSpace', { spaceId });
}

export function acmeWriteBodySilentOp(noteId: string, body: string): ServerOp {
  return serverOp('writeNoteBodySilent', { noteId, body });
}

export function acmeCatalogInsertSilentOp(
  noteId: string,
  body: string
): ServerOp {
  return serverOp('insertCatalogNoteSilent', { noteId, body });
}

export function acmeSeedLargeCatalogOp(count: number): ServerOp {
  return serverOp('seedLargeCatalogSilent', { count });
}
