from pathlib import Path
import shutil,gzip,hashlib,json
r=Path(__file__).parent
dest=Path('/Users/chrisvouga/gamezilla/.git/worktrees/t3-cdbe42ba/overhaul/ui-ux-overhaul/evidence-tree/round-7')
dest.mkdir(parents=True,exist_ok=True)
for p in r.iterdir():
 if p.is_file() and p.name!='WORKING_STATE.md':shutil.copy2(p,dest/p.name)
for name in ['before','after','pairs','journeys','font-readiness','implementation']:
 shutil.copytree(r/name,dest/name,dirs_exist_ok=True)
large_sources=[]
for p in (r/'ubuntu').rglob('*'):
 if not p.is_file() or any(x in p.parts for x in ['staged','diagnostics','.git']):continue
 target=dest/p.relative_to(r);target.parent.mkdir(parents=True,exist_ok=True)
 if p.stat().st_size>15_000_000 and '.gz' not in p.name:
  target=target.with_suffix(target.suffix+'.gz')
  with p.open('rb') as src,gzip.open(target,'wb') as dst:shutil.copyfileobj(src,dst)
  large_sources.append({'source':str(p.relative_to(r)),'sourceSha256':hashlib.sha256(p.read_bytes()).hexdigest(),'published':str(target.relative_to(dest)),'publishedSha256':hashlib.sha256(target.read_bytes()).hexdigest(),'publishedBytes':target.stat().st_size})
 else:shutil.copy2(p,target)
(dest/'compressed-sources.json').write_text(json.dumps(large_sources,indent=2)+'\n')
for p in (r/'interactions').rglob('*'):
 if p.is_file():
  target=dest/p.relative_to(r);target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,target)
large=[str(p) for p in dest.rglob('*') if p.is_file() and p.stat().st_size>95_000_000]
assert not large,large
assert not list(dest.rglob('.git'))
print('Staged',len([p for p in dest.rglob('*') if p.is_file()]),'evidence files')
