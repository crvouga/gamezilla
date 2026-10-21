/** The controls on a page and the stops a keyboard should make among them. */

import { describe, expect, test } from 'bun:test';
import {
  controlsIn,
  describeControl,
  keyboardStops,
} from '@pkgs/a11y-shared-ts/controls';
import { page } from './dom';

function heard(elements: readonly Element[]): string[] {
  return elements.map(describeControl);
}

describe('controls', () => {
  test('native, widget-role and tabindex controls, in reading order', () => {
    const document = page(
      '<h1>Title</h1><button>One</button><div role="switch" aria-checked="true" aria-label="Sound"></div><a href="#">Two</a><a>not a link</a><div tabindex="0" aria-label="Card"></div><button disabled>Off</button><button hidden>Gone</button><div inert><button>Inert</button></div><input aria-label="Search">'
    );
    expect(heard(controlsIn(document.body))).toEqual([
      'button "One"',
      'switch "Sound"',
      'link "Two"',
      'generic "Card"',
      'textbox "Search"',
    ]);
  });

  test('a control the keyboard cannot reach is still a stop it should make', () => {
    const document = page(
      '<div role="button" aria-label="Clickable card"></div>'
    );
    expect(heard(keyboardStops(document.body))).toEqual([
      'button "Clickable card"',
    ]);
  });

  test("a composite's arrow-key members are one stop with the composite", () => {
    const document = page(
      '<div role="tablist"><button role="tab" aria-selected="true">A</button><button role="tab" tabindex="-1">B</button></div><div role="menu"><button role="menuitem">X</button><button role="menuitem">Y</button></div>'
    );
    expect(heard(keyboardStops(document.body))).toEqual([
      'tab "A"',
      'menuitem "X"',
      'menuitem "Y"',
    ]);
  });

  test('a radio group is one stop; a tabindex -1 control outside a composite is not excused', () => {
    const document = page(
      '<label><input type="radio" name="size">S</label><label><input type="radio" name="size" checked>M</label><button tabindex="-1">Hidden from Tab</button>'
    );
    expect(heard(keyboardStops(document.body))).toEqual([
      'radio "M"',
      'button "Hidden from Tab"',
    ]);
  });
});
