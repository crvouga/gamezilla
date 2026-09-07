# CI & Deploy

Run this after every change. It formats the code, runs every check in the
codebase, and deploys. If any step fails, fix the errors and re-run the whole
thing from the top until it passes and is deployed.

1. Run `clear && bun fmt && bun check:full && bun deploy:dev && bun deploy:prd && echo "✅ Deployed"`
2. If any step fails, fix the errors and re-run step 1 until everything passes
3. When everything passes and it is deployed, stage all changes and commit with
   a concise conventional commit message
4. Do NOT commit or deploy if any check is failing
