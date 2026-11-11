import type { Decision } from '@pkgs/permissions-shared-ts/decision';
import type { Accessor, JSX } from 'solid-js';
import type { CatalogueLoadJobStatus } from './catalogue-load-places';

/**
 * What a game supplies to have its puzzle catalogue loaded through the
 * platform's loader: the facts and commands of its own source and load
 * (data and callbacks, never a screen) and the few words that name them.
 */

/** The latest load's figures, as the loader's result shows them. */
export type CatalogueLoadJob = {
  readonly status: CatalogueLoadJobStatus;
  /** What is being read: the source file or the place reached in it. */
  readonly source: string;
  /** How much of the source is processed, from 0 to 1. */
  readonly progress: number;
  readonly processed: number;
  readonly added: number;
  readonly updated: number;
  readonly broken: number;
  readonly duplicates: number;
  /** Why the load failed, when it did. */
  readonly error: string | null;
  readonly updatedAt: string;
  readonly finishedAt: string | null;
};

/** What the last check of the shared source file found. */
export type CatalogueSourceCheck = {
  /** The last check finished (found or not). */
  readonly known: boolean;
  /** A check is running. */
  readonly checking: boolean;
  /** Why the last check failed; `null` when it did not. */
  readonly error: string | null;
  /** The saved file's name; `null` when none is known. */
  readonly filename: string | null;
};

/** An upload of the chosen file under way on this device. */
export type CatalogueSourceUpload = {
  /** How much of the file is sent, from 0 to 1. */
  readonly progress: number;
  /** The puzzles sent so far. */
  readonly puzzles: number;
};

/** The live facts and commands of one game's catalogue load. */
export type CatalogueLoad = {
  /** Whether the person may load puzzles, as `@libs/permissions` decided. */
  readonly decision: Accessor<Decision>;
  readonly online: Accessor<boolean>;
  /** The load's status has its first answer. */
  readonly ready: Accessor<boolean>;
  /** The puzzles available to solvers; `null` until a load reported it. */
  readonly pool: Accessor<number | null>;
  readonly job: Accessor<CatalogueLoadJob | null>;
  readonly source: Accessor<CatalogueSourceCheck>;
  /** The file chosen on this device, not saved yet. */
  readonly chosenFile: Accessor<{ readonly name: string } | null>;
  /** The upload under way; `null` when none is. */
  readonly upload: Accessor<CatalogueSourceUpload | null>;
  readonly selectFile: (file: File | null) => void;
  /** Save the chosen file as the shared source. Rejects saying why not. */
  readonly save: () => Promise<void>;
  readonly recheck: () => void;
  /** Start a load from the saved file. Rejects saying why not. */
  readonly start: () => Promise<void>;
  /** Stop the upload or the load under way. Rejects saying why not. */
  readonly stop: () => Promise<void>;
};

/** The words that name a game's catalogue and its source to the loader. */
export type CatalogueLoadCopy = {
  /** The loader's name ("Load chess puzzles"). */
  readonly title: () => JSX.Element;
  /** One line under the name. */
  readonly subtitle: () => JSX.Element;
  /** How the shared source is called, mid-sentence ("Lichess file"). */
  readonly sourceName: string;
  /** The file picker's label ("Lichess puzzle database"). */
  readonly fileLabel: () => JSX.Element;
  /** The file types the picker accepts (`.csv,.csv.zst`). */
  readonly fileAccept: string;
  /** Which file to choose, in a sentence ("Choose a .csv or .csv.zst file."). */
  readonly fileHint: () => JSX.Element;
};

/**
 * A game's catalogue load, as its settings name it: the hook that reads its
 * facts (called once by the loader's container) and its copy.
 */
export type CatalogueLoadClient = {
  readonly useLoad: () => CatalogueLoad;
  readonly copy: CatalogueLoadCopy;
};
