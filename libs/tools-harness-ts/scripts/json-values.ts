/** A JSON value reader that retains at most the requested value, across arbitrary chunks. */
export class JsonValues {
  private readonly chunks: Iterator<string>;
  private chunk = '';
  private offset = 0;

  constructor(chunks: Iterable<string>) {
    this.chunks = chunks[Symbol.iterator]();
  }

  close(): void {
    this.chunks.return?.();
  }

  private current(): string | undefined {
    while (this.offset === this.chunk.length) {
      const next = this.chunks.next();
      if (next.done) return undefined;
      this.chunk = next.value;
      this.offset = 0;
    }
    return this.chunk[this.offset];
  }

  peek(): string | undefined {
    while (isSpace(this.current())) this.offset++;
    return this.current();
  }

  consume(expected: string): void {
    if (this.peek() !== expected)
      throw new Error(`JSON projection: expected ${expected}`);
    this.offset++;
  }

  value(): string {
    const first = this.peek();
    if (first === undefined) throw new Error('JSON projection: missing value');
    const state: ValueState = {
      kind:
        first === '"'
          ? 'string'
          : first === '{' || first === '['
            ? 'compound'
            : 'primitive',
      stack: [],
      quoted: false,
      escaped: false,
      done: false,
    };
    const parts: string[] = [];
    while (this.current() !== undefined) {
      const start = this.offset;
      while (this.offset < this.chunk.length && !state.done) {
        if (scanCharacter(state, this.chunk[this.offset]!)) this.offset++;
      }
      parts.push(this.chunk.slice(start, this.offset));
      if (state.done) return parts.join('');
    }
    if (state.kind === 'primitive') return parts.join('');
    throw new Error('JSON projection: truncated value');
  }
}

type ValueState = {
  readonly kind: 'string' | 'compound' | 'primitive';
  readonly stack: string[];
  quoted: boolean;
  escaped: boolean;
  done: boolean;
};

function isSpace(character: string | undefined): boolean {
  return character !== undefined && ' \n\r\t'.includes(character);
}

/** False leaves the primitive's following delimiter for the enclosing reader. */
function scanCharacter(state: ValueState, character: string): boolean {
  if (state.kind === 'primitive') {
    state.done = isSpace(character) || ',]}'.includes(character);
    return !state.done;
  }
  if (state.quoted) {
    if (state.escaped) state.escaped = false;
    else if (character === '\\') state.escaped = true;
    else if (character === '"') {
      state.quoted = false;
      state.done = state.kind === 'string';
    }
  } else if (character === '"') state.quoted = true;
  else if (character === '{' || character === '[') state.stack.push(character);
  else if (character === '}' || character === ']') {
    const opening = state.stack.pop();
    if (opening !== (character === '}' ? '{' : '['))
      throw new Error('JSON projection: mismatched delimiter');
    state.done = state.stack.length === 0;
  }
  return true;
}
