/**
 * What proves each entry of `specs/conformance.yaml` — binding-side
 * knowledge the manifest may not name (specs/README.md D1). The manifest says
 * *what* must be proven; this says *which* spec files, checks and report lines
 * prove it. `@libs/tools#ci:conformance` (`check-conformance.ts`) requires the two to
 * name exactly the same ids and every proof here to be automated: a spec that
 * exists and is bound, a package task in the Check task list runs, a live spec `health` runs, a
 * report line that is fed.
 *
 *   { spec }  a spec file a package runs against its harness in `bun check-pr`
 *   { live }  a spec file `@apps/product`'s `health` runs against a deployment
 *   { task }  a package-scoped Turbo task in the Check task list
 *   { kind }  every spec of a kind — at least one, each bound
 *   { line }  a line of `bun run conformance`'s pipeline (`lines.ts`)
 */

import type {
  EvidenceMap,
  Proof,
  ProofTable,
} from '@pkgs/conformance-shared/proofs';

import { LINES } from './lines';

/** Where the product must behave as specified, and what runs it there. */
const ENVIRONMENTS: ProofTable = {
  "a phone's web browser": [
    // The critical journeys in a real browser against the deployment, and
    // every behavior spec against the assembled app in `bun check-pr`.
    { live: 'specs/journeys/critical-journeys.feature' },
    { spec: 'specs/journeys/critical-journeys.feature' },
    { kind: 'behavior' },
  ],
  "a tablet's web browser": [
    { spec: 'specs/runtime/device-layouts.feature' },
    { kind: 'behavior' },
  ],
  "a computer's web browser": [
    { spec: 'specs/runtime/device-layouts.feature' },
    { kind: 'behavior' },
  ],
  'touch and pointer': [
    { spec: 'specs/runtime/device-layouts.feature' },
    { spec: 'specs/runtime/accessibility.feature' },
  ],
  'portrait and landscape': [{ spec: 'specs/runtime/device-layouts.feature' }],
  'keyboard and listening': [{ spec: 'specs/runtime/accessibility.feature' }],
  online: [
    { spec: 'specs/sync-engine/notes-across-devices.feature' },
    { spec: 'specs/sync-engine/notes-arrive-quickly.feature' },
    { spec: 'specs/spaces/space-live-presence.feature' },
    { spec: 'specs/runtime/connection-restore.feature' },
  ],
  offline: [
    { spec: 'specs/runtime/offline-open.feature' },
    { spec: 'specs/sync-engine/notes-offline.feature' },
    { spec: 'specs/sync-engine/a-long-time-offline.feature' },
    { spec: 'specs/sync-engine/online-only-actions.feature' },
    { spec: 'specs/chess/puzzle-offline.feature' },
    { spec: 'specs/billing/billing-offline-grace.feature' },
    { spec: 'specs/profile/offline-sign-in.feature' },
    { spec: 'specs/friends/social-needs-connection.feature' },
    { spec: 'specs/spaces/space-needs-connection.feature' },
  ],
  'an app one version behind': [
    { spec: 'specs/runtime/app-updates.feature' },
    { spec: 'specs/sync-engine/notes-across-app-updates.feature' },
  ],
  // Every message the app shows is in its one catalog (the i18n gate).
  English: [{ task: '@libs/tools#ci:i18n' }],
  UTC: [
    { spec: 'specs/chess/daily-puzzle-limit.dmn' },
    { spec: 'specs/chess/puzzle-limits-by-kind.feature' },
  ],
};

/** Promises to people outside the product, and the specs that keep them. */
const PUBLIC_CONTRACTS: ProofTable = {
  'durable matchmaking outcomes': [
    { spec: 'specs/matchmaking/search-identity.feature' },
    { spec: 'specs/matchmaking/lasting-outcomes.feature' },
    { spec: 'specs/matchmaking/waits-after-time-away.feature' },
    { spec: 'specs/matchmaking/competing-waits.feature' },
    { spec: 'specs/matchmaking/matching.qnt' },
  ],
  'private multiplayer games': [
    { spec: 'specs/chess/play-multiplayer-chess.feature' },
    { spec: 'specs/chess/multiplayer-recovery-and-privacy.feature' },
    { spec: 'specs/chess/multiplayer-games.als' },
    { spec: 'specs/chess/multiplayer.qnt' },
    { spec: 'specs/chess/multiplayer-ready.openslo.yaml' },
  ],
  'reusable chessboard': [
    { spec: 'specs/chess-board/board-authority.feature' },
    { spec: 'specs/chess-board/board-sound.feature' },
    { spec: 'specs/chess-board/board-motion.feature' },
    { spec: 'specs/chess-board/board-accessibility.feature' },
    { spec: 'specs/chess-board/board-opening.feature' },
    { spec: 'specs/chess-board/board-feedback.feature' },
    { spec: 'specs/chess-board/board-lifecycle.qnt' },
    { spec: 'specs/chess-board/board-interaction.feature' },
    { spec: 'specs/chess-board/board-special-moves.feature' },
    { spec: 'specs/chess-board/board-promotion.feature' },
    { spec: 'specs/chess-board/board-black-promotion.feature' },
    { spec: 'specs/chess-board/board-options.feature' },
    { spec: 'specs/chess-board/board-annotations.feature' },
    { spec: 'specs/chess-board/board-premoves.feature' },
    { spec: 'specs/chess-board/board-independence.feature' },
    { spec: 'specs/chess-board/board-promotion.qnt' },
    { spec: 'specs/chess-board/board-options.qnt' },
    { spec: 'specs/chess-board/board-annotations.qnt' },
    { spec: 'specs/chess-board/board-premoves.qnt' },
    { spec: 'specs/chess-board/board-keyboard.qnt' },
    { spec: 'specs/chess-board/board-independence.qnt' },
    { spec: 'specs/chess/puzzle-sound.feature' },
    { spec: 'specs/chess/puzzle-sound.qnt' },
    { task: '@pkgs/chess-board-root-client#test' },
    { task: '@pkgs/chess-board-root-harness#test:contract' },
    { task: '@pkgs/chess-board-root-harness#check:models' },
    { task: '@pkgs/chess-board-core-shared#test' },
    { task: '@libs/chess-shared-client#check:board-contract' },
    { task: '@libs/chess-custom-game-client#check:board-contract' },
    { task: '@libs/chess-matchmaking-client#check:board-contract' },
    { task: '@libs/chess-puzzle-client#check:board-contract' },
  ],
  'account privacy': [
    { spec: 'specs/profile/account-deletion.feature' },
    { spec: 'specs/profile/personal-data-export.feature' },
    { spec: 'specs/profile/personal-data-retention.feature' },
    { spec: 'specs/billing/deleted-account-payments.feature' },
    { spec: 'specs/runtime/privacy-retention.feature' },
  ],
  'test worlds and checkpoints': [
    { spec: 'specs/developer-tools/test-world-views.feature' },
    { spec: 'specs/developer-tools/checkpoints.feature' },
  ],
  'data notebooks': [{ spec: 'specs/developer-tools/data-notebook.feature' }],
  'release checks': [{ spec: 'specs/developer-tools/release-check.feature' }],
  'space links': [
    { spec: 'specs/spaces/space-links.feature' },
    { spec: 'specs/spaces/space-guest-link-join.feature' },
  ],
  'app addresses': [
    { spec: 'specs/runtime/app-addresses.feature' },
    { live: 'specs/runtime/reaching-the-app.feature' },
  ],
  'older apps': [
    { spec: 'specs/runtime/app-updates.feature' },
    { spec: 'specs/sync-engine/notes-across-app-updates.feature' },
  ],
  'health report': [
    { live: 'specs/runtime/serving-people.feature' },
    { live: 'specs/runtime/availability.openslo.yaml' },
  ],
};

/** Evidence about how the product is built: each an existing, gating check. */
const RELEASE_GATES: ProofTable = {
  'dependency vulnerabilities': [{ task: '@libs/tools#ci:audit' }],
  'dependency consistency': [{ task: '@libs/tools#ci:syncpack' }],
  'leaked secrets': [{ task: '@libs/tools#check:secrets' }],
  // The secrets registry agrees with what the infrastructure writes, and a
  // live environment has what it needs to use every outside service.
  'settings the app needs': [
    { task: '@libs/secrets-shared#test' },
    { live: 'specs/runtime/connected-services.feature' },
  ],
  'release artifact limits': [
    { task: '@apps/auth-relay#check:worker-bundle' },
    { task: '@apps/product#check:worker-bundle' },
  ],
  'offline start': [{ task: '@apps/product#check:offline-shell' }],
  'database evolution': [
    { task: '@libs/runtime-server#check:schema-evolution' },
  ],
  // `lint-tofu.ts`: tofu validate, tflint and the policy's conftest suite.
  'infrastructure policy': [{ task: '@libs/infra-shared#lint' }],
  'workflow validity': [{ task: '@libs/tools#check:actionlint' }],
  'type safety': [{ task: 'tc' }],
  lint: [{ task: 'lint' }, { task: '@libs/tools#check:root-lint' }],
};

const line = (id: keyof typeof LINES): Proof => ({ line: id });

/** Each evidence class a release needs, as the report lines that decide it. */
const PRODUCTION_READINESS: ProofTable = {
  'specification validity': [
    line('manifest'),
    line('decision-analysis'),
    line('model-checking'),
    line('structure-checking'),
    line('objective-validity'),
  ],
  'implementation conformance': [
    line('decision-conformance'),
    line('trace-conformance'),
    line('structural-conformance'),
  ],
  'permission enforcement': [
    line('permission-enforcement'),
    line('permission-coverage'),
  ],
  'assembled system acceptance': [line('acceptance'), line('journeys')],
  'accessibility conformance': [line('accessibility')],
  'production-safe synthetics': [line('synthetics')],
  'quality objectives': [line('harness-objectives'), line('live-objectives')],
  'release engineering gates': [line('release-gates')],
  completeness: [
    line('capabilities'),
    line('permission-coverage'),
    line('adapters'),
    line('conformance-checks'),
  ],
};

/** The behavior specs that are the accessibility kind of spec. */
const ACCESSIBILITY: readonly string[] = [
  'specs/runtime/accessibility.feature',
  'specs/chess/puzzle-assistant-accessibility.feature',
];

/** Every release gate's checks, as one list (what the release-gates line reads). */
export const RELEASE_GATE_TASKS: readonly string[] = [
  ...new Set(
    Object.values(RELEASE_GATES).flatMap((proofs) =>
      proofs.flatMap((proof) => ('task' in proof ? [proof.task] : []))
    )
  ),
];

export const EVIDENCE_MAP: EvidenceMap = {
  environments: ENVIRONMENTS,
  'public contracts': PUBLIC_CONTRACTS,
  'release gates': RELEASE_GATES,
  'production readiness': PRODUCTION_READINESS,
  lines: Object.fromEntries(
    Object.entries(LINES).map(([id, definition]) => [
      id,
      id === 'release-gates'
        ? RELEASE_GATE_TASKS.map((task) => ({ task }))
        : definition.feeds,
    ])
  ),
  accessibility: ACCESSIBILITY,
};
