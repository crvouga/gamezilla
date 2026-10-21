export type TablePolicy = 'DOMAIN' | 'SERVER_ONLY' | 'FRAMEWORK';

export type TablePolicyLookup = (table: string) => TablePolicy | undefined;
