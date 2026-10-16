/** Failure logs retain rendered state even when the PR profile keeps no reports. */
export function browserFailureSummary(html: string): string {
  const controls =
    html.match(/<[^>]*data-testid="multiplayer-[^"]+"[^>]*>/g) ?? [];
  const state = controls.map((tag) =>
    tag.match(/data-(?:testid|game-id|outcome|revision|reason)="[^"]*"/g)
  );
  const waiting = html
    .match(/data-testid="multiplayer-waiting"[^>]*>([\s\S]*?)<\/p>/)?.[1]
    ?.replace(/<[^>]*>/g, ' ');
  return JSON.stringify({
    screen: html.match(/data-screen="([^"]+)"/)?.[1],
    controls: state,
    waiting,
  });
}
