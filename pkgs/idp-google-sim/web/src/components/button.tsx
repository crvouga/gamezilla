/** Google's pill buttons: filled for the primary action, text for the rest. */

export type ButtonProps = {
  readonly label: string;
  readonly testId?: string | undefined;
  readonly variant?: 'filled' | 'text' | undefined;
  readonly name?: string | undefined;
  readonly value?: string | undefined;
  readonly busy?: boolean | undefined;
};

export function Button(props: ButtonProps) {
  const variant = (): 'filled' | 'text' => props.variant ?? 'filled';
  return (
    <button
      class="inline-flex h-10 items-center justify-center rounded-full px-6 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gm-primary disabled:cursor-not-allowed disabled:opacity-50"
      classList={{
        'bg-gm-primary text-white': variant() === 'filled',
        'bg-transparent text-gm-primary': variant() === 'text',
      }}
      type="submit"
      name={props.name}
      value={props.value}
      aria-busy={props.busy === true ? 'true' : undefined}
      disabled={props.busy === true}
      data-testid={props.testId}
    >
      {props.label}
    </button>
  );
}
