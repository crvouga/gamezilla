/** The hosted pages' small component kit. */
import { createEffect, type JSX, onCleanup, Show } from 'solid-js';

import type { StatusTone } from './format';
import {
  AlertIcon,
  ArrowLeftIcon,
  CheckIcon,
  CloseIcon,
  LockIcon,
  Spinner,
} from './icons';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

const VARIANTS: Readonly<Record<ButtonVariant, string>> = {
  primary:
    'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20 hover:bg-indigo-500 active:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400',
  secondary:
    'bg-white text-zinc-900 ring-1 ring-inset ring-zinc-300 shadow-xs hover:bg-zinc-50 active:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-700 dark:hover:bg-zinc-800',
  danger:
    'bg-red-600 text-white shadow-sm shadow-red-600/20 hover:bg-red-500 active:bg-red-700',
  ghost:
    'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100',
};

const BUTTON_BASE =
  'relative inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors duration-150 select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-60';

export type ButtonProps = {
  readonly variant?: ButtonVariant;
  readonly size?: 'md' | 'lg';
  readonly block?: boolean;
  readonly busy?: boolean;
  readonly done?: boolean;
  readonly disabled?: boolean;
  readonly testId?: string;
  readonly onClick?: () => void;
  readonly children: JSX.Element;
};

export function Button(props: ButtonProps) {
  return (
    <button
      aria-busy={props.busy === true}
      class={`${BUTTON_BASE} ${VARIANTS[props.variant ?? 'primary']} ${
        props.size === 'lg' ? 'h-12 px-5 text-base' : 'h-10 px-4 text-sm'
      } ${props.block === true ? 'w-full' : ''}`}
      data-testid={props.testId}
      disabled={props.disabled === true || props.busy === true}
      onClick={() => props.onClick?.()}
      type="button"
    >
      <Show when={props.busy === true}>
        <Spinner />
      </Show>
      <Show when={props.done === true && props.busy !== true}>
        <CheckIcon />
      </Show>
      {props.children}
    </button>
  );
}

export function Card(props: {
  readonly title?: string;
  readonly aside?: JSX.Element;
  readonly children: JSX.Element;
}) {
  return (
    <section class="animate-rise rounded-2xl bg-white shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10">
      <Show when={props.title}>
        <header class="flex items-center justify-between gap-4 border-zinc-100 border-b px-5 py-3.5 sm:px-6 dark:border-zinc-800">
          <h2 class="font-semibold text-xs text-zinc-500 uppercase tracking-wider dark:text-zinc-400">
            {props.title}
          </h2>
          {props.aside}
        </header>
      </Show>
      <div class="p-5 sm:p-6">{props.children}</div>
    </section>
  );
}

const BADGE_TONES: Readonly<Record<StatusTone, string>> = {
  success:
    'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/25',
  info: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-400/25',
  warning:
    'bg-amber-50 text-amber-800 ring-amber-600/25 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/25',
  danger:
    'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-400/25',
  neutral:
    'bg-zinc-100 text-zinc-700 ring-zinc-500/20 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-600/40',
};

export function Badge(props: {
  readonly tone: StatusTone;
  readonly children: JSX.Element;
}) {
  return (
    <span
      class={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 font-medium text-xs ring-1 ring-inset ${BADGE_TONES[props.tone]}`}
    >
      {props.children}
    </span>
  );
}

const NOTICE_TONES: Readonly<Record<StatusTone, string>> = {
  success:
    'bg-emerald-50 text-emerald-900 ring-emerald-600/15 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-400/20',
  info: 'bg-indigo-50 text-indigo-900 ring-indigo-600/15 dark:bg-indigo-500/10 dark:text-indigo-200 dark:ring-indigo-400/20',
  warning:
    'bg-amber-50 text-amber-900 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-400/20',
  danger:
    'bg-red-50 text-red-900 ring-red-600/15 dark:bg-red-500/10 dark:text-red-200 dark:ring-red-400/20',
  neutral:
    'bg-zinc-50 text-zinc-800 ring-zinc-900/10 dark:bg-zinc-800/60 dark:text-zinc-200 dark:ring-white/10',
};

export function Notice(props: {
  readonly tone: StatusTone;
  readonly children: JSX.Element;
  readonly action?: JSX.Element;
}) {
  return (
    <div
      class={`flex flex-col gap-3 rounded-xl p-4 text-sm ring-1 ring-inset sm:flex-row sm:items-center ${NOTICE_TONES[props.tone]}`}
      role={props.tone === 'danger' ? 'alert' : 'status'}
    >
      <div class="flex flex-1 gap-3">
        <AlertIcon class="mt-0.5 size-4 shrink-0" />
        <div class="leading-relaxed">{props.children}</div>
      </div>
      <Show when={props.action}>
        <div class="shrink-0">{props.action}</div>
      </Show>
    </div>
  );
}

export function BackLink(props: {
  readonly href: string;
  readonly label: string;
  readonly testId?: string;
}) {
  return (
    <a
      class="-ml-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 font-medium text-sm text-zinc-600 transition-colors hover:bg-zinc-200/60 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-indigo-600 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
      data-testid={props.testId}
      href={props.href}
    >
      <ArrowLeftIcon />
      {props.label}
    </a>
  );
}

export function TestModePill() {
  return (
    <span class="inline-flex items-center gap-1.5 rounded-md bg-amber-100 px-2 py-1 font-semibold text-[11px] text-amber-900 uppercase tracking-wider dark:bg-amber-400/15 dark:text-amber-200">
      <span class="size-1.5 rounded-full bg-amber-500" />
      Test mode
    </span>
  );
}

export function SecureFootnote(props: { readonly children: JSX.Element }) {
  return (
    <p class="flex items-center justify-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
      <LockIcon class="size-3.5" />
      {props.children}
    </p>
  );
}

/** A native modal `<dialog>`: focus trap, Esc and top layer come for free. */
export function Dialog(props: {
  readonly open: boolean;
  readonly title: string;
  readonly onClose: () => void;
  readonly children: JSX.Element;
  readonly footer: JSX.Element;
}) {
  let dialog: HTMLDialogElement | undefined;
  createEffect(() => {
    if (dialog === undefined) return;
    if (props.open && !dialog.open) {
      dialog.showModal();
      // Land on the safe choice (the footer's first button), not the close icon.
      dialog.querySelector<HTMLElement>('[data-dialog-footer] button')?.focus();
    }
    if (!props.open && dialog.open) dialog.close();
  });
  onCleanup(() => dialog?.close());
  return (
    <dialog
      aria-labelledby="mock-dialog-title"
      class="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl bg-white p-0 text-zinc-900 shadow-2xl ring-1 ring-zinc-950/10 open:animate-pop dark:bg-zinc-900 dark:text-zinc-100 dark:ring-white/10"
      onCancel={(event) => {
        event.preventDefault();
        props.onClose();
      }}
      onClick={(event) => {
        if (event.target === dialog) props.onClose();
      }}
      ref={(element) => {
        dialog = element;
      }}
    >
      <div class="flex items-start justify-between gap-4 px-6 pt-6">
        <h2 class="font-semibold text-lg tracking-tight" id="mock-dialog-title">
          {props.title}
        </h2>
        <button
          aria-label="Close"
          class="-mr-2 -mt-1 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          onClick={() => props.onClose()}
          type="button"
        >
          <CloseIcon />
        </button>
      </div>
      <div class="px-6 pt-2 pb-6 text-sm text-zinc-600 leading-relaxed dark:text-zinc-300">
        {props.children}
      </div>
      <div
        class="flex flex-col-reverse gap-2 rounded-b-2xl bg-zinc-50 px-6 py-4 sm:flex-row sm:justify-end dark:bg-zinc-950/40"
        data-dialog-footer
      >
        {props.footer}
      </div>
    </dialog>
  );
}
