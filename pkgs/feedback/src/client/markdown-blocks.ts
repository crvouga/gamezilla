export type MarkdownBlock =
  | { type: 'heading'; text: string; level: number }
  | { type: 'paragraph' | 'quote' | 'code'; text: string }
  | { type: 'list'; ordered: boolean; items: readonly string[] };

export function feedbackMarkdownBlocks(
  value: string
): readonly MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  const lines = value.split('\n');
  let index = 0;
  while (index < lines.length) {
    const line = lines[index] ?? '';
    if (!line.trim()) {
      index++;
      continue;
    }
    if (line.startsWith('```')) {
      const code = readCode(lines, index + 1);
      blocks.push({ type: 'code', text: code.text });
      index = code.next;
      continue;
    }
    const heading = /^(#{1,6}) (.*)$/.exec(line);
    if (heading) {
      blocks.push({
        type: 'heading',
        level: heading[1]?.length ?? 1,
        text: heading[2] ?? '',
      });
      index++;
      continue;
    }
    if (line.startsWith('> ')) {
      blocks.push({ type: 'quote', text: line.slice(2) });
      index++;
      continue;
    }
    const list = listLine(line);
    if (list) {
      const items = readList(lines, index, list.ordered);
      blocks.push({ type: 'list', ordered: list.ordered, items: items.text });
      index = items.next;
      continue;
    }
    blocks.push({ type: 'paragraph', text: line });
    index++;
  }
  return blocks;
}
function listLine(line: string): { ordered: boolean; text: string } | null {
  const match = /^(?:([-*]) |(\d+)\. )(.*)$/.exec(line);
  return match
    ? { ordered: match[2] !== undefined, text: match[3] ?? '' }
    : null;
}
export function safeMarkdownHref(value: string): string | undefined {
  return /^(https?:\/\/|mailto:|#|\/)/i.test(value) && !value.startsWith('//')
    ? value
    : undefined;
}

function readCode(lines: readonly string[], start: number) {
  const text: string[] = [];
  let next = start;
  while (next < lines.length && !lines[next]?.startsWith('```'))
    text.push(lines[next++] ?? '');
  return { text: text.join('\n'), next: next + 1 };
}
function readList(lines: readonly string[], start: number, ordered: boolean) {
  const text: string[] = [];
  let next = start;
  while (next < lines.length) {
    const line = listLine(lines[next] ?? '');
    if (!line || line.ordered !== ordered) break;
    text.push(line.text);
    next++;
  }
  return { text, next };
}
