import { type JSX, Dynamic } from '@solidjs/web';
import { type Component, createContext, Show, useContext } from 'solid-js';

const SpaceOfferContext = createContext<Component | null>(null);

/**
 * What a space offers over whatever it shows, supplied by a sub that knows
 * more than spaces does (such as the way back to an unfinished game played
 * elsewhere). Spaces only gives it its place.
 */
export function SpaceOfferProvider(props: {
  readonly offer: Component;
  readonly children: JSX.Element;
}): JSX.Element {
  return (
    <SpaceOfferContext value={props.offer}>
      {props.children}
    </SpaceOfferContext>
  );
}

/** The space's offer, at the top of what it shows; nothing when none is supplied. */
export function SpaceOffer(): JSX.Element {
  const offer = useContext(SpaceOfferContext);
  return (
    <Show when={offer}>
      <Dynamic component={offer ?? undefined} />
    </Show>
  );
}
