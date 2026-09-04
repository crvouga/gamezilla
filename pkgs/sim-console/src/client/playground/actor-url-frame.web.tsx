/**
 * Web host for localhost actor documents (bun-webview / Expo web preview).
 * Native falls back to `actor-url-frame.tsx`.
 */
export function ActorUrlFrame(props: {
  readonly title: string;
  readonly url: string;
}) {
  return (
    <iframe
      title={props.title}
      src={props.url}
      style={frameStyle}
    />
  );
}

const frameStyle = {
  flex: 1,
  width: '100%',
  height: '100%',
  borderWidth: 0,
  borderStyle: 'none',
  minHeight: 0,
} as const;
