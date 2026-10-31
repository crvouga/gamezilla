import type { JSX } from 'solid-js';
import { ScreenBase } from '../screen-base/index';
import type { ScreenBaseProps } from '../screen-base-types';
import { ScreenColumn } from '../screen-column/index';
import type { ScreenMeasure } from '../screen-measure';
import { createScreenSlot } from '../screen-slot';

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
  /**
   * The column's measure. Defaults to `prose`; menus, forms and profiles
   * pass `menu`. On wide layouts the column and the page title center
   * together.
   */
  width?: ScreenMeasure | undefined;
};

/** Readable details, notices, and documents with one whole-body scroller. */
export function ContentScreen(props: ContentScreenProps): JSX.Element {
  const footer = createScreenSlot(() => props.footer);
  const width = (): ScreenMeasure => props.width ?? 'prose';
  return (
    <ScreenBase
      screenId={props.screenId}
      breadcrumbs={props.breadcrumbs}
      actions={props.actions}
      leading={props.leading}
      renderActionsMenu={props.renderActionsMenu}
      measure={width()}
      footer={
        footer.present() ? (
          <ScreenColumn width={width()}>{footer.content()}</ScreenColumn>
        ) : undefined
      }
      dataSet={{ component: 'ContentScreen', ...props.dataSet }}
      scroll
      content={() => (
        <ScreenColumn width={width()}>{props.children}</ScreenColumn>
      )}
    />
  );
}
