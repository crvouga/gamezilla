import { transform } from 'lightningcss';

/** CSS module names shared by the DOM preload and offline report compiler. */
export function compileCssModule(filename: string, source: string) {
  const result = transform({
    filename,
    code: Buffer.from(source),
    // Absolute worktree paths must never affect snapshots or report replay.
    cssModules: { pattern: 'harness-[name]-[content-hash]-[local]' },
  });
  const classes: Record<string, string> = {};
  for (const [name, value] of Object.entries(result.exports ?? {})) {
    const composed = value.composes.map((reference) => {
      if (reference.type === 'dependency')
        throw new Error(
          `Cross-file CSS composition is unsupported: ${filename}`
        );
      return reference.name;
    });
    classes[name] = [value.name, ...composed].join(' ');
  }
  return { css: result.code.toString(), classes };
}
