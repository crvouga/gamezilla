/**
 * Examples from the W3C Accessible Name and Description Computation 1.2 and
 * its web-platform-tests (`accname/name/*`), plus the HTML-AAM native sources.
 */

import { describe, expect, test } from 'bun:test';
import { accessibleName } from '@pkgs/a11y-shared/accessible-name';
import { byId, page } from './dom';

function nameOf(html: string, id = 'test'): string {
  const document = page(html);
  return accessibleName(byId(document, id));
}

describe('accessible name', () => {
  test.each([
    ['content of a button', '<button id="test">Submit</button>', 'Submit'],
    [
      'aria-label over content',
      '<button id="test" aria-label="Close">X</button>',
      'Close',
    ],
    [
      'aria-labelledby over aria-label, in reference order',
      '<span id="a">Hello</span><span id="b">World</span><button id="test" aria-label="x" aria-labelledby="b a">y</button>',
      'World Hello',
    ],
    [
      'self reference in aria-labelledby (accname § 4.3.1 example)',
      '<button id="test" aria-label="Delete" aria-labelledby="test file">X</button><span id="file">report.doc</span>',
      'Delete report.doc',
    ],
    [
      'a hidden node referenced by aria-labelledby still names',
      '<div id="test" role="button" aria-labelledby="h"></div><span id="h" hidden>Hidden <span>label</span></span>',
      'Hidden label',
    ],
    [
      'hidden content does not name',
      '<a id="test" href="#">Link <span hidden>secret</span><span aria-hidden="true">icon</span></a>',
      'Link',
    ],
    [
      'embedded textbox in a label speaks its value (wpt name_checkbox-label-embedded-textbox)',
      '<input type="checkbox" id="test"><label for="test">Flash the screen <input type="text" value="5"> times.</label>',
      'Flash the screen 5 times.',
    ],
    [
      'embedded select speaks its selected option',
      '<input type="checkbox" id="test"><label for="test">Flash <select><option>1</option><option selected>3</option></select> times</label>',
      'Flash 3 times',
    ],
    [
      'embedded slider speaks aria-valuetext',
      '<input type="checkbox" id="test"><label for="test">Flash <span role="slider" aria-valuenow="4" aria-valuetext="four"></span> times</label>',
      'Flash four times',
    ],
    [
      'wrapping label, the control itself excluded',
      '<label>Name <input id="test" value="Bob"></label>',
      'Name',
    ],
    ['input submit default', '<input id="test" type="submit">', 'Submit'],
    ['input reset default', '<input id="test" type="reset">', 'Reset'],
    ['input button value', '<input id="test" type="button" value="Go">', 'Go'],
    [
      'image button alt',
      '<input id="test" type="image" alt="Search">',
      'Search',
    ],
    [
      'title before placeholder for a text field',
      '<input id="test" title="Title" placeholder="Placeholder">',
      'Title',
    ],
    [
      'placeholder as a last resort',
      '<input id="test" placeholder="Email">',
      'Email',
    ],
    ['img alt', '<img id="test" alt="A cat" src="x.png">', 'A cat'],
    [
      'decorative img',
      '<img id="test" alt="" title="ignored" src="x.png">',
      '',
    ],
    [
      'img title without alt',
      '<img id="test" title="Logo" src="x.png">',
      'Logo',
    ],
    [
      'name from an image in a button',
      '<button id="test"><img alt="Save" src="s.png"></button>',
      'Save',
    ],
    [
      'title on an empty button',
      '<button id="test" title="Tip"></button>',
      'Tip',
    ],
    [
      'svg title',
      '<svg id="test" role="img"><title>Chart</title></svg>',
      'Chart',
    ],
    [
      'fieldset legend',
      '<fieldset id="test"><legend>Group</legend><input></fieldset>',
      'Group',
    ],
    [
      'role img takes aria-label, not content',
      '<span id="test" role="img" aria-label="Your avatar"><img alt="" src="a.svg"></span>',
      'Your avatar',
    ],
    [
      'role img has no name from content',
      '<span id="test" role="img">text</span>',
      '',
    ],
    [
      'blocks are separate words, inline runs are not',
      '<button id="test"><div>Appearance</div><div>Sys<b>tem</b></div></button>',
      'Appearance System',
    ],
    [
      'whitespace-only aria-label is ignored',
      '<button id="test" aria-label="   ">Ok</button>',
      'Ok',
    ],
    [
      'a label[for] on a button names it',
      '<label for="test">Send</label><button id="test">→</button>',
      'Send',
    ],
  ])('%s', (_, html, expected) => {
    expect(nameOf(html)).toBe(expected);
  });

  test('aria-labelledby is not followed twice (accname § 4.3.2 step 2B)', () => {
    const html =
      '<span id="el1" aria-labelledby="el3"></span><button id="el2" aria-labelledby="el1"></button><span id="el3">hello</span>';
    expect(nameOf(html, 'el2')).toBe('');
  });
});
