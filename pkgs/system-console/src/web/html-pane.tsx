import { type CSSProperties, useEffect, useState } from 'react';

import { testFrameUrl } from './api-client';
import type { FlatFrame } from './frames';
import { loadPreviewFontCss, SNAPSHOT_SHELL_CSS } from './preview-fonts';
import { patchPreviewHtml } from './preview-html';
import { styles, t } from './theme';
import { reportFetch } from './wall';

export function HtmlPane(props: {
  readonly bucketId: string;
  readonly runId: string;
  readonly testId: string;
  readonly frame: FlatFrame | null;
}) {
  const [srcdoc, setSrcdoc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const file = props.frame?.file ?? null;

  useEffect(() => {
    if (file == null) {
      setSrcdoc(null);
      setError(null);
      return;
    }
    let cancelled = false;
    const url = testFrameUrl(props.bucketId, props.runId, props.testId, file);
    void (async () => {
      try {
        const [res, fontCss] = await Promise.all([
          reportFetch(url),
          loadPreviewFontCss(),
        ]);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const html = await res.text();
        if (cancelled) return;
        setSrcdoc(
          patchPreviewHtml(html, {
            shellCss: SNAPSHOT_SHELL_CSS,
            fontCss,
          })
        );
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setSrcdoc(null);
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file, props.bucketId, props.runId, props.testId]);

  if (file == null) {
    return <div style={pane}>No HTML frame for this step.</div>;
  }
  if (error != null) {
    return (
      <div style={pane}>
        <div style={styles.empty}>Failed to load snapshot: {error}</div>
      </div>
    );
  }
  if (srcdoc == null) {
    return <div style={pane}>Loading snapshot…</div>;
  }

  return (
    <div style={pane}>
      <iframe
        title={`frame ${file}`}
        srcDoc={srcdoc}
        sandbox=""
        style={iframe}
      />
    </div>
  );
}

const pane: CSSProperties = {
  minHeight: 0,
  minWidth: 0,
  height: '100%',
  background: t.bg,
  display: 'flex',
  flexDirection: 'column',
};

const iframe: CSSProperties = {
  flex: 1,
  width: '100%',
  border: 0,
  background: 'hsla(240, 5%, 4%, 1)',
};
