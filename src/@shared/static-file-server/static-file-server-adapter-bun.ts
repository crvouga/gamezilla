import { existsSync, readFileSync, statSync } from 'fs';
import { resolve } from 'path';
import { createStaticFileHandler } from './static-file-server';

function createBunFileAdapter(rootDir: string) {
  return (pathname: string): Blob | null => {
    const safePath =
      pathname === '/' ? 'index.html' : pathname.slice(1).split('?')[0];
    const filePath = resolve(rootDir, safePath);

    if (!filePath.startsWith(resolve(rootDir))) {
      return null;
    }
    if (!existsSync(filePath)) {
      return null;
    }
    const stat = statSync(filePath);
    if (!stat.isFile()) {
      return null;
    }
    const buffer = readFileSync(filePath);
    return new Blob([buffer]);
  };
}

export function createStaticFileHandlerBun(rootDir: string) {
  return createStaticFileHandler({
    getFile: createBunFileAdapter(rootDir),
  });
}
