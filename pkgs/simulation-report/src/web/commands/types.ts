export type CommandSection = 'Playback' | 'Navigation' | 'Runs' | 'General';

export type Command = {
  readonly id: string;
  readonly label: string;
  readonly section: CommandSection;
  /** Display string e.g. "Space", "⌘K", "→" */
  readonly shortcut?: string;
  /** KeyboardEvent matcher when palette closed */
  readonly match?: (e: KeyboardEvent) => boolean;
  readonly when?: () => boolean;
  readonly run: () => void;
};
