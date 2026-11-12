import type { ScreenBox, ScreenshotFile } from '@pkgs/feedback-shared-ts/types';

export type ScreenshotOptions = {
  /** The one thing the bug report is about, drawn around on the picture. */
  readonly highlight?: ScreenBox | undefined;
};

/** Takes a picture of what the app is showing; `null` when the device cannot. */
export type ScreenshotPort = {
  capture(options?: ScreenshotOptions): Promise<ScreenshotFile | null>;
};

export type ConnectionPort = {
  online(): boolean;
  /** Told whenever the device goes offline or comes back. */
  subscribe(listener: () => void): () => void;
};

/** Acceleration including gravity, in m/s². */
export type MotionSample = {
  readonly x: number;
  readonly y: number;
  readonly z: number;
};

export type MotionPort = {
  /** A phone or tablet that can feel being shaken. */
  readonly available: boolean;
  /** The device asks the person before an app may notice motion. */
  readonly needsPermission: boolean;
  /** Asks only when a person just acted; otherwise answers what was already decided. */
  requestPermission(): Promise<boolean>;
  subscribe(listener: (sample: MotionSample) => void): () => void;
};

/** What the browser's own context menu does that a page can ask for too. */
export type EditCommand = 'cut' | 'copy' | 'undo' | 'redo' | 'selectAll';

export type BrowserPort = {
  /** `false` when the browser would not let the app copy. */
  writeText(text: string): Promise<boolean>;
  /** `null` when the browser does not let the app read what was copied. */
  readText(): Promise<string | null>;
  /** Acts on the focused field or the page; `false` when the browser refused. */
  edit(command: EditCommand): boolean;
  /** Types into the focused field as if the person had, so undo still works. */
  insertText(text: string): boolean;
  copyImage(url: string): Promise<boolean>;
  saveImage(url: string): void;
  /** Opens in a new tab, cut off from this one. */
  openInNewTab(url: string): void;
  /** Searches the web for the words in a new tab. */
  search(words: string): void;
  /** Follows a link the way choosing it would. */
  follow(link: Element): void;
  /** Whether there is a page to go back or forward to, where the browser says. */
  history(): { readonly back: boolean; readonly forward: boolean };
  back(): void;
  forward(): void;
  reload(): void;
  print(): void;
  pageUrl(): string;
};
