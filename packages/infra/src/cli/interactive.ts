import {
  cancel,
  confirm,
  intro,
  isCancel,
  log,
  note,
  outro,
  select,
} from '@clack/prompts';
import pc from 'picocolors';
import { COMMAND_GROUP_ORDER } from './commands/commands';
import type { Command } from './commands/types';

type SelectValue = string;

/** Clear screen + scrollback (where supported) so each prompt feels like a fresh pane. */
function clearTerminal(): void {
  process.stdout.write('\x1B[3J\x1B[2J\x1B[H');
}

function buildSelectOptions(commands: Command[]): {
  value: SelectValue;
  label?: string;
  hint?: string;
  disabled?: boolean;
}[] {
  const options: {
    value: SelectValue;
    label?: string;
    hint?: string;
    disabled?: boolean;
  }[] = [];

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

export async function runInteractive(commands: Command[]): Promise<void> {
  clearTerminal();
  intro(
    `${pc.bgCyan(pc.black(' infra '))} ${pc.dim('gamezilla · infrastructure')}`,
  );

  let firstMainMenu = true;
  for (;;) {
    if (!firstMainMenu) {
      clearTerminal();
    }
    firstMainMenu = false;

    const choice = await select({
      message: 'what would you like to do?',
      options: buildSelectOptions(commands),
    });

    if (isCancel(choice)) {
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
