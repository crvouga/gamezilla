import { z } from 'zod';
import { activitySchema } from './config';

export const applicationEventSchema = z.object({
  name: z.enum([
    'Authenticated',
    'AuthenticationFailed',
    'OpenedSpaces',
    'CreatedSpace',
    'JoinedSpace',
    'EnteredMatchmaking',
    'GameStarted',
    'MoveSubmitted',
    'GameCompleted',
    'RematchRequested',
    'LoggedOut',
    'RecoveryStarted',
    'SessionRestored',
    'SessionInterrupted',
    'DecisionSelected',
    'StateTransition',
    'UiDriverAction',
  ]),
  activity: activitySchema,
  action: z.string().max(256).nullable(),
  context: z
    .record(
      z.string(),
      z.union([z.string().max(2048), z.number(), z.boolean(), z.null()])
    )
    .default({}),
});
export type ApplicationEvent = z.infer<typeof applicationEventSchema>;
