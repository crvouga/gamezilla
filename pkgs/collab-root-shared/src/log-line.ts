import type { LocalizedString } from '@pkgs/i18n-shared/localized-string';
import type { RoomActor } from '@pkgs/room-root-shared/types';

/**
 * One projected line of a collaborative event log.
 * Produced by a pure projection over committed {@link LogEntry}s — never stored.
 */
export type LogLine = {
  readonly seq: number;
  readonly ts: number;
  readonly actor: RoomActor | null;
  readonly text: LocalizedString;
  /** Optional icon glyph name for the UI to resolve. */
  readonly icon?: string;
  /**
   * Keys of UI surfaces this event "touched". Used by attribution
   * highlighting (last actor per key wins).
   */
  readonly targetKeys?: readonly string[];
};

/** Draft returned by a describe-router handler before seq/ts/actor are filled. */
export type LogLineDraft = {
  readonly text: LocalizedString;
  readonly icon?: string;
  readonly targetKeys?: readonly string[];
};

/**
 * Context handed to describe routers. Sub packages can extend via
 * intersection when they need profile lookups etc.
 */
export type LogLineContext = {
  readonly resolveParticipantLabel?: (actorId: string) => LocalizedString;
};
