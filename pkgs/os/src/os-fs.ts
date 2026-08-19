export type PathExists = (absolutePath: string) => boolean;

export type OsFs = {
  readonly pathExists: PathExists;
  readonly mkdirpSync: (absolutePath: string) => void;
  readonly chmodSync: (absolutePath: string, mode: number) => void;
  readonly rmrfSync: (absolutePath: string) => void;
};

export const missingOsFs: OsFs = {
  pathExists: () => false,
  mkdirpSync: (absolutePath) => {
    throw new Error(`OsFs.mkdirpSync not injected for ${absolutePath}`);
  },
  chmodSync: (absolutePath) => {
    throw new Error(`OsFs.chmodSync not injected for ${absolutePath}`);
  },
  rmrfSync: (absolutePath) => {
    throw new Error(`OsFs.rmrfSync not injected for ${absolutePath}`);
  },
};
