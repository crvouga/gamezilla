import { readBytes } from '@pkgs/object-store/helpers';
import type { ObjectStore } from '@pkgs/object-store/interface';
import type { CreateId } from '@pkgs/uuid';
import type { EvidenceFile } from '../shared/types';
import type { SavedEvidence } from '../shared/workspace';

export class DraftEvidence {
  constructor(private readonly store: ObjectStore, private readonly createId: CreateId) {}
  async save(file: EvidenceFile): Promise<SavedEvidence> {
    const key = `draft-evidence/${this.createId()}`;
    await this.store.put(key, file.bytes, file.contentType);
    return { key, name: file.name, contentType: file.contentType };
  }
  async read(file: SavedEvidence): Promise<EvidenceFile> {
    const object = await this.store.get(file.key);
    if (!object) throw new Error('Saved evidence is unavailable. Your writing has been kept.');
    return { name: file.name, contentType: file.contentType, bytes: await readBytes(object.body) };
  }
}
