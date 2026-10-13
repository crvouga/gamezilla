/** The page stylesheet: neutral surfaces, one blue accent, light and dark. */

export const PAGE_STYLE = `
:root{--bg:#f6f7f9;--panel:#fff;--text:#0f1419;--muted:#5b6672;--border:#e1e5ea;--accent:#1d9bf0;--edge:#9aa5b1;--code:#eef1f4;--radius:12px}
@media (prefers-color-scheme:dark){:root{--bg:#0b0e11;--panel:#14181d;--text:#e7e9ea;--muted:#8b98a5;--border:#2a3139;--edge:#56626e;--code:#1c2127}}
*{box-sizing:border-box}
html{scroll-behavior:smooth;scroll-padding-top:72px}
body{margin:0;background:var(--bg);color:var(--text);font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
a{color:inherit}
code{font:12px/1.4 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;background:var(--code);padding:1px 6px;border-radius:6px}
h1,h2,h3{margin:0;line-height:1.25}
.muted{color:var(--muted)}
.wrap{max-width:1240px;margin:0 auto;padding:0 24px}
.top{background:var(--panel);border-bottom:1px solid var(--border)}
.top .wrap{padding-top:28px;padding-bottom:22px}
.brand{display:flex;align-items:center;gap:14px}
.brand h1{font-size:26px;letter-spacing:-.01em}
.lede{margin:10px 0 0;color:var(--muted);max-width:78ch}
.summary{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px}
.summary .pill{display:flex;align-items:center;gap:8px;border:1px solid var(--border);border-radius:999px;padding:4px 12px 4px 4px;background:var(--panel)}
.nav{position:sticky;top:0;z-index:5;background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(10px);border-bottom:1px solid var(--border)}
.nav .wrap{display:flex;gap:6px;align-items:center;padding-top:10px;padding-bottom:10px;flex-wrap:wrap}
.nav a{text-decoration:none;padding:5px 11px;border-radius:999px;color:var(--muted);font-weight:500}
.nav a:hover{background:var(--code);color:var(--text)}
.env-switch{margin-left:auto;display:flex;gap:4px;border:1px solid var(--border);border-radius:999px;padding:3px;background:var(--panel)}
.env-switch input{position:absolute;opacity:0;pointer-events:none}
.env-switch label{padding:4px 14px;border-radius:999px;cursor:pointer;font-weight:600;color:var(--muted)}
main{padding:28px 0 64px}
h2{font-size:20px;margin:40px 0 6px;letter-spacing:-.005em}
h2 + .sub{margin:0 0 16px;color:var(--muted)}
h3{font-size:15px}
.env{display:none}
.env-head{display:flex;align-items:center;gap:10px;margin:8px 0 0}
.env-head h2{margin:0}
.badge{display:inline-block;font-size:11px;font-weight:600;padding:1px 8px;border-radius:999px;border:1px solid var(--border);color:var(--muted);vertical-align:2px;white-space:nowrap}
.badge.stateful,.badge.lock,.badge.prod{border-color:var(--accent);color:var(--accent)}
.badge.info{color:var(--text)}
.endpoints{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}
.endpoint{display:flex;align-items:center;gap:12px;background:var(--panel);border:1px solid var(--border);border-radius:var(--radius);padding:12px 14px;text-decoration:none}
a.endpoint:hover{border-color:var(--accent)}
.endpoint-label{font-size:12px;color:var(--muted)}
.endpoint-host{font-weight:600;word-break:break-all}
.stack{background:var(--panel);border:1px solid var(--border);border-radius:var(--radius);padding:16px 18px 6px;margin:0 0 16px}
.stack-head{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 14px}
.stack-head h3{font-size:16px}
.stack-facts{color:var(--muted);font-size:12.5px}
.desc{color:var(--muted);margin:8px 0;max-width:90ch}
.graph-scroll{overflow-x:auto;padding:6px 0 12px}
svg.graph{display:block;max-width:none}
.edge{fill:none;stroke:var(--edge);stroke-width:1.4}
.edge.back{stroke-dasharray:5 4}
.arrow{fill:var(--edge)}
.card-box{fill:var(--panel);stroke:var(--border);stroke-width:1.2}
.card.stateful .card-box{stroke:var(--accent)}
.card.data .card-box,.card.external .card-box{stroke-dasharray:5 4}
.card.external .card-box{fill:var(--code)}
.card-tile{fill:#fff;stroke:var(--border)}
.card-title{fill:var(--text);font:600 13px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
.card-sub{fill:var(--muted);font:12px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
a:hover .card-box{stroke:var(--accent)}
.legend{display:flex;flex-wrap:wrap;gap:14px;color:var(--muted);font-size:12.5px;margin:0 0 14px}
.legend i{display:inline-block;width:22px;height:12px;border-radius:4px;border:1.2px solid var(--border);vertical-align:-2px;margin-right:6px;background:var(--panel)}
.legend i.s{border-color:var(--accent)}
.legend i.d{border-style:dashed}
.logo-tile{display:inline-flex;align-items:center;justify-content:center;background:#fff;border:1px solid var(--border);border-radius:8px;flex:none}
.logo-row{display:inline-flex;gap:4px}
.module{background:var(--panel);border:1px solid var(--border);border-radius:var(--radius);margin:0 0 12px}
.module>summary{display:flex;align-items:center;gap:12px;padding:12px 16px;cursor:pointer;list-style:none}
.module>summary::-webkit-details-marker{display:none}
.module>summary::before{content:"▸";color:var(--muted);transition:transform .15s}
.module[open]>summary::before{transform:rotate(90deg)}
.module-name{font-weight:600}
.module-count{color:var(--muted)}
.module-dir{margin-left:auto;color:var(--muted)}
.module>.desc,.module>.graph-scroll,.module>table{margin-left:16px;margin-right:16px}
table.resources{width:calc(100% - 32px);border-collapse:collapse;margin-bottom:14px}
.resources th{text-align:left;font-size:11.5px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);padding:6px 8px;border-bottom:1px solid var(--border)}
.resources td{padding:10px 8px;border-bottom:1px solid var(--border);vertical-align:top}
.resources tr:last-child td{border-bottom:0}
.resources tr:target td{background:color-mix(in srgb,var(--accent) 10%,transparent)}
td.res{display:flex;gap:12px;align-items:flex-start;min-width:340px}
.res-title{font-weight:600}
.addr{display:inline-block;margin-top:2px;color:var(--muted);word-break:break-all}
.name{font-weight:500;overflow-wrap:anywhere}
td.names{min-width:260px}
.chips{display:flex;flex-wrap:wrap;gap:4px}
.chip,.chip-link{font:12px ui-monospace,SFMono-Regular,Menlo,monospace;background:var(--code);border-radius:6px;padding:1px 7px}
.more{margin-top:6px}
.more summary{cursor:pointer;color:var(--muted)}
td.links{white-space:nowrap}
.btn{display:inline-block;text-decoration:none;border:1px solid var(--border);border-radius:8px;padding:2px 10px;margin:0 6px 4px 0;font-weight:500;background:var(--panel)}
.btn:hover{border-color:var(--accent);color:var(--accent)}
.providers{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px}
.provider{background:var(--panel);border:1px solid var(--border);border-radius:var(--radius);padding:14px 16px}
.provider header{display:flex;gap:12px;align-items:center}
.provider h3{font-size:15px}
.provider dl{margin:12px 0 0;display:grid;gap:4px}
.provider dl div{display:flex;gap:8px;justify-content:space-between}
.provider dt{color:var(--muted)}
.provider dd{margin:0;font-weight:500;text-align:right;word-break:break-all}
.pins{display:flex;flex-wrap:wrap;gap:4px;margin-top:10px}
.pin{font:11.5px ui-monospace,Menlo,monospace;color:var(--muted);border:1px solid var(--border);border-radius:6px;padding:0 6px}
.provider-links{margin-top:12px}
.removed{list-style:none;margin:0;padding:0;display:grid;gap:10px}
.removed li{display:flex;gap:12px;align-items:center;background:var(--panel);border:1px solid var(--border);border-radius:var(--radius);padding:10px 14px}
.notice{border:1px solid var(--accent);border-radius:var(--radius);padding:12px 16px;margin:16px 0;background:var(--panel)}
footer{border-top:1px solid var(--border);color:var(--muted);padding:22px 0 40px;font-size:12.5px}
footer p{margin:0 0 6px;max-width:100ch}
@media print{.nav{display:none}.env{display:block!important}.module{break-inside:avoid}}
`;
