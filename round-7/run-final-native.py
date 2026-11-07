from pathlib import Path
import subprocess,json,datetime,shutil
r=Path(__file__).parent
head=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
build=json.loads((r/'build-provenance.json').read_text());assert build['candidateSha']==head
cmd=['sh',str(r/'test.sh')]
started=datetime.datetime.now(datetime.timezone.utc).isoformat()
with (r/'interactions/browser.log').open('w') as log:result=subprocess.run(cmd,stdout=log,stderr=subprocess.STDOUT)
shutil.copytree('pkgs/ui-root-harness-ts/.cache/storybook-test-results',r/'interactions/native-raw-results')
(r/'interactions/native-command.json').write_text(json.dumps({'candidateSha':head,'buildSha256':build['sha256'],'command':cmd,'startedAt':started,'completedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exitCode':result.returncode,'retries':0},indent=2)+'\n')
subprocess.run(['python3',str(r/'classify-results.py')],check=True)
subprocess.run(['python3',str(r/'collect-font.py')],check=True)
subprocess.run(['python3',str(r/'runtime-verdict.py')],check=True)
