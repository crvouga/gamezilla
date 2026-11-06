from pathlib import Path
import subprocess, re, json, hashlib, shutil
from PIL import Image, ImageDraw, ImageFont

root=Path.cwd()
out=root/'.overhaul-evidence/ui-ux-overhaul/round-3/candidate-4c0543986/ubuntu'
stage=out/'staged'
patch=root/'.cache/verify-nightly/storybook-baselines.patch'
paths=re.findall(r'^diff --git a/(.+) b/.+$',patch.read_text(),re.M)
if not paths: raise Exception('Empty reference patch')
out.mkdir(exist_ok=True)
stage.mkdir(exist_ok=True)
subprocess.run(['git','init','-q',str(stage)],check=True)
for name in paths:
    if not re.match(r'^(libs|pkgs)/[^/]+/src/.*/?baselines/chromium/.+\.png$',name):
        raise Exception('Unexpected patch path '+name)
    src=root/name;dest=stage/name
    dest.parent.mkdir(parents=True,exist_ok=True)
    if src.exists():shutil.copy2(src,dest)
subprocess.run(['git','apply','--check',str(patch)],cwd=stage,check=True)
subprocess.run(['git','apply',str(patch)],cwd=stage,check=True)
records=[]
for name in paths:
    p=stage/name
    records.append({'path':name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest() if p.exists() else None,
                    'beforeSha256':hashlib.sha256((root/name).read_bytes()).hexdigest() if (root/name).exists() else None})
(out/'patch-inventory.json').write_text(json.dumps(records,indent=2)+'\n')
# Each sheet is an actual reference review aid, not a manual product QA pass.
groups={}
for name in paths:
    p=stage/name
    if p.exists():groups.setdefault(p.parent.name,[]).append(p)
sheets=out/'contact-sheets';sheets.mkdir(exist_ok=True)
font=ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc',16)
index=[]
for group,files in sorted(groups.items()):
    files=sorted(files)
    for start in range(0,len(files),12):
        batch=files[start:start+12];sheet=Image.new('RGB',(1280,1800),'#dedede');d=ImageDraw.Draw(sheet)
        d.text((10,8),f'{group} ({start+1}–{start+len(batch)})',font=font,fill='black')
        for i,p in enumerate(batch):
            x=(i%4)*320;y=40+(i//4)*580
            d.text((x+5,y),p.name[:38],font=font,fill='black')
            im=Image.open(p).convert('RGB');im.thumbnail((310,550))
            sheet.paste(im,(x+5,y+25))
        file=f'{group}-{start//12+1:02}.jpg';sheet.save(sheets/file,quality=88)
        index.append({'file':file,'references':[str(p.relative_to(stage)) for p in batch]})
(out/'contact-sheet-index.json').write_text(json.dumps(index,indent=2)+'\n')
print(len(paths),'references;',len(index),'contact sheets')
