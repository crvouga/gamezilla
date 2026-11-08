# Connect Four board readiness

This game-owned record supplies the Connect Four update for the coordinated
[self-service readiness matrix](../../docs/SELF_SERVICE_READINESS.md).

| Journey | Failure or confusion | Resolution | Automated evidence | Remaining limitation |
| --- | --- | --- | --- | --- |
| Keep a keyboard destination while using the pointer | Moving off a hovered column erased the landing preview of a different, still-focused column | Pointer hover and keyboard focus have independent lifetimes; leaving hover restores the focused destination | `pkgs/ui-root-harness-ts/tests/disc-drop-focus-preview.test.tsx`; `product-discdropboard--keyboard-and-pointer` | DOM regression passed; current browser, video and assistive-technology evidence pending |
| Activate the intended column with Enter or Space | A resting pointer could preview a different column from the keyboard's action | Keyboard activation restores the focused destination before the native button action | `pkgs/ui-root-harness-ts/tests/disc-drop-focus-preview.test.tsx`; `product-discdropboard--keyboard-and-pointer` | Native-browser confirmation pending |
| Recover from a full column | A refused drop left the generic instruction visible | Targeting a full column says it is full and asks the player to choose another; the position is preserved | `pkgs/ui-root-harness-ts/tests/disc-drop-focus-preview.test.tsx`; `screens-games-connect-four-board--full-column` | DOM regression passed; current browser and translated layout evidence pending |
| Drop, reject a full column, inspect a result, or watch | Current review evidence must cover input and inactive states at every supported size | Dedicated automated Storybook evidence suite records the same journeys, target geometry and axe results | `pkgs/ui-root-harness-ts/tests/storybook/connect-four/integration.checks.ts` | Hosted capture blocked by shared diagnostic prerequisites; no completed browser audit claimed |

The input fix preserves the position and legal-action guard. It adds no network
operation or retry path. Shared game-session recovery remains owned by the game
session components and their specifications. No support step is introduced.

Performance and readiness are unproven until the complete required gate and both
independent reviews pass on the same candidate. Synthetic CPU throttling cannot
establish physical-device latency or native-platform builds.
