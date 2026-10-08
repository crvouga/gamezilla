// @io-wall-ok — the browser host supplies navigation to the reports viewer.
import type { ReportNavigation } from './navigation';

export function browserReportNavigation(): ReportNavigation {
  return {
    readHash: () => window.location.hash,
    writeHash: (hash, replace) => {
      if (window.location.hash === hash) return;
      if (replace) window.history.replaceState(null, '', hash);
      else window.history.pushState(null, '', hash);
    },
    subscribeHash: (listener) => {
      window.addEventListener('hashchange', listener);
      window.addEventListener('popstate', listener);
      return () => {
        window.removeEventListener('hashchange', listener);
        window.removeEventListener('popstate', listener);
      };
    },
    subscribeKeys: (listener) => {
      window.addEventListener('keydown', listener);
      return () => window.removeEventListener('keydown', listener);
    },
    setTitle: (title) => {
      document.title = title;
    },
  };
}
