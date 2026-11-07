from pathlib import Path
import json,subprocess,sys
r=Path(__file__).parent;media=sys.argv[1];m=json.loads((r/'manifest.json').read_text());comments=[]
for part in range(1,4):
 body=(r/f'media-comment-{part}.md').read_text()
 payload=r/f'comment-payload-{part}.json';payload.write_text(json.dumps({'body':body}))
 result=json.loads(subprocess.check_output(['gh','api','repos/crvouga/gamezilla/issues/280/comments','--input',str(payload)],text=True))
 (r/f'comment-receipt-{part}.json').write_text(json.dumps(result,indent=2)+'\n');comments.append(result['html_url'])
 print(result['html_url'],flush=True)
 pub={'sourceSha':m['candidateSha'],'mediaSha':media,'evidence_code':m['evidence_code'],'comments':comments,'manifest':f'https://github.com/crvouga/gamezilla/blob/{media}/round-7/manifest.json','gallery':f'https://github.com/crvouga/gamezilla/blob/{media}/round-7/GALLERY.md','canonicalRun':m['ubuntu']['runUrl']}
 (r/'publication.json').write_text(json.dumps(pub,indent=2)+'\n')
