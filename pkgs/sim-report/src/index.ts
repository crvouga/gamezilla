/** Node-safe public API: artifact writers (no DOM / Solid mount). */
export {
  type RenderHtmlReportOptions,
  renderHtmlReport,
} from './render';
export {
  type BuildHtmlReportOptions,
  buildHtmlReport,
  HTML_REPORT_KEY,
  type WriteHtmlReportOptions,
  writeHtmlReport,
} from './write';
