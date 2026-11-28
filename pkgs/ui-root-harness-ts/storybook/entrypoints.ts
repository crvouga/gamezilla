export const previewAnnotations = [
  'pkgs/chess-board-root-client-ts/src/chess-board/space-preview.example.tsx',
  'apps/product-ts/src/storybook-preview.example.tsx',
  'libs/games-client-ts/src/game-menu-preview.example.tsx',
];

export function isStorybookSource(path: string): boolean {
  return (
    previewAnnotations.includes(path) ||
    path.endsWith('.stories.tsx') ||
    path.endsWith('.example.tsx') ||
    path.includes('/tests/') ||
    path.includes('/storybook/') ||
    path.includes('/scripts/')
  );
}
