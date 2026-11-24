/**
 * Lucide ships types only for its barrel; `icons.ts` imports one module per
 * icon, each of which default-exports the icon's shapes.
 */
declare module 'lucide/dist/esm/icons/*.mjs' {
  const shapes: import('lucide').IconNode;
  export default shapes;
}
