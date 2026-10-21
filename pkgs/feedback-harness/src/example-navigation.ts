import type { Session } from '@pkgs/harness-root-shared/runtime-types';

function button(label: string) {
  const node = document.querySelector<HTMLButtonElement>(
    `button[aria-label="${label}"]`
  );
  if (!node) throw new Error(`Feedback button missing: ${label}`);
  return node;
}

export function createExampleNavigation(session: Session) {
  return {
    async openIssue(title: string) {
      const row = [
        ...document.querySelectorAll<HTMLButtonElement>(
          '[data-component="FeedbackDocument"]'
        ),
      ].find((node) => node.textContent.includes(title));
      if (!row) throw new Error('Issue missing');
      row.focus();
      row.click();
      await session.waitForIdle();
    },
    async focusIcon(label: string) {
      button(label).focus();
      await session.waitForIdle();
    },
    async key(input: { label: string; key: string }) {
      button(input.label).dispatchEvent(
        new KeyboardEvent('keydown', {
          key: input.key,
          bubbles: true,
          cancelable: true,
        })
      );
      await session.waitForIdle();
    },
    view() {
      const widget = document.querySelector<HTMLElement>(
        '[data-testid="feedback-widget"]'
      );
      const list = document.querySelector(
        '[data-testid="feedback-issue-scroll"]'
      );
      const icons = [
        ...document.querySelectorAll<HTMLButtonElement>(
          '[data-testid="feedback-panel"] button[aria-label]'
        ),
      ];
      return {
        widgetClass: widget?.className,
        listComponent: list?.getAttribute('data-component'),
        listFocusable: list?.getAttribute('tabindex'),
        activeLabel: document.activeElement?.getAttribute('aria-label'),
        directActions: [
          ...document.querySelectorAll(
            '[data-testid="feedback-issue-actions"] button'
          ),
        ].map((node) => node.getAttribute('aria-label')),
        menu:
          document.querySelector('[data-testid="feedback-actions"]') !== null,
        iconLabels: icons.map((icon) => {
          const tooltip = document.getElementById(
            icon.getAttribute('aria-describedby') ?? ''
          );
          return {
            label: icon.getAttribute('aria-label'),
            text: tooltip?.textContent,
            floating:
              tooltip?.closest('[data-component="FloatingTooltip"]') !== null,
            visible: tooltip?.getAttribute('aria-hidden') !== 'true',
          };
        }),
      };
    },
  };
}
