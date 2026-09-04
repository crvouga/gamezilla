/** Web-standard DOM surface for the counter toy (no ui-testing Driver). */
export type Page = {
  click(selector: string): Promise<void>;
  text(selector: string): Promise<string>;
  routeAttr(): Promise<string | null>;
  reload(): Promise<void>;
  consoleErrors(): readonly string[];
  dispose(): Promise<void>;
};
