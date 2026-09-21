/** Inline stroke icons (24px grid, `currentColor`). */
import { type JSX, Show } from 'solid-js';

type IconProps = { readonly class?: string | undefined };

function Icon(props: IconProps & { readonly children: JSX.Element }) {
  return (
    <svg
      aria-hidden="true"
      class={props.class ?? 'size-4'}
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="2"
      viewBox="0 0 24 24"
    >
      {props.children}
    </svg>
  );
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <Icon class={props.class}>
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </Icon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon class={props.class}>
      <path d="M20 6 9 17l-5-5" />
    </Icon>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <Icon class={props.class}>
      <rect height="11" rx="2" width="18" x="3" y="11" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </Icon>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <Icon class={props.class}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4M12 16h.01" />
    </Icon>
  );
}

export function SparkleIcon(props: IconProps) {
  return (
    <Icon class={props.class}>
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
      <path d="M19 17v4M17 19h4" />
    </Icon>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Icon class={props.class}>
      <path d="M18 6 6 18M6 6l12 12" />
    </Icon>
  );
}

export function Spinner(props: IconProps) {
  return (
    <svg
      aria-hidden="true"
      class={props.class ?? 'size-4'}
      classList={{ 'animate-spin': true }}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        class="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        stroke-width="3"
      />
      <path
        class="opacity-90"
        d="M22 12a10 10 0 0 0-10-10"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-width="3"
      />
    </svg>
  );
}

/** A card-brand mark drawn in CSS-free SVG so it reads in both themes. */
export function VisaMark() {
  return (
    <svg
      aria-label="Visa"
      class="h-8 w-12 shrink-0"
      role="img"
      viewBox="0 0 48 32"
    >
      <rect fill="#1a1f71" height="32" rx="5" width="48" />
      <text
        fill="#fff"
        font-family="Arial, sans-serif"
        font-size="13"
        font-style="italic"
        font-weight="700"
        text-anchor="middle"
        x="24"
        y="20.5"
      >
        VISA
      </text>
    </svg>
  );
}

export function MastercardMark() {
  return (
    <svg
      aria-label="Mastercard"
      class="h-8 w-12 shrink-0"
      role="img"
      viewBox="0 0 48 32"
    >
      <rect fill="#1c1c1c" height="32" rx="5" width="48" />
      <circle cx="20" cy="16" fill="#eb001b" r="8" />
      <circle cx="28" cy="16" fill="#f79e1b" fill-opacity="0.9" r="8" />
    </svg>
  );
}

/** The mark for a card brand. */
export function CardMark(props: { readonly brand: 'visa' | 'mastercard' }) {
  return (
    <Show fallback={<VisaMark />} when={props.brand === 'mastercard'}>
      <MastercardMark />
    </Show>
  );
}
