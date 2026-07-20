export type InfisicalCtx = {
  readonly domain: string;
  readonly workspaceId: string;
  readonly token: string;
};

export type ProjectInfo = {
  readonly slug: string;
  readonly orgId: string;
};

export type ReconcileLog = (message: string) => void;
export type ReconcileFail = (message: string) => never;
