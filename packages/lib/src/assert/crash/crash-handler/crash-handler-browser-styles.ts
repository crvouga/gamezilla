export const CRASH_OVERLAY_STYLES = `
  #assert-crash-overlay {
    --assert-bg: #0d1117;
    --assert-surface: #161b22;
    --assert-border: #30363d;
    --assert-text: #e6edf3;
    --assert-muted: #8b949e;
    --assert-error: #f85149;
    --assert-accent: #58a6ff;
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    background: rgba(13, 17, 23, 0.94);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif;
  }
  #assert-crash-overlay .assert-card {
    background: var(--assert-surface);
    border: 1px solid var(--assert-border);
    border-radius: 12px;
    max-width: 560px;
    width: 100%;
    box-shadow: 0 24px 48px rgba(0,0,0,0.4);
    overflow: hidden;
  }
  #assert-crash-overlay .assert-header {
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--assert-border);
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  #assert-crash-overlay .assert-icon {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    background: var(--assert-error);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 16px;
    font-weight: bold;
    flex-shrink: 0;
  }
  #assert-crash-overlay .assert-title {
    color: var(--assert-text);
    font-size: 1.125rem;
    font-weight: 600;
    margin: 0;
  }
  #assert-crash-overlay .assert-message {
    padding: 1.25rem 1.5rem;
    color: var(--assert-text);
    font-size: 0.9375rem;
    line-height: 1.5;
    margin: 0;
    word-break: break-word;
  }
  #assert-crash-overlay .assert-context {
    margin: 0 1.5rem 1.25rem;
    padding: 1rem;
    background: #0d1117;
    border: 1px solid var(--assert-border);
    border-radius: 8px;
    font-family: 'SF Mono', 'Consolas', 'Monaco', monospace;
    font-size: 0.8125rem;
    line-height: 1.5;
    color: var(--assert-muted);
    max-height: 240px;
    overflow: auto;
    white-space: pre-wrap;
    word-break: break-all;
  }
  #assert-crash-overlay .assert-actions {
    padding: 1rem 1.5rem 1.25rem;
    display: flex;
    gap: 0.75rem;
    align-items: center;
    border-top: 1px solid var(--assert-border);
  }
  #assert-crash-overlay .assert-btn {
    padding: 0.5rem 1rem;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    border: none;
    font-family: inherit;
    transition: background 0.15s;
  }
  #assert-crash-overlay .assert-btn-primary {
    background: var(--assert-accent);
    color: #fff;
  }
  #assert-crash-overlay .assert-btn-primary:hover {
    background: #79b8ff;
  }
  #assert-crash-overlay .assert-suppressed {
    color: var(--assert-muted);
    font-size: 0.8125rem;
    margin-left: auto;
  }
`;
