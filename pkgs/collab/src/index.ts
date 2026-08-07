export {
  type AttributionHit,
  deriveAttribution,
} from './shared/attribution/derive-attribution';
export type {
  LogLine,
  LogLineContext,
  LogLineDraft,
} from './shared/event-log/log-line';
export type { EventLogRouter } from './shared/event-log/log-router';
export { projectEventLog } from './shared/event-log/project-event-log';
export {
  assignParticipantColors,
  PARTICIPANT_COLOR_PALETTE,
  type ParticipantColor,
  resolveParticipantColor,
} from './shared/participant-color/participant-color';
export {
  groupRosterByParticipant,
  type ParticipantPresence,
} from './shared/presence/group-roster';
