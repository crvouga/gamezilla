export type PathExists = (absolutePath: string) => boolean;

export type OsFs = {
  readonly pathExists: PathExists;
  readonly mkdirpSync: (absolutePath: string) => void;
  readonly chmodSync: (absolutePath: string, mode: number) => void;
  readonly readdirSync: (absolutePath: string) => string[];
  readonly rmrfSync: (absolutePath: string) => void;
};
