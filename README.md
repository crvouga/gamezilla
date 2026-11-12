# archive

Never merged. Health branch maintenance makes the tip of every unmerged branch it
deletes a parent of a commit here, so SHA-pinned screenshot links and abandoned
work stay reachable after the branch is gone.

Find a deleted branch's tip: `git log --merges --format='%s %p' origin/archive`.
Restore it: `git push origin <tip-sha>:refs/heads/<name>`.
