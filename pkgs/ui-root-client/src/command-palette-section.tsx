/** @jsxImportSource solid-js */
/**
 * `CommandPaletteSection` -- sticky-looking group header inside the palette
 * list (`Recent`, category names). Rendered as `role="presentation"` so the
 * listbox option count stays clean for assistive tech.
 */

import type { JSX } from 'solid-js';

export type CommandPaletteSectionProps = {
  title: string;
  id?: string | undefined;
};

export function CommandPaletteSection(
  props: CommandPaletteSectionProps
): JSX.Element {
  return (
    <div
      class="box px-3 pt-2 pb-1 bg-background"
      data-component="CommandPaletteSection"
      id={props.id}
      role="presentation"
    >
      <label class="text textLabel text-text-secondary tracking-section">
        {props.title}
      </label>
    </div>
  );
}
