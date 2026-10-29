import { describe, expect, test } from 'bun:test';
import { SettingsIcon } from '@pkgs/ui-root-client-ts/icons';
import {
  bodyNeedsSafeBottom,
  bodyScrolledPastTop,
  buildBodyContentProps,
  deriveHeaderLayout,
  hasScreenBaseActions,
  isNavigableBreadcrumb,
  lastBreadcrumbTitle,
  partitionScreenBaseActions,
  screenBaseActionIntent,
  splitBreadcrumbTrail,
} from '@pkgs/ui-root-client-ts/screen-base-logic';
import type {
  ScreenBaseAction,
  ScreenBaseBreadcrumb,
} from '@pkgs/ui-root-client-ts/screen-base-types';

const noop = (): void => {};

describe('screenBaseActionIntent', () => {
  test('maps action types to button intents', () => {
    expect(screenBaseActionIntent('submit')).toBe('primary');
    expect(screenBaseActionIntent('destructive')).toBe('danger');
    expect(screenBaseActionIntent('secondary')).toBe('neutral');
    expect(screenBaseActionIntent('default')).toBe('neutral');
  });
});

describe('partitionScreenBaseActions', () => {
  test('icon actions become ActionBar items, others become text actions', () => {
    const actions: ScreenBaseAction[] = [
      { type: 'default', label: 'Settings', icon: SettingsIcon, onClick: noop },
      {
        type: 'submit',
        label: 'Save',
        onClick: noop,
        loading: true,
        overflow: 'never',
      },
      { type: 'destructive', label: 'Delete', onClick: noop, disabled: true },
    ];
    const partition = partitionScreenBaseActions(actions);
    expect(partition.iconItems.map((i) => i.id)).toEqual(['action-0']);
    expect(partition.textActions).toEqual([
      {
        id: 'text-action-1',
        label: 'Save',
        onClick: noop,
        intent: 'primary',
        loading: true,
        disabled: false,
        overflow: 'never',
      },
      {
        id: 'text-action-2',
        label: 'Delete',
        onClick: noop,
        intent: 'danger',
        loading: false,
        disabled: true,
        overflow: undefined,
      },
    ]);
    expect(hasScreenBaseActions(partition)).toBe(true);
    expect(hasScreenBaseActions(partitionScreenBaseActions([]))).toBe(false);
  });
});

describe('breadcrumb helpers', () => {
  const crumbs: ScreenBaseBreadcrumb[] = [
    { name: 'Home', href: '/' },
    { name: 'Settings', onClick: noop },
    { name: 'Sound' },
  ];

  test('lastBreadcrumbTitle / splitBreadcrumbTrail', () => {
    expect(lastBreadcrumbTitle(crumbs)).toBe('Sound');
    expect(lastBreadcrumbTitle([])).toBeUndefined();
    const trail = splitBreadcrumbTrail(crumbs);
    expect(trail.ancestors.map((c) => c.name)).toEqual(['Home', 'Settings']);
    expect(trail.current?.name).toBe('Sound');
    expect(splitBreadcrumbTrail([]).current).toBeUndefined();
  });

  test('isNavigableBreadcrumb accepts onClick or href', () => {
    expect(isNavigableBreadcrumb({ name: 'a', href: '/a' })).toBe(true);
    expect(isNavigableBreadcrumb({ name: 'a', onClick: noop })).toBe(true);
    expect(isNavigableBreadcrumb({ name: 'a' })).toBe(false);
  });

  test('deriveHeaderLayout shows back only for a navigable parent crumb', () => {
    const layout = deriveHeaderLayout(crumbs);
    expect(layout.title).toBe('Sound');
    expect(layout.backCrumb?.name).toBe('Settings');
    expect(layout.showBack).toBe(true);
    expect(deriveHeaderLayout([{ name: 'Only' }]).showBack).toBe(false);
    expect(
      deriveHeaderLayout([{ name: 'Static' }, { name: 'Current' }]).showBack
    ).toBe(false);
  });

  test('Settings → Components trail shows Back to Settings (UI explorer)', () => {
    const layout = deriveHeaderLayout([
      { name: 'Spaces', href: '/' },
      { name: 'Settings', href: '/more' },
      { name: 'Components' },
    ]);
    expect(layout.title).toBe('Components');
    expect(layout.showBack).toBe(true);
    expect(layout.backCrumb).toEqual({ name: 'Settings', href: '/more' });
  });
});

describe('body helpers', () => {
  test('buildBodyContentProps flexes non-scroll bodies and forwards titleScroll', () => {
    expect(buildBodyContentProps(true, undefined)).toEqual({ bodyClass: '' });
    expect(buildBodyContentProps(false, undefined)).toEqual({
      bodyClass: 'flex-1 min-h-0',
    });
    const titleScroll = { onScroll: noop };
    expect(buildBodyContentProps(false, titleScroll)).toEqual({
      bodyClass: 'flex-1 min-h-0',
      titleScroll,
    });
  });

  test('bodyNeedsSafeBottom only without pinned chrome', () => {
    expect(bodyNeedsSafeBottom({ hasFooter: false, hasBottomBar: false })).toBe(
      true
    );
    expect(bodyNeedsSafeBottom({ hasFooter: true, hasBottomBar: false })).toBe(
      false
    );
    expect(bodyNeedsSafeBottom({ hasFooter: false, hasBottomBar: true })).toBe(
      false
    );
  });
});

describe('bodyScrolledPastTop', () => {
  test('a vertical scroller reports whether it has left its top', () => {
    const tall = { scrollHeight: 2000, clientHeight: 600 };
    expect(bodyScrolledPastTop({ ...tall, scrollTop: 0 })).toBe(false);
    expect(bodyScrolledPastTop({ ...tall, scrollTop: 1 })).toBe(true);
  });

  test('a scroller with nothing to scroll vertically says nothing', () => {
    expect(
      bodyScrolledPastTop({
        scrollHeight: 600,
        clientHeight: 600,
        scrollTop: 0,
      })
    ).toBeUndefined();
  });
});
