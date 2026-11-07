from pathlib import Path
import subprocess,json,re,datetime
r=Path(__file__).parent
head=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
dispatch=json.loads((r/'ubuntu/dispatch.json').read_text())
rid=re.search(r'/runs/(\d+)',dispatch['stdout']).group(1)
status=json.loads(subprocess.check_output(['gh','run','view',rid,'--repo','crvouga/gamezilla','--json','headSha,status,conclusion,jobs,url'],text=True))
assert status['headSha']==dispatch['candidateSha']==head
(r/'ubuntu/final-status.json').write_text(json.dumps(status,indent=2)+'\n')
job=next(j for j in status['jobs'] if j['name']=='verify-nightly:storybook')
steps={s['name']:s for s in job['steps']}
verdict={'candidateSha':head,'status':status['status']+': '+(status['conclusion'] or 'pending'),'runUrl':status['url'],'runId':rid,'authorAndCompareRequested':True,'referencesAccepted':False,'observedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'authorStatus':steps.get('Author references explicitly',{}).get('conclusion') or steps.get('Author references explicitly',{}).get('status'),'compareStatus':steps.get('Compare every authored Storybook state',{}).get('conclusion') or steps.get('Compare every authored Storybook state',{}).get('status'),'jobId':job['databaseId'],'priorRounds':'No prior references or patches applied; superseded source runs are diagnostic only.'}
if job['status']=='completed':
 log=r/'ubuntu/canonical-job.log'
 with log.open('w') as f:out=subprocess.run(['gh','run','view',rid,'--repo','crvouga/gamezilla','--job',str(job['databaseId']),'--log'],stdout=f,stderr=subprocess.STDOUT)
 verdict['logExitCode']=out.returncode;verdict['log']='canonical-job.log'
else:verdict['log']='Final job log unavailable while job is running; pending is not a pass.'
(r/'ubuntu/verdict.json').write_text(json.dumps(verdict,indent=2)+'\n')
print(json.dumps(verdict,indent=2))
