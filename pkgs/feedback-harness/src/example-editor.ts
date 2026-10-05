import type { Session } from '@pkgs/harness-root-shared/runtime-types';

export function createExampleEditor(session: Session) {
  const field = () => {
    const node = document.querySelector<HTMLElement>(
      '[data-testid="feedback-body"] [role="textbox"]'
    );
    if (!node) throw new Error('Feedback editor missing');
    return node;
  };
  const end = () => {
    const input = field();
    const range = document.createRange();
    range.selectNodeContents(input);
    range.collapse(false);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
  };
  return {
    field,
    async write(text: string) {
      const input = field();
      input.focus();
      input.replaceChildren(
        ...text.split('\n').map((line) => {
          const paragraph = document.createElement('p');
          paragraph.textContent = line;
          return paragraph;
        })
      );
      end();
      input.dispatchEvent(new InputEvent('input', { bubbles: true }));
      await session.waitForIdle();
    },
    async append(text: string) {
      const input = field();
      input.focus();
      const paragraph = input.lastElementChild ?? input;
      const trailing = paragraph.querySelector('br');
      trailing?.remove();
      paragraph.append(document.createTextNode(text));
      end();
      input.dispatchEvent(
        new InputEvent('input', { bubbles: true, data: text })
      );
      await session.waitForIdle();
    },
    async key(key: string) {
      field().dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
      );
      await session.waitForIdle();
    },
    async format(id: string) {
      const control = document.querySelector<HTMLButtonElement>(
        `[data-testid="editor-${id}"]`
      );
      if (!control) throw new Error('Editor format missing');
      control.click();
      await session.waitForIdle();
    },
    view() {
      const input = field();
      return {
        headings: [...input.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(
          (node) => node.textContent
        ),
        suggestions: [
          ...document.querySelectorAll(
            '[role="listbox"][aria-label="Writing commands"] [role="option"]'
          ),
        ].map((node) => node.textContent),
        activeSuggestion: input.getAttribute('aria-activedescendant'),
        expanded: input.getAttribute('aria-expanded'),
        richText: input.getAttribute('contenteditable') === 'true',
        focused: document.activeElement === input,
      };
    },
  };
}
