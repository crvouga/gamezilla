# CI repair evidence

PR: <url>; published head: <sha>; tested commit: <sha or merge commit>.

- Failure: <run URL, attempt, job/step, causal error>.
- Fix: <root cause → changed files → why it is correct>.
- Before-fix evidence: <hosted failure or focused failing reproduction>.
- After-fix evidence: <focused commands and results; regression path>.
- Pre-push cache warming: <tasks/profile, remote availability evidence, CI compatibility and any unwarmed scope>.
- Hosted result: <run URL, tested head, completed / pending / blocked>.
- Broader validation: <required or risk-justified checks and outcomes, if any>.
- Remaining blockers: <precise missing evidence, access, approval or failing check>.
- Review notes: <justification for any config, snapshot or other audit finding>.

Claim only what the evidence proves: focused pass, full local pass, PR green,
or ready to merge. Do not use one as evidence for another.
