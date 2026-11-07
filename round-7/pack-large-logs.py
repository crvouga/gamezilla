from pathlib import Path
import gzip,hashlib,json,shutil
r=Path(__file__).parent
for p in sorted(r.rglob('*.log')):
 if p.stat().st_size<=20_000_000:continue
 original=hashlib.sha256();size=p.stat().st_size;compressed=p.with_suffix(p.suffix+'.gz')
 with p.open('rb') as src,gzip.open(compressed,'wb') as dst:
  while chunk:=src.read(1024*1024):original.update(chunk);dst.write(chunk)
 check=hashlib.sha256()
 with gzip.open(compressed,'rb') as src:
  while chunk:=src.read(1024*1024):check.update(chunk)
 assert check.hexdigest()==original.hexdigest()
 parts=[];whole=hashlib.sha256()
 with compressed.open('rb') as src:
  while chunk:=src.read(50_000_000):
   part=compressed.with_name(compressed.name+f'.part-{len(parts)+1:02d}');part.write_bytes(chunk);whole.update(chunk);parts.append({'file':part.name,'bytes':len(chunk),'sha256':hashlib.sha256(chunk).hexdigest()})
 p.with_suffix(p.suffix+'.archive.json').write_text(json.dumps({'originalLog':str(p.relative_to(r)),'originalBytes':size,'originalSha256':original.hexdigest(),'compression':'gzip; concatenate parts in order then decompress','compressedSha256':whole.hexdigest(),'parts':parts,'roundTripVerified':True},indent=2)+'\n')
 compressed.unlink();p.unlink();print('Losslessly packed',p,size)
