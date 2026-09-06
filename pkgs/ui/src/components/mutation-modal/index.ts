// Lifecycle primitives live in `../button` (shared with `useMutationButton`);
// re-exported here so the mutation-modal surface keeps its RN-era entrypoint.
export {
  type MutationPhase,
  type MutationStateTransition,
  mutationPhaseFromStatus,
  type UseMutationLifecycleParams,
  type UseMutationLifecycleResult,
  useMutationLifecycle,
} from '../button';
export {
  MutationModal,
  type MutationModalProps,
  resolveMutationSurfaceClose,
} from './mutation-modal';
export {
  MUTATION_STATE_AREA_HEIGHT,
  type MutationModalIds,
  type MutationModalLabels,
} from './mutation-modal-parts';
