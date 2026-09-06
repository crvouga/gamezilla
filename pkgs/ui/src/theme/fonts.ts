/**
 * Web font stacks. System fonts only — no webfont download on the boot path.
 */

export type FontStacks = {
  sans: string;
  serif: string;
  rounded: string;
  mono: string;
};

export const fonts: FontStacks = {
  sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  rounded:
    "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
  mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
};
