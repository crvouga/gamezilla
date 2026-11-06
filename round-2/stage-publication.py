from pathlib import Path
import shutil
r=Path(__file__).parent
dest=Path('/Users/chrisvouga/gamezilla/.git/worktrees/t3-cdbe42ba/overhaul/ui-ux-overhaul/evidence-tree/round-2')
dest.mkdir(parents=True,exist_ok=True)
for p in r.iterdir():
    if p.is_file() and p.name!='WORKING_STATE.md':shutil.copy2(p,dest/p.name)
for name in ['before','after','pairs','journeys']:
    shutil.copytree(r/name,dest/name,dirs_exist_ok=True)
shutil.copytree(r/'ubuntu',dest/'ubuntu',dirs_exist_ok=True,ignore=shutil.ignore_patterns('staged','diagnostics','commit-paths.nul'))
(dest/'interactions').mkdir(exist_ok=True)
for p in (r/'interactions').iterdir():
    if p.is_file() and p.suffix in ['.log','.json','.md'] and p.stat().st_size<15_000_000:
        shutil.copy2(p,dest/'interactions'/p.name)
for name in ['final-head','initial-candidate']:
    (dest/'interactions'/name).mkdir(exist_ok=True)
    for p in (r/'interactions'/name).iterdir():
        if p.is_file() and p.suffix in ['.log','.json','.md'] and p.stat().st_size<15_000_000:
            shutil.copy2(p,dest/'interactions'/name/p.name)
large=[str(p) for p in dest.rglob('*') if p.is_file() and p.stat().st_size>95_000_000]
if large:raise Exception('Oversized publication files: '+str(large))
if list(dest.rglob('.git')):raise Exception('Nested git metadata must never be published')
print('Staged',len([p for p in dest.rglob('*') if p.is_file()]),'evidence files')
