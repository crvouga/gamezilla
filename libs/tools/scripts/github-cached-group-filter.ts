/**
 * Turbo's grouped GitHub Actions output opens one `::group::` per task, so a
 * mostly-cached run prints hundreds of collapsed groups whose only line is
 * "cache hit, suppressing logs <hash>". This line filter drops those groups
 * and counts them; every other line passes through untouched.
 *
 * Only a group's header and its cache-hit lines are ever buffered: the first
 * other body line flushes the group and streams the rest of it.
 */
import { stripVTControlCharacters } from 'node:util';

const GROUP_START = '::group::';
const GROUP_END = '::endgroup::';
const CACHE_HIT_SUPPRESSED = 'cache hit, suppressing logs';

type State = 'idle' | 'buffering' | 'streaming';

export class CachedGroupFilter {
  #state: State = 'idle';
  #buffered: string[] = [];
  #hidden = 0;
  readonly #write: (line: string) => void;

  constructor(write: (line: string) => void) {
    this.#write = write;
  }

  /** Number of cache-hit-only groups dropped so far. */
  get hiddenCount(): number {
    return this.#hidden;
  }

  push(line: string): void {
    const text = stripVTControlCharacters(line).trim();
    if (this.#state === 'idle') {
      if (text.startsWith(GROUP_START)) {
        this.#state = 'buffering';
        this.#buffered = [line];
        return;
      }
      this.#write(line);
      return;
    }
    if (this.#state === 'streaming') {
      this.#write(line);
      if (text.startsWith(GROUP_END)) this.#state = 'idle';
      return;
    }
    this.#pushBuffered(line, text);
  }

  /** Flush a group left open when the stream ended. */
  end(): void {
    for (const line of this.#buffered) this.#write(line);
    this.#buffered = [];
    this.#state = 'idle';
  }

  #pushBuffered(line: string, text: string): void {
    if (text.startsWith(GROUP_END)) {
      this.#buffered = [];
      this.#state = 'idle';
      this.#hidden += 1;
      return;
    }
    if (text === '' || text.includes(CACHE_HIT_SUPPRESSED)) {
      this.#buffered.push(line);
      return;
    }
    for (const held of this.#buffered) this.#write(held);
    this.#buffered = [];
    this.#write(line);
    this.#state = 'streaming';
  }
}
