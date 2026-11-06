# Storybook coverage

Initial audit:272 violations (181 missing baselines,72 orphan baselines,19 authoring errors). The board-owned18 authoring errors are fixed:9 generated manifest errors,8 preview helper classification errors,1 missing component contract description. A literal nine-story manifest regression failed on the old artifact and passed after the rebuilt repair. Owning checks23/23 and ci:goals passed.

After repair:254 violations remain:181 missing baselines (7 in this board selection, pending Ubuntu reference review),72 orphan baselines outside this selection, and1 unchanged generic puzzle-screen metadata issue outside board scope. No coverage check was disabled and no reference was deleted or accepted merely to silence coverage. The final audit and reference selection may change the missing count; report their actual results.
