import { assert } from '@gamezilla/shared/assert';
import { intro } from '@clack/prompts';
import readline from 'node:readline';
import pc from 'picocolors';

export type SearchableMenuOption = {
  value: string;
  label?: string;
  hint?: string;
  disabled?: boolean;
};

function clearScreen(): void {
  process.stdout.write('\x1B[3J\x1B[2J\x1B[H');
}

function clampIndex(len: number, i: number): number {
  if (len === 0) return 0;
  return Math.max(0, Math.min(i, len - 1));
}

/**
 * Searchable list like @clack/prompts autocomplete, but the highlight resets to the
 * first row whenever the search string changes (clack keeps the old index).
 */
export function runSearchableCommandMenu(params: {
  introLine: string;
  message: string;
  baseOptions: SearchableMenuOption[];
  filterAndSort: (search: string, base: SearchableMenuOption[]) => SearchableMenuOption[];
}): Promise<string | null> {
  return new Promise((resolve) => {
    let search = '';
    let cursor = 0;
    let filtered = params.filterAndSort(search, params.baseOptions);

    const render = (): void => {
      clearScreen();
      intro(params.introLine);
      console.log('');
      console.log(`${pc.cyan('◆')}  ${params.message}`);
      console.log('');
      console.log(`  Search: ${search}${pc.inverse(' ')}`);
      console.log('');

      if (filtered.length === 0) {
        console.log(pc.dim('  (no matches)'));
      } else {
        for (let i = 0; i < filtered.length; i++) {
          const opt = filtered[i];
          assert.defined(opt, 'filtered option');
          const active = i === cursor;
          const mark = active ? pc.green('●') : pc.dim('○');
          const main = opt.label ?? String(opt.value);
          const hint = opt.hint ? pc.dim(` (${opt.hint})`) : '';
          console.log(`  ${mark} ${main}${hint}`);
        }
      }

      const n = filtered.length;
      const suffix =
        search.trim() === '' ? '' : pc.dim(` (${n} match${n === 1 ? '' : 'es'})`);
      console.log('');
      console.log(
        pc.dim(
          `  ↑/↓ to select • Enter: confirm • Type: to search${suffix}`,
        ),
      );
    };

    const cleanup = (): void => {
      process.stdin.removeListener('keypress', onKeypress);
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }
    };

    const onKeypress = (str: string | undefined, key: readline.Key): void => {
      if (!key) return;

      if (key.ctrl && key.name === 'c') {
        cleanup();
        resolve(null);
        return;
      }

      if (key.name === 'escape') {
        cleanup();
        resolve(null);
        return;
      }

      if (key.name === 'return' || key.name === 'enter') {
        const opt = filtered[cursor];
        if (opt && !opt.disabled) {
          cleanup();
          resolve(String(opt.value));
        }
        return;
      }

      if (key.name === 'up') {
        cursor = clampIndex(filtered.length, cursor - 1);
        render();
        return;
      }

      if (key.name === 'down') {
        cursor = clampIndex(filtered.length, cursor + 1);
        render();
        return;
      }

      if (key.name === 'backspace') {
        search = search.slice(0, -1);
        cursor = 0;
        filtered = params.filterAndSort(search, params.baseOptions);
        cursor = clampIndex(filtered.length, cursor);
        render();
        return;
      }

      if (
        str &&
        str.length === 1 &&
        str >= ' ' &&
        !key.ctrl &&
        !key.meta
      ) {
        search += str;
        cursor = 0;
        filtered = params.filterAndSort(search, params.baseOptions);
        cursor = clampIndex(filtered.length, cursor);
        render();
      }
    };

    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();
    process.stdin.on('keypress', onKeypress);
    render();
  });
}
