import type { Href } from '@pkgs/ui-root-shared-ts/href';
import type { JSX } from 'solid-js';
import type { CatalogueSourceUpload } from './catalogue-load-client';
import type { CatalogueSourceStatus } from './catalogue-load-places';

/** The shared source file as the loader's screens show it. */
export type CatalogueSourceView = {
  readonly status: CatalogueSourceStatus;
  /** The saved file's name; it stays known through a later check. */
  readonly filename: string | null;
  /** The name of the file chosen on this device, not saved yet. */
  readonly chosen: string | null;
  /** Why the last check failed. */
  readonly checkError: string | null;
  /** Why the last save did not finish; kept until another file or save. */
  readonly saveError: string | null;
  /** The upload under way, while `status` is `uploading`. */
  readonly upload: CatalogueSourceUpload | null;
};

/**
 * What draws the loader's bar: the space it is embedded in (the host owns
 * the bar and Back), or the loader's own routed page, whose trail leads
 * back to `parent` and, from a place behind the hub, to the hub (`onBack`).
 */
export type CatalogueLoadFrameView =
  | { readonly kind: 'embedded' }
  | {
      readonly kind: 'routed';
      readonly parent: { readonly name: JSX.Element; readonly href: Href };
      readonly onBack: () => void;
    };

/** Which of the loader's two confirmed stops is being asked. */
export type CatalogueLoadStopKind = 'saving' | 'loading';
