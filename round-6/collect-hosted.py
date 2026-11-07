from pathlib import Path
import subprocess,json,re
r=Path(__file__).parent
head=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
def get(args):return json.loads(subprocess.check_output(['gh',*args],text=True))
p=get(['pr','view','280','--repo','crvouga/gamezilla','--json','headRefOid,isDraft,statusCheckRollup,url'])
assert p['headRefOid']==head
(r/'interactions/pr-final-status.json').write_text(json.dumps(p,indent=2)+'\n')
runs={re.search(r'/actions/runs/(\d+)',x.get('detailsUrl','')).group(1) for x in p['statusCheckRollup'] if x.get('name','').startswith('verify:') and re.search(r'/actions/runs/(\d+)',x.get('detailsUrl',''))}
out=[]
for rid in runs:
 status=get(['run','view',rid,'--repo','crvouga/gamezilla','--json','headSha,status,conclusion,jobs,url'])
 assert status['headSha']==head
 (r/'interactions'/f'hosted-run-{rid}.json').write_text(json.dumps(status,indent=2)+'\n')
 if status['status']=='completed':
  log=r/'interactions'/f'hosted-run-{rid}.log'
  with log.open('w') as f:result=subprocess.run(['gh','run','view',rid,'--repo','crvouga/gamezilla','--log'],stdout=f,stderr=subprocess.STDOUT)
  out.append({'runId':rid,'headSha':head,'conclusion':status['conclusion'],'log':log.name,'logExitCode':result.returncode})
 else:
  for job in status['jobs']:
   if job['status']!='completed':continue
   log=r/'interactions'/f'hosted-job-{job["databaseId"]}.log'
   with log.open('w') as f:result=subprocess.run(['gh','run','view',rid,'--repo','crvouga/gamezilla','--job',str(job['databaseId']),'--log'],stdout=f,stderr=subprocess.STDOUT)
   out.append({'runId':rid,'headSha':head,'job':job['name'],'conclusion':job['conclusion'],'log':log.name,'logExitCode':result.returncode})
(r/'interactions/hosted-log-inventory.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps(out,indent=2))
