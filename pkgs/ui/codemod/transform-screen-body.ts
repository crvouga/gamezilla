/**
 * ScreenBase body bag: `content={({ sx })` → `bodyClass`, and common
 * `sx={sx}` / `sx={[sx, { gap: N }]}` / `frameSx={sx}` call-site rewrites.
 */

/** Rewrite BodyContentProps `sx` bag usages after host conversion. */
export function rewriteScreenBodyBag(text: string): string {
  let next = text;
  next = next.replace(
    /content=\{\(\{\s*sx\s*\}\)/g,
    'content={({ bodyClass })'
  );
  next = next.replace(/content=\{\(\{\s*sx\s*,/g, 'content={({ bodyClass,');
  next = next.replace(
    /content=\{\(\{\s*([^}]*),\s*sx\s*\}\)/g,
    'content={({ $1, bodyClass })'
  );
  // sx={[sx, { gap: N }]} → class={`${bodyClass} gap-N`}
  next = next.replace(
    /sx=\{\[\s*sx\s*,\s*\{\s*gap:\s*(\d+)\s*\}\s*\]\}/g,
    'class={`${bodyClass} gap-$1`}'
  );
  // frameSx={sx} (BodyContent flex-fill on scroller)
  next = next.replace(/\bframeSx=\{sx\}/g, 'class={bodyClass}');
  // Plain sx={sx} / sx={props.sx} on wrappers — only exact body bag id
  next = next.replace(/\bsx=\{sx\}/g, 'class={bodyClass}');
  next = next.replace(/\bsx=\{props\.sx\}/g, 'class={props.bodyClass}');
  // Type/prop renames on thin wrappers
  next = next.replace(/\bsx\?: SxProps/g, 'class?: string');
  next = next.replace(/\breadonly sx\?:/g, 'readonly class?:');
  return next;
}
