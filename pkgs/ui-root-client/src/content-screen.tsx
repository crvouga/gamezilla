import type { JSX } from 'solid-js';
import { ScreenBase } from './screen-base';
import type { ScreenBaseProps } from './screen-base-types';
import { ScreenColumn } from './screen-column';

export type ContentScreenProps = Pick<
  ScreenBaseProps,
  | 'screenId'
  | 'breadcrumbs'
  | 'actions'
  | 'leading'
  | 'surface'
  | 'dataSet'
  | 'footer'
> & {
  children: JSX.Element;
  width?: 'reading' | 'stage' | 'full' | undefined;
};

/** Readable details, notices, and documents with one whole-body scroller. */
export function ContentScreen(props: ContentScreenProps): JSX.Element {
  return (
    <ScreenBase
      screenId={props.screenId}
      breadcrumbs={props.breadcrumbs}
      actions={props.actions}
      leading={props.leading}
      surface={props.surface}
      footer={props.footer}
      dataSet={{ component: 'ContentScreen', ...props.dataSet }}
      scroll
      content={() => (
        <ScreenColumn width={props.width}>{props.children}</ScreenColumn>
      )}
    />
  );
}
