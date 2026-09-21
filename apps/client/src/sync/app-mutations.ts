/**
 * Client view of the product mutation registry. Loaded with the first sync
 * engine so mutation bodies stay off the initial chunk; the list itself lives
 * in the composition root's feature fold.
 */
export { loadAppMutations } from '@libs/runtime/root/app-mutations';
