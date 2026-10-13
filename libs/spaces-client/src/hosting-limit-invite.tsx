import type { Decision } from '@pkgs/permissions-shared/decision';
import {
  type Accessor,
  createContext,
  createSignal,
  type JSX,
  useContext,
} from 'solid-js';

type HostingLimitInvite = {
  readonly decision: Accessor<Decision | null>;
  readonly refuse: (decision: Decision) => void;
  readonly clear: () => void;
};

const Ctx = createContext<HostingLimitInvite | null>(null);

/** Membership can render outside a spaces session, where no invitation exists. */
const absentInvite: HostingLimitInvite = {
  decision: () => null,
  refuse: () => undefined,
  clear: () => undefined,
};

/**
 * A refused second space keeps its invitation to Plus after the person
 * leaves the lobby. The refusal belongs to this device's session.
 * Finishing checkout, or ending a space, answers it.
 */
export function HostingLimitInviteProvider(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  const [decision, setDecision] = createSignal<Decision | null>(null);
  const invite: HostingLimitInvite = {
    decision,
    refuse: (next) => setDecision(next),
    clear: () => setDecision(null),
  };
  return <Ctx.Provider value={invite}>{props.children}</Ctx.Provider>;
}

export function useHostingLimitInvite(): HostingLimitInvite {
  return useContext(Ctx) ?? absentInvite;
}
