/**
 * Join a tagged-template call into one string using `.raw` so escapes like
 * `\dt` / `\d` survive ES2018 cooked-template rules (invalid escapes → undefined).
 */
export function interpolateTaggedTemplate(
  strings: TemplateStringsArray,
  values: readonly unknown[]
): string {
  let out = '';
  for (let i = 0; i < strings.length; i++) {
    out += strings.raw[i] ?? strings[i] ?? '';
    if (i < values.length) {
      out += String(values[i] ?? '');
    }
  }
  return out;
}
