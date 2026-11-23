/**
 * A device on the search's hub, as its places stand: the clock choices are
 * a place of their own, one row from the hub, and choosing one returns.
 */
export function searchHub(shows: (id: string) => boolean) {
  let place = 'home';
  const pressed: string[] = [];
  const ui = {
    get: (id: string) => ({
      wait: async () => {},
      attribute: async (name: string) =>
        name === 'data-stage' ? 'idle' : place,
      tap: async () => {
        pressed.push(id);
        if (id === 'multiplayer-open-time-control') place = 'time-control';
        if (id.startsWith('multiplayer-time-control-')) place = 'home';
      },
      isVisible: async () =>
        id === 'multiplayer-screen' ||
        (id === 'multiplayer-open-time-control' && place === 'home') ||
        (id.startsWith('multiplayer-time-control-') &&
          place === 'time-control') ||
        shows(id),
    }),
  };
  return { ui, pressed };
}
