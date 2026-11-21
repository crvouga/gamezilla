You are starting a design-system editing session in this repository.

Before anything else:

1. Read `CLAUDE.md` (its "UI source of truth" and "Changing the design
   system" sections), then `design-system/README.md`,
   `design-system/spaces.md` and `design-system/tokens.json`.
2. Ask me for a short topic for this change, then create or switch to the
   branch `design/<topic>` (kebab-case). If the current branch is already a
   `design/` branch, ask whether to keep it.
3. Start Storybook in the background with `bun run design:story` and tell me
   its URL once it is up.
4. Ask me what I want to change.

The rules for this session:

- The repository is the only place the design system is edited: change
  `design-system/` and the components in `pkgs/ui-root-client-ts`. Never
  edit the Gamezilla artifact on claude.ai; it is republished from the code
  by `bun run design:sync` after the pull request merges.
- Use tokens only: no raw colors, pixel values, radii or font names outside
  the generated token files.
- Never update visual baselines unless I ask you to in this session. A
  failing visual test is a finding to report, not something to re-record.
- The change is done when `bun run design:check` passes. Then open a pull
  request from the `design/<topic>` branch; never push to `main`.
