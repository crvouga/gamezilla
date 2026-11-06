# Hosted safety

Candidate `897a7562d2fee9d4cec187281ac84119de322c05`, Verify PR run https://github.com/crvouga/gamezilla/actions/runs/42255284297 : verify:end failed. Shard 0 failed the release journey “Offline Numberlink authoring and play are shared when the connection returns”: open-numberlink-library-after-space-navigation timed out before the library or game choice opened. Cleanup also could not find nav-back. Shards 1–3 passed. Logs: hosted-final-failed.log; exact statuses: pr-final-status.json.

This is an outstanding hosted failure outside the board-only interaction scope. Its cause has not been established here; it is not labeled a flaky or proven pre-existing failure and has not been retried. No navigation, sync or spec behavior was changed to silence it.

The prior candidate failed the chess contract-proof typecheck and Quoridor party move 10. Both were reproduced and repaired; the focused 12-task lint/type/test run, including the real-board Hill party contract, passed. See hosted-repair-focused.log and the literal red regression logs.
