import { Command } from 'cmdk';
import { Search } from 'lucide-react';

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
  if (!paletteOpen) return null;

  const grouped = groupBySection(commands);

  return (
    <div className="cmdk-overlay" role="presentation">
      <button
        type="button"
        className="cmdk-backdrop"
        aria-label="Close command palette"
        onClick={() => setPaletteOpen(false)}
      />
      <Command
        className="cmdk-root"
        label="Command palette"
        onKeyDown={(e) => {
          if (e.key === 'Escape') setPaletteOpen(false);
        }}
      >
        <div className="cmdk-input-row">
          <Search size={16} aria-hidden />
          <Command.Input placeholder="Type a command…" autoFocus />
        </div>
        <Command.List>
          <Command.Empty>No matching commands</Command.Empty>
          {[...grouped.entries()].map(([section, list]) =>
            list.length === 0 ? null : (
              <Command.Group key={section} heading={section}>
                {list.map((cmd) => (
                  <Command.Item
                    key={cmd.id}
                    value={`${cmd.label} ${cmd.id}`}
                    onSelect={() => {
                      run(cmd.id);
                      setPaletteOpen(false);
                    }}
                  >
                    <span>{cmd.label}</span>
                    {cmd.shortcut ? (
                      <kbd className="cmdk-kbd">{cmd.shortcut}</kbd>
                    ) : null}
                  </Command.Item>
                ))}
              </Command.Group>
            )
          )}
        </Command.List>
      </Command>
    </div>
  );
}
