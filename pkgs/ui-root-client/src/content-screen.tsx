import type { JSX } from 'solid-js';
import { ScreenBase } from './screen-base';
import type { ScreenBaseProps } from './screen-base-types';
import { ScreenColumn } from './screen-column';
import type { ScreenMeasure } from './screen-measure';
import { createScreenSlot } from './screen-slot';

export type ContentScreenProps = Pick<
  ScreenBaseProps,
  | 'screenId'
  | 'breadcrumbs'
  | 'actions'
  | 'leading'
  | 'dataSet'
  | 'footer'
  | 'renderActionsMenu'
> & {
  children: JSX.Element;
  width?: ScreenMeasure | 'full' | undefined;
};

/** Readable details, notices, and documents with one whole-body scroller. */
export function ContentScreen(props: ContentScreenProps): JSX.Element {
  const footer = createScreenSlot(() => props.footer);
  return (
    <ScreenBase
      screenId={props.screenId}
      breadcrumbs={props.breadcrumbs}
      actions={props.actions}
      leading={props.leading}
      renderActionsMenu={props.renderActionsMenu}
      footer={
        footer.present() ? (
          <ScreenColumn width={props.width}>{footer.content()}</ScreenColumn>
        ) : undefined
      }
      dataSet={{ component: 'ContentScreen', ...props.dataSet }}
      scroll
      content={() => (
        <ScreenColumn width={props.width}>{props.children}</ScreenColumn>
      )}
    />
  );
}
