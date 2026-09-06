/** Web host for localhost actor documents (iframe). */
export function ActorUrlFrame(props: {
  readonly title: string;
  readonly url: string;
}) {
  return <iframe title={props.title} src={props.url} style={frameStyle} />;
}

const frameStyle = {
  flex: '1',
  width: '100%',
  height: '100%',
  border: 'none',
  'min-height': '0',
} as const;
