from pathlib import Path
import tarfile,zipfile,hashlib,json,gzip
r=Path(__file__).parent
rows=[]
def digest(stream):
 h=hashlib.sha256()
 while b:=stream.read(1024*1024):h.update(b)
 return h.hexdigest()
for p in sorted(r.rglob('*')):
 if not p.is_file():continue
 rel=str(p.relative_to(r))
 if p.name.endswith(('.tar.gz','.tgz','.tar')):
  with tarfile.open(p) as archive:
   for member in archive:
    row={'archive':rel,'member':member.name,'bytes':member.size,'type':member.type.decode(errors='replace')}
    if member.isfile():row['sha256']=digest(archive.extractfile(member))
    rows.append(row)
 elif p.suffix=='.zip':
  with zipfile.ZipFile(p) as archive:
   for member in archive.infolist():
    row={'archive':rel,'member':member.filename,'bytes':member.file_size}
    if not member.is_dir():row['sha256']=digest(archive.open(member))
    rows.append(row)
 elif p.suffix=='.gz':
  with gzip.open(p,'rb') as stream:rows.append({'archive':rel,'member':p.stem,'sha256':digest(stream)})
for inventory in (r/'interactions').rglob('verify-diagnostics-inventory.json'):
 for row in json.loads(inventory.read_text()):
  row['archive']=str(inventory.parent.relative_to(r))+'/'+row['archive']
  rows.append(row)
for metadata in r.rglob('*.log.archive.json'):
 x=json.loads(metadata.read_text());rows.append({'archive':str(metadata.relative_to(r)),'member':x['originalLog'],'bytes':x['originalBytes'],'sha256':x['originalSha256'],'parts':x['parts']})
(r/'archive-inventory.json').write_text(json.dumps(rows,indent=2)+'\n')
print(len(rows),'archive members indexed; no extraction into production paths')
