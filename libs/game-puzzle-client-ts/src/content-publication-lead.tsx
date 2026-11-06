import { type Accessor, createContext, type JSX, useContext } from 'solid-js';

/**
 * Where a builder draws its one next action instead of over the publish
 * steps: on a phone, the screen's title row, so the action is in the first
 * screen while the steps keep their place, in order, after the stage.
 */
export type PublicationLeadSlot = {
  /** The lead belongs in the slot now; otherwise it stays over the steps. */
  readonly active: Accessor<boolean>;
  /** Draws the lead in the slot, or clears it with `undefined`. */
  readonly show: (lead: JSX.Element) => void;
};

const PublicationLeadContext = createContext<PublicationLeadSlot>();

export const PublicationLeadProvider = PublicationLeadContext.Provider;

export function usePublicationLeadSlot(): PublicationLeadSlot | undefined {
  return useContext(PublicationLeadContext);
}
