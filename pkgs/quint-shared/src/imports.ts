/** Import paths, excluding quoted examples and comments, including multiline imports. */
export function quintImportPaths(source: string): string[] {
  const tokens =
    source.match(
      /\/\/[^\n]*|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|[A-Za-z_]\w*/g
    ) ?? [];
  const paths: string[] = [];
  let importing = false;
  let from = false;
  for (const token of tokens) {
    if (token.startsWith('//') || token.startsWith('/*')) continue;
    if (from && token.startsWith('"')) {
      paths.push(JSON.parse(token) as string);
      importing = false;
      from = false;
    } else if (token === 'import') importing = true;
    else if (importing && token === 'from') from = true;
  }
  return paths;
}
