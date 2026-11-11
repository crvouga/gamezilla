import { useDenialView } from '@libs/permissions-client-ts/denial-surface';
import { DefineBackButton } from '@libs/spaces-client-ts/spaces-nav-context';
import { placeBehind } from '@pkgs/turn-game-client-ts/screen-places';
import {
  type ScreenPlaceNavigation,
  useScreenPlace,
} from '@pkgs/turn-game-client-ts/use-screen-place';
import type { Href } from '@pkgs/ui-root-shared-ts/href';
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  on,
  Show,
  untrack,
} from 'solid-js';
import type {
  CatalogueLoad,
  CatalogueLoadClient,
} from './catalogue-load-client';
import {
  CATALOGUE_LOAD_PLACES,
  type CatalogueLoadPlace,
  catalogueLoadLink,
  catalogueLoadStage,
  catalogueSourceStatus,
} from './catalogue-load-places';
import { CatalogueLoadScreenView } from './catalogue-load-screen-view';
import type {
  CatalogueLoadFrameView,
  CatalogueSourceView,
} from './catalogue-load-view';

/**
 * Where the loader is shown: inside a space, whose bar's Back leaves it
 * through `onLeave`; or on its own routed page under `parent`.
 */
export type CatalogueLoadFrame =
  | {
      readonly kind: 'space';
      readonly onLeave: () => void;
      /** Where leaving goes, for the bar's Back. */
      readonly leaveLabel?: string | undefined;
    }
  | {
      readonly kind: 'route';
      readonly parent: { readonly name: JSX.Element; readonly href: Href };
    };

export type CatalogueLoadScreenProps = {
  readonly client: CatalogueLoadClient;
  readonly frame: CatalogueLoadFrame;
};

function message(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

/**
 * The shared file as the loader's screens show it, and saving it. A save
 * starts from the `source` place and ends on the home of the stage it ends
 * in: the hub once the file is saved, or back on `source`, beside its
 * reason and its retry, when it was not.
 */
function useCatalogueSource(
  load: CatalogueLoad,
  nav: ScreenPlaceNavigation<CatalogueLoadPlace>
): {
  readonly source: Accessor<CatalogueSourceView>;
  readonly save: () => Promise<void>;
} {
  const [saveError, setSaveError] = createSignal<string | null>(null);
  // Another file, or none (a saved one was found), is another attempt.
  createEffect(
    on(
      () => load.chosenFile(),
      () => setSaveError(null),
      { defer: true }
    )
  );
  const source = createMemo((): CatalogueSourceView => {
    const check = load.source();
    const chosen = load.chosenFile();
    return {
      status: catalogueSourceStatus({
        known: check.known,
        checking: check.checking,
        failed: check.error !== null,
        saved: check.filename !== null,
        chosen: chosen !== null,
        uploading: load.upload() !== null,
      }),
      filename: check.filename,
      chosen: chosen?.name ?? null,
      checkError: check.error,
      saveError: saveError(),
      upload: load.upload(),
    };
  });
  const save = async (): Promise<void> => {
    setSaveError(null);
    try {
      const saving = load.save();
      // Forget the opened place once the upload is under way, so the stage
      // it ends in shows its home.
      if (load.upload() !== null) nav.home();
      await saving;
    } catch (cause) {
      setSaveError(message(cause));
      nav.open({ screen: 'source' });
      throw cause;
    }
  };
  return { source, save };
}

/**
 * The platform's catalogue loader for one game: reads the game's facts
 * (`client.useLoad`), derives the stage, keeps this device's place and
 * renders `CatalogueLoadScreenView`. Back steps to the hub from the place
 * behind it and leaves the loader from a stage's home.
 */
export function CatalogueLoadScreen(
  props: CatalogueLoadScreenProps
): JSX.Element {
  // A game's load is one hook, read once for the life of the screen.
  const load = untrack(() => props.client.useLoad());
  const stage = createMemo(() =>
    catalogueLoadStage({
      allowed: load.decision().allowed,
      uploading: load.upload() !== null,
      job: load.job()?.status ?? null,
    })
  );
  const nav = useScreenPlace(CATALOGUE_LOAD_PLACES, stage);
  const denial = useDenialView({
    get decision() {
      return load.decision();
    },
  });
  const file = useCatalogueSource(load, nav);
  // Back names where it leaves to only from the stage's home.
  const leaves = createMemo(
    () => placeBehind(CATALOGUE_LOAD_PLACES, stage(), nav.place()) === null
  );
  const frame = createMemo(
    (): CatalogueLoadFrameView =>
      props.frame.kind === 'route'
        ? { kind: 'routed', parent: props.frame.parent, onBack: nav.back }
        : { kind: 'embedded' }
  );
  return (
    <>
      <Show when={props.frame.kind === 'space' ? props.frame : null} keyed>
        {(space) => (
          <DefineBackButton
            onPress={() => {
              if (!nav.back()) space.onLeave();
            }}
            label={leaves() ? space.leaveLabel : undefined}
          />
        )}
      </Show>
      <CatalogueLoadScreenView
        frame={frame()}
        copy={props.client.copy}
        stage={stage()}
        place={nav.place()}
        onOpen={nav.open}
        link={catalogueLoadLink({ online: load.online(), ready: load.ready() })}
        denial={stage() === 'denied' ? denial() : undefined}
        pool={load.pool()}
        job={load.job()}
        source={file.source()}
        onSelectFile={load.selectFile}
        onSave={file.save}
        onRecheck={load.recheck}
        onStart={load.start}
        onStop={load.stop}
      />
    </>
  );
}
