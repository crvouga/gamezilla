from pathlib import Path
import json,subprocess
r=Path(__file__).parent
head=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
read=lambda name:json.loads((r/name).read_text())
assert '96 successful, 96 total' in (r/'interactions/aggregate-final.log').read_text()
assert '1 successful, 1 total' in (r/'interactions/goals-final.log').read_text()
x={'candidateSha':head,'aggregate':{'passed':96,'total':96,'log':'aggregate-final.log','finalSourceUiTasks':'blank-source-final.log: lint/tc/test 6/6 passed','focusedNativeRepair':'blank-repair-native/browser-classification.json: 21 native/play/browser/axe passed, 21 pixel differences'},'battleshipConsumer':{'tasksPassed':9,'tasksTotal':9,'componentTestsPassed':43,'literalRegressionRedLog':'consumer-regression-red.log','focusedLog':'consumer-repair-final.log','hostedRepairedHead':'439536df159a3fe8d2b2262d36ffc1889c717bee','hostedShard2Job':128254472185,'hostedShard2Status':'success'},'goals':{'status':'passed','log':'goals-final.log'},'i18n':'extraction and strict compilation passed; subsequent fixes change no messages','derivedContracts':read('interactions/generated-contracts.json'),'localGate':read('interactions/full-verify-verdict.json'),'native':read('interactions/runtime-verdict.json'),'coverage':read('interactions/coverage-classification.json'),'hosted':read('interactions/pr-final-status.json'),'canonical':read('ubuntu/verdict.json'),'referencesAccepted':False,'manualQA':False,'outsideScope':['outside-scope/NUMBERLINK_REPUBLICATION_DIAGNOSIS.md','outside-scope/QUORIDOR_HILL_HOSTED_DIAGNOSIS.md'],'classifierAudit':'classifier-audit.json'}
assert x['native']['candidateSha']==x['localGate']['candidateSha']==x['canonical']['candidateSha']==head
(r/'interactions/check-summary.json').write_text(json.dumps(x,indent=2)+'\n')
