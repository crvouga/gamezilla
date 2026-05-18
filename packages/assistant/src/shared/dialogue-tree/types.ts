export type DialogueLookupKey = {
  readonly bucket: string;
  readonly theme?: string;
  readonly variation?: number;
};

export type DialogueContext = Readonly<
  Record<string, string | number | boolean | null>
>;

export type DialogueStep = {
  readonly text: string;
  readonly holdMs: number;
};

export type DialogueNode =
  | { readonly kind: 'single'; readonly variants: readonly string[] }
  | { readonly kind: 'sequence'; readonly steps: readonly DialogueStep[] };

export type DialogueTree = {
  lookup(key: DialogueLookupKey, ctx: DialogueContext): DialogueNode | null;
};
