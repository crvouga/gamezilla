from pathlib import Path
import shutil,json
r=Path(__file__).parent
source=Path('pkgs/ui-root-harness-ts/.cache/storybook-test-results')
files=[]
for folder in source.glob('*font-readiness*'):
 for p in folder.rglob('*'):
  if p.is_file() and p.suffix in ['.json','.png']:
   dest=r/'font-readiness'/p.relative_to(source)
   dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,dest);files.append(str(dest.relative_to(r)))
assert files
(r/'interactions/font-evidence-files.json').write_text(json.dumps(files,indent=2)+'\n')
print(len(files),'font evidence files')
