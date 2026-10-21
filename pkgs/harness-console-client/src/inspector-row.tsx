import { Divider } from '@pkgs/ui-root-client/divider';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client/stack';
import { P } from '@pkgs/ui-root-client/text';
import type { JSX } from 'solid-js';

/**
 * One dense row of an inspector list (a backend, a route, a topic): an
 * optional glyph, a mono identifier that takes the room, trailing facts,
 * and a hairline below.
 */
export function InspectorRow(props: {
  readonly label: string;
  readonly leading?: JSX.Element;
  readonly trailing?: JSX.Element;
  readonly secondary?: boolean;
}): JSX.Element {
  return (
    <StackVertical>
      <StackHorizontal align="center" gap="sm" paddingY="xs">
        {props.leading}
        <StackHorizontal grow>
          <P
            variant="mono"
            tone={props.secondary === true ? 'secondary' : 'default'}
            lines={1}
          >
            {props.label}
          </P>
        </StackHorizontal>
        {props.trailing}
      </StackHorizontal>
      <Divider />
    </StackVertical>
  );
}

/** A titled group of {@link InspectorRow}s. */
export function InspectorSection(props: {
  readonly title: string;
  readonly children: JSX.Element;
}): JSX.Element {
  return (
    <StackVertical gap="xs">
      <P variant="footnote">{props.title}</P>
      <StackVertical>{props.children}</StackVertical>
    </StackVertical>
  );
}
