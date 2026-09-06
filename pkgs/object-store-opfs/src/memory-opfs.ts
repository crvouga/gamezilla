/**
 * In-memory {@link OpfsDirHandle} tree. Used by contract tests and by the
 * in-process sim host where no real OPFS exists.
 */

import { notFoundError, type OpfsDirHandle, type OpfsFileHandle } from './opfs';

type DirNode = { readonly kind: 'dir'; readonly children: Map<string, Node> };
type FileNode = { readonly kind: 'file'; bytes: Uint8Array };
type Node = DirNode | FileNode;

function makeFileHandle(parent: DirNode, name: string): OpfsFileHandle {
  return {
    createWritable() {
      let buf = new Uint8Array(0);
      return Promise.resolve({
        write(data: Uint8Array) {
          buf = new Uint8Array(data);
          return Promise.resolve();
        },
        close() {
          parent.children.set(name, { kind: 'file', bytes: buf });
          return Promise.resolve();
        },
      });
    },
    getFile() {
      const node = parent.children.get(name);
      if (node === undefined || node.kind !== 'file') {
        return Promise.reject(notFoundError(name));
      }
      const ab = new ArrayBuffer(node.bytes.byteLength);
      new Uint8Array(ab).set(node.bytes);
      return Promise.resolve({
        arrayBuffer: () => Promise.resolve(ab),
        type: 'application/octet-stream',
        size: node.bytes.byteLength,
      });
    },
  };
}

function makeDirHandle(node: DirNode): OpfsDirHandle {
  return {
    getFileHandle(name, options) {
      const existing = node.children.get(name);
      if (existing !== undefined && existing.kind === 'file') {
        return Promise.resolve(makeFileHandle(node, name));
      }
      if (options?.create === true) {
        node.children.set(name, { kind: 'file', bytes: new Uint8Array() });
        return Promise.resolve(makeFileHandle(node, name));
      }
      return Promise.reject(notFoundError(name));
    },
    getDirectoryHandle(name, options) {
      const existing = node.children.get(name);
      if (existing !== undefined && existing.kind === 'dir') {
        return Promise.resolve(makeDirHandle(existing));
      }
      if (options?.create === true) {
        const child: DirNode = { kind: 'dir', children: new Map() };
        node.children.set(name, child);
        return Promise.resolve(makeDirHandle(child));
      }
      return Promise.reject(notFoundError(name));
    },
    removeEntry(name) {
      if (!node.children.has(name)) {
        return Promise.reject(notFoundError(name));
      }
      node.children.delete(name);
      return Promise.resolve();
    },
    async *keys() {
      for (const name of node.children.keys()) yield name;
    },
  };
}

/** Fresh empty in-memory OPFS root. */
export function createMemoryOpfsRoot(): OpfsDirHandle {
  return makeDirHandle({ kind: 'dir', children: new Map() });
}
