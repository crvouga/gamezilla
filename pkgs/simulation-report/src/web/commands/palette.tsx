import { Command } from 'cmdk';
import { Search } from 'lucide-react';
import { useState } from 'react';

import { merge, styles } from '../theme';
import { useCommands } from './registry';
import type { Command as AppCommand, CommandSection } from './types';

const SECTION_ORDER: readonly CommandSection[] = [
  'Playback',
  'Navigation',
  'Runs',
  'General',
];

function groupBySection(
  commands: readonly AppCommand[]
): Map<CommandSection, AppCommand[]> {
  const map = new Map<CommandSection, AppCommand[]>();
  for (const section of SECTION_ORDER) map.set(section, []);
  for (const cmd of commands) {
    if (cmd.when && !cmd.when()) continue;
    const list = map.get(cmd.section) ?? [];
    list.push(cmd);
    map.set(cmd.section, list);
  }
  return map;
}

export function CommandPalette() {
  const { commands, paletteOpen, setPaletteOpen, run } = useCommands();
  const [value, setValue] = useState('');
  if (!paletteOpen) return null;

  const grouped = groupBySection(commands);

  return (
    <div style={styles.cmdkOverlay} role="presentation">
      <button
        type="button"
        style={styles.cmdkBackdrop}
        aria-label="Close command palette"
        onClick={() => setPaletteOpen(false)}
      />
      <Command
        label="Command palette"
        value={value}
        onValueChange={setValue}
        style={styles.cmdkRoot}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setPaletteOpen(false);
        }}
      >
        <div style={styles.cmdkInputRow}>
          <Search size={16} aria-hidden />
          <Command.Input
            placeholder="Type a command…"
            autoFocus
            style={styles.cmdkInput}
          />
        </div>
        <Command.List style={styles.cmdkList}>
          <Command.Empty style={styles.cmdkEmpty}>
            No matching commands
          </Command.Empty>
          {[...grouped.entries()].map(([section, list]) =>
            list.length === 0 ? null : (
              <Command.Group
                key={section}
                heading={<div style={styles.cmdkGroupHeading}>{section}</div>}
              >
                {list.map((cmd) => {
                  const itemValue = `${cmd.label} ${cmd.id}`;
                  const selected = value === itemValue;
                  return (
                    <Command.Item
                      key={cmd.id}
                      value={itemValue}
                      style={merge(
                        styles.cmdkItem,
                        selected && styles.cmdkItemSelected
                      )}
                      onSelect={() => {
                        run(cmd.id);
                        setPaletteOpen(false);
                      }}
                    >
                      <span>{cmd.label}</span>
                      {cmd.shortcut ? (
                        <kbd style={styles.cmdkKbd}>{cmd.shortcut}</kbd>
                      ) : null}
                    </Command.Item>
                  );
                })}
              </Command.Group>
            )
          )}
        </Command.List>
      </Command>
    </div>
  );
}
