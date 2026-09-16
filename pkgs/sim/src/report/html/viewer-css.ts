/** Stylesheet for the standalone report viewer (dark, Playwright-like). */
export const VIEWER_CSS = `
:root{color-scheme:dark;--bg:#0f1014;--panel:#16171d;--panel-2:#1c1e26;--border:#2a2c36;--text:#e8e8ee;--muted:#9a9daa;--accent:#7aa2ff;--pass:#3ecf8e;--fail:#ff5c6c;--skip:#c9a63b;--mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;--sans:system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
*{box-sizing:border-box}
html,body{margin:0;height:100%;background:var(--bg);color:var(--text);font:14px/1.45 var(--sans)}
a{color:var(--accent);text-decoration:none}
button{font:inherit;color:inherit;background:none;border:0;cursor:pointer}
code,pre,.mono{font-family:var(--mono);font-size:12.5px}
.app{display:flex;flex-direction:column;height:100vh;min-height:0}
#content{display:flex;flex-direction:column;flex:1;min-height:0}
#content.scroll{overflow:auto}
.header{display:flex;align-items:center;gap:16px;padding:12px 20px;border-bottom:1px solid var(--border);background:var(--panel);position:sticky;top:0;z-index:2}
.header h1{font-size:16px;margin:0;font-weight:600}
.header .meta{color:var(--muted);font-size:12.5px}
.header .spacer{flex:1}
.chips{display:flex;gap:6px;flex-wrap:wrap}
.chip{padding:4px 10px;border-radius:999px;border:1px solid var(--border);color:var(--muted);font-size:12.5px}
.chip.on{border-color:var(--accent);color:var(--text);background:rgba(122,162,255,.12)}
.chip b{color:var(--text)}
.search{padding:6px 10px;border-radius:8px;border:1px solid var(--border);background:var(--panel-2);color:var(--text);min-width:240px}
.list{max-width:1100px;margin:0 auto;padding:16px 20px;width:100%}
.row{display:grid;grid-template-columns:20px 1fr auto auto;gap:12px;align-items:center;padding:10px 12px;border:1px solid var(--border);border-radius:10px;margin-bottom:8px;background:var(--panel);cursor:pointer}
.row:hover{border-color:#3a3d4a}
.row .title{font-weight:500}
.row .sub{color:var(--muted);font-size:12px;margin-top:2px}
.row .dur{color:var(--muted);font-variant-numeric:tabular-nums}
.badge{font-size:11px;padding:2px 8px;border-radius:999px;border:1px solid var(--border);color:var(--muted);white-space:nowrap}
.dot{width:10px;height:10px;border-radius:50%;display:inline-block;background:var(--muted)}
.dot.passed{background:var(--pass)}.dot.failed{background:var(--fail)}.dot.skipped{background:var(--skip)}
.empty{color:var(--muted);text-align:center;padding:48px 0}
.detail{display:grid;grid-template-columns:minmax(320px,38%) 1fr;flex:1;min-height:0}
.detail .side{border-right:1px solid var(--border);overflow:auto;background:var(--panel)}
.detail .main{display:flex;flex-direction:column;min-width:0;min-height:0}
.testhead{padding:14px 16px;border-bottom:1px solid var(--border)}
.testhead h2{margin:0 0 4px;font-size:15px;font-weight:600;display:flex;align-items:center;gap:8px}
.testhead .kv{color:var(--muted);font-size:12px;display:flex;gap:12px;flex-wrap:wrap}
.error{margin:12px 16px;padding:10px 12px;border:1px solid rgba(255,92,108,.4);background:rgba(255,92,108,.08);border-radius:8px;white-space:pre-wrap;word-break:break-word;color:#ffd3d8;max-height:240px;overflow:auto}
.steps{padding:8px 0 24px}
.step{display:flex;align-items:flex-start;gap:8px;padding:5px 16px 5px 0;cursor:pointer;border-left:2px solid transparent}
.step:hover{background:var(--panel-2)}
.step.sel{background:rgba(122,162,255,.12);border-left-color:var(--accent)}
.step .tw{width:14px;color:var(--muted);flex:none;text-align:center;user-select:none}
.step .st{flex:none;margin-top:5px}
.step .body{flex:1;min-width:0}
.step .t{word-break:break-word}
.step .k{color:var(--muted);font-size:11px;margin-right:6px;text-transform:uppercase;letter-spacing:.04em}
.step .sel-txt{color:var(--muted);font-family:var(--mono);font-size:11.5px;word-break:break-all}
.step .d{color:var(--muted);font-variant-numeric:tabular-nums;font-size:12px;flex:none}
.step .err{color:#ffd3d8;font-size:12px;white-space:pre-wrap;margin-top:4px}
.step.failed .t{color:#ffd3d8}
.viewer{flex:1;display:flex;flex-direction:column;min-height:0}
.tabs{display:flex;gap:4px;padding:8px 12px;border-bottom:1px solid var(--border);overflow:auto}
.tab{padding:5px 10px;border-radius:6px;color:var(--muted);white-space:nowrap}
.tab.on{background:var(--panel-2);color:var(--text)}
.stage{flex:1;display:flex;align-items:stretch;min-height:0}
.phone{flex:1;min-width:0;min-height:0;display:flex;align-items:center;justify-content:center;padding:16px;overflow:hidden;background:radial-gradient(ellipse at top,#171821,#0f1014 70%)}
.phone .frame{position:relative;background:#000;border-radius:14px;box-shadow:0 20px 60px rgba(0,0,0,.6);overflow:hidden}
.phone iframe{border:0;background:#000;display:block;transform-origin:top left}
.aside{width:340px;border-left:1px solid var(--border);overflow:auto;background:var(--panel)}
.aside h3{margin:0;padding:10px 12px;font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;border-bottom:1px solid var(--border)}
.aside pre{margin:0;padding:10px 12px;white-space:pre-wrap;word-break:break-word;font-size:11.5px;color:#cfd2dc}
.strip{display:flex;gap:6px;padding:10px 12px;border-top:1px solid var(--border);overflow-x:auto;background:var(--panel)}
.thumb{flex:none;width:72px;border:1px solid var(--border);border-radius:6px;padding:4px;color:var(--muted);font-size:11px;text-align:center;cursor:pointer;background:var(--panel-2)}
.thumb.on{border-color:var(--accent);color:var(--text)}
.thumb.failed{border-color:rgba(255,92,108,.5)}
.thumb .n{font-variant-numeric:tabular-nums}
.thumb .t{font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.toolbar{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--border);color:var(--muted);font-size:12.5px}
.toolbar .grow{flex:1}
.toolbar button{padding:4px 8px;border-radius:6px;border:1px solid var(--border)}
.toolbar button:disabled{opacity:.4;cursor:default}
.nodata{color:var(--muted);display:flex;align-items:center;justify-content:center;flex:1}
img.shot{max-width:100%;max-height:100%;object-fit:contain}
@media (max-width:900px){.detail{grid-template-columns:1fr}.detail .side{max-height:40vh;border-right:0;border-bottom:1px solid var(--border)}.aside{display:none}}
`;
