/** Composition alone chooses which definition owns the stored unprefixed namespace. */
export function assertGameNamespaceOwner(
  games: readonly {
    readonly id: string;
    readonly registration: { readonly unprefixedNamespace?: true };
  }[],
  owner: { readonly id: string }
): void {
  for (const game of games)
    if (game.registration.unprefixedNamespace === true && game !== owner)
      throw new Error(
        `game registry: "${game.id}" claims the unprefixed namespace owned by "${owner.id}" — use its own namespaced clock and puzzle identities`
      );
}
