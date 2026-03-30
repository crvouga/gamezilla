const ALL = ['local', 'prod'] as const;

export type IStage = (typeof ALL)[number];

const parse = (value: unknown): IStage | null => {
  if (typeof value !== 'string') return null;
  if (ALL.includes(value as IStage)) return value as IStage;
  return null;
};

const TRUE = parse(process.env['EXPO_PUBLIC_STAGE']);

export const Stage = {
  TRUE,
  ALL,
  parse,
};
