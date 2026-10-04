/** Preserve unrelated Node flags while setting the client build heap limit. */
export function withNodeMaxOldSpaceSize(
  env: NodeJS.ProcessEnv,
  mb: number
): NodeJS.ProcessEnv {
  const flag = `--max-old-space-size=${String(mb)}`;
  const existing = env['NODE_OPTIONS']?.trim();
  if (existing === undefined || existing.length === 0) {
    return { ...env, NODE_OPTIONS: flag };
  }
  if (/(?:^|\s)--max-old-space-size=\d+(?=\s|$)/.test(existing)) {
    return {
      ...env,
      NODE_OPTIONS: existing.replace(/--max-old-space-size=\d+/g, flag),
    };
  }
  return { ...env, NODE_OPTIONS: `${existing} ${flag}` };
}
