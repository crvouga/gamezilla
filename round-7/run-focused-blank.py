from pathlib import Path
import subprocess,shutil,json
r=Path(__file__).parent;d=r/'interactions/blank-repair-native';d.mkdir()
pattern=r'screens-games-word-tiles-(board--(opening|your-turn|assign-a-blank|enlarged-coordinates)|puzzle--enlarged-blank) (light|dark)(-1440)?$|word-tiles-blank-mode-hit-overlap'
with (d/'browser.log').open('w') as log:
 result=subprocess.run(['bunx','turbo','run','storybook:test','--filter=@pkgs/ui-root-harness-ts','--only','--concurrency=1','--','--workers=1','--reporter=line,json','--grep',pattern],stdout=log,stderr=subprocess.STDOUT)
shutil.copytree('pkgs/ui-root-harness-ts/.cache/storybook-test-results',d/'raw-results')
(d/'source.diff').write_bytes(subprocess.check_output(['git','diff','HEAD']))
(d/'command.json').write_text(json.dumps({'exitCode':result.returncode,'pattern':pattern,'sourceStatus':'uncommitted repair over 4e6fa4c19','retries':0},indent=2))
subprocess.run(['python3',str(r/'classify-results.py'),str(d)],check=True)
