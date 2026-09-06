/** @jsxImportSource solid-js */
import { Trans, useLingui } from '@lingui/solid/macro';
import { createMemo, Index } from 'solid-js';
import { createStore, produce, unwrap } from 'solid-js/store';

export type Settings = {
  displayName: string;
  soundEnabled: boolean;
  volume: number;
  tags: string[];
};

export type SettingsPanelProps = {
  initial: Settings;
  onSave: (settings: Settings) => void;
};

/**
 * Exemplar: nested `createStore` state edited with `produce`, a controlled
 * form, and a derived dirty flag. `unwrap` hands a plain object to the caller.
 */
export function SettingsPanel(props: SettingsPanelProps) {
  const { t } = useLingui();
  const [draft, setDraft] = createStore<Settings>(
    structuredClone(props.initial)
  );

  // Stringifying the proxy (not `unwrap`) reads every leaf reactively.
  const isDirty = createMemo(
    () => JSON.stringify(draft) !== JSON.stringify(props.initial)
  );

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed === '' || draft.tags.includes(trimmed)) return;
    setDraft(
      produce((s) => {
        s.tags.push(trimmed);
      })
    );
  };

  const removeTag = (index: number) => {
    setDraft(
      produce((s) => {
        s.tags.splice(index, 1);
      })
    );
  };

  return (
    <form
      data-component="SettingsPanel"
      onSubmit={(event) => {
        event.preventDefault();
        props.onSave(structuredClone(unwrap(draft)));
      }}
    >
      <label>
        <Trans>Display name</Trans>
        <input
          name="displayName"
          type="text"
          value={draft.displayName}
          onInput={(e) => setDraft('displayName', e.currentTarget.value)}
        />
      </label>

      <label>
        <input
          name="soundEnabled"
          type="checkbox"
          checked={draft.soundEnabled}
          onChange={(e) => setDraft('soundEnabled', e.currentTarget.checked)}
        />
        <Trans>Sound</Trans>
      </label>

      <label>
        <Trans>Volume</Trans>
        <input
          name="volume"
          type="range"
          min="0"
          max="100"
          value={draft.volume}
          disabled={!draft.soundEnabled}
          onInput={(e) => setDraft('volume', Number(e.currentTarget.value))}
        />
      </label>

      <ul aria-label={t`Tags`}>
        <Index each={draft.tags}>
          {(tag, index) => (
            <li>
              {tag()}
              <button
                type="button"
                aria-label={t`Remove ${tag()}`}
                onClick={() => removeTag(index)}
              >
                ×
              </button>
            </li>
          )}
        </Index>
      </ul>
      <input
        type="text"
        aria-label={t`New tag`}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          addTag(e.currentTarget.value);
          e.currentTarget.value = '';
        }}
      />

      <button type="submit" disabled={!isDirty()}>
        <Trans>Save</Trans>
      </button>
    </form>
  );
}
