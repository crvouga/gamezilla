import {
  cancel,
  confirm,
  isCancel,
  log,
  note,
  outro,
} from '@clack/prompts';
import pc from 'picocolors';
import { COMMAND_GROUP_ORDER } from './commands/commands';
import type { Command } from './commands/types';
import {
  type SearchableMenuOption,
  runSearchableCommandMenu,
} from './searchable-command-menu';

type SelectValue = string;

type MenuOption = SearchableMenuOption;

/** Clear screen + scrollback (where supported) so each prompt feels like a fresh pane. */
function clearTerminal(): void {
  process.stdout.write('\x1B[3J\x1B[2J\x1B[H');
}

function matchesSearchQuery(search: string, opt: MenuOption): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  const id = String(opt.value).toLowerCase();
  const hint = (opt.hint ?? '').toLowerCase();
  return id.includes(q) || hint.includes(q);
}

/**
 * Relevance sort: prefix on command id first, then substring position on id, then hint.
 * Typing "de" surfaces deploy and destroy before other matches.
 */
function sortMenuOptionsBySearch(search: string, options: MenuOption[]): MenuOption[] {
  const q = search.trim().toLowerCase();
  if (!q) {
    return options;
  }

  const filtered = options.filter((opt) => matchesSearchQuery(search, opt));

  const rank = (opt: MenuOption): [number, number, string] => {
    const id = String(opt.value);
    const idLower = id.toLowerCase();
    const hint = (opt.hint ?? '').toLowerCase();

    if (idLower.startsWith(q)) {
      return [0, 0, id];
    }
    const idIdx = idLower.indexOf(q);
    if (idIdx !== -1) {
      return [1, idIdx, id];
    }
    const hintIdx = hint.indexOf(q);
    if (hintIdx !== -1) {
      return [2, hintIdx, id];
    }
    return [9, 0, id];
  };

  filtered.sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra[0] !== rb[0]) return ra[0] - rb[0];
    if (ra[1] !== rb[1]) return ra[1] - rb[1];
    return ra[2].localeCompare(rb[2]);
  });

  return filtered;
}

function buildSelectOptions(commands: Command[]): MenuOption[] {
  const options: MenuOption[] = [];

  for (const group of COMMAND_GROUP_ORDER) {
    const cmds = commands.filter((c) => c.group === group);
    if (cmds.length === 0) continue;

    for (const c of cmds) {
      options.push({
        value: c.id,
        label: c.danger ? pc.red(c.id) : c.id,
        hint: c.hint ?? c.summary,
      });
    }
  }

  options.push({
    value: 'exit',
    label: pc.dim('exit'),
    hint: 'leave the infra cli',
  });

  return options;
}

const INTRO_LINE = `${pc.bgCyan(pc.black(' infra '))} ${pc.dim('gamezilla · infrastructure')}`;

export async function runInteractive(commands: Command[]): Promise<void> {
  let firstMainMenu = true;
  for (;;) {
    if (!firstMainMenu) {
      clearTerminal();
    }
    firstMainMenu = false;

    const menuOptions = buildSelectOptions(commands);
    const choice = await runSearchableCommandMenu({
      introLine: INTRO_LINE,
      message: 'what would you like to do?',
      baseOptions: menuOptions,
      filterAndSort: sortMenuOptionsBySearch,
    });

    if (choice === null) {
      clearTerminal();
      cancel('bye');
      process.exit(0);
    }

    if (choice === 'exit') {
      clearTerminal();
      outro('done');
      process.exit(0);
    }

    const command = commands.find((c) => c.id === choice);
    if (!command) {
      note('that option is not a command', 'skipped');
      continue;
    }

    if (command.danger) {
      clearTerminal();
      // No is shown first and selected by default (active=No, initialValue=true → value means "No").
      const dangerAnswer = await confirm({
        message: `${pc.bold(command.id)} — this is destructive and will cause downtime — proceed?`,
        active: 'No',
        inactive: 'Yes',
        initialValue: true,
      });

      if (isCancel(dangerAnswer)) {
        clearTerminal();
        cancel('cancelled');
        process.exit(0);
      }

      const proceed = !dangerAnswer;

      if (!proceed) {
        note('skipped — pick another command or exit', pc.dim('○'));
        continue;
      }
    }

    try {
      await Promise.resolve(command.execute());
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log.error(msg);
    }

    const again = await confirm({
      message: 'run another command?',
      initialValue: true,
    });

    if (isCancel(again)) {
      clearTerminal();
      outro('cancelled');
      process.exit(0);
    }

    if (!again) {
      clearTerminal();
      outro("you're all set");
      process.exit(0);
    }
  }
}
