from pathlib import Path
import json,re,tarfile,hashlib,subprocess
r=Path(__file__).parent;log=(r/'interactions/verify-final.log').read_text();head=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
match=re.search(r'verify: diagnostics archived at (.+)',log)
assert match,'No retained diagnostics path'
p=Path(match[1].strip());rows=[]
with tarfile.open(p,'r:gz') as archive:
 for member in archive:
  row={'archive':'verify-diagnostics.tar.gz (reconstruct ordered parts)','member':member.name,'bytes':member.size,'type':member.type.decode(errors='replace')}
  if member.isfile():
   h=hashlib.sha256();stream=archive.extractfile(member)
   while chunk:=stream.read(1024*1024):h.update(chunk)
   row['sha256']=h.hexdigest()
  rows.append(row)
(r/'interactions/verify-diagnostics-inventory.json').write_text(json.dumps(rows,indent=2)+'\n')
parts=[];whole=hashlib.sha256()
with p.open('rb') as src:
 while chunk:=src.read(50_000_000):
  name=f'verify-diagnostics.tar.gz.part-{len(parts)+1:02d}';(r/'interactions'/name).write_bytes(chunk);whole.update(chunk);parts.append({'file':name,'bytes':len(chunk),'sha256':hashlib.sha256(chunk).hexdigest()})
(r/'interactions/verify-diagnostics-parts.json').write_text(json.dumps({'format':'Concatenate parts in listed order to reconstruct tar.gz','source':str(p),'sha256':whole.hexdigest(),'parts':parts,'memberInventory':'verify-diagnostics-inventory.json'},indent=2)+'\n')
counts=re.findall(r'Tasks:\s+(\d+) successful, (\d+) total',log)
exit_code=int((r/'interactions/verify-final.exit').read_text().strip())
failed_tasks=sorted(set(task for line in re.findall(r'^\s*Failed:\s+(.+)$', re.sub(r'\x1b\[[0-9;]*[A-Za-z]', '', log), re.M) for task in re.findall(r'@[a-zA-Z0-9_/-]+#[a-zA-Z0-9:_-]+',line)))
reason='/more/troubleshooting: no chart state owns the public route from libs/app-root-client-ts/src/route-table.ts'
known=[]
if reason in log:known.append({'task':'@libs/tools-harness-ts#ci:statecharts','message':reason,'scope':'outside game boards; no specs edited'})
for bug in ['account-connect-error-label-clipped','denial-only-explanation-truncated','friend-long-name-escapes-profile','publication-denial-state-clipped','synthetic-population-initial-state-fixture-saveable']:
 if bug in log:known.append({'task':'@libs/tools-harness-ts#ci:goals','registration':bug,'scope':'inherited upstream outside board scope; inspect exact log'})
v={'candidateSha':head,'command':'NODE_OPTIONS=--max-old-space-size=8192 TURBO_CONCURRENCY=1 bun verify','runs':1,'exitCode':exit_code,'status':'passed' if exit_code==0 else 'failed','reportedTaskCounts':[{'successful':int(a),'total':int(b)} for a,b in counts],'reportedFailedTasks':failed_tasks,'knownOutsideBoardFindings':known,'log':'verify-final.log','diagnostics':'verify-diagnostics-parts.json','archiveMembers':len(rows)}
(r/'interactions/full-verify-verdict.json').write_text(json.dumps(v,indent=2)+'\n');print(json.dumps(v,indent=2))
