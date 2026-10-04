/**
 * Text typography variant names (CSS classes live in `hosts.css` as
 * `textBodyBold`, `textCaption`, … — imported via `@pkgs/ui-root-client/hosts.css`).
 *
 * The former `<Text>` host was peeled to HTML (`<p>` / `<span>` / …) by the
 * migrate-to-tailwind codemod; only the variant union remains as a shared type.
 */

export type TextVariant =
  | 'body'
  | 'bodyBold'
  | 'caption'
  | 'label'
  | 'title'
  | 'subtitle'
  | 'heading'
  /** Compact navigation bar title (stack headers, not page heroes). */
  | 'navigationTitle'
  | 'link'
  | 'mono';

export type TextElement =
  | 'span'
  | 'p'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'label'
  | 'strong'
  | 'em'
  | 'code'
  | 'time';
