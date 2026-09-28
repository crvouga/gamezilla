/**
 * Each ACT rule on passed, failed and inapplicable examples adapted from its
 * W3C ACT Rules test cases.
 */

import { describe, expect, test } from 'bun:test';
import {
  type ActRule,
  ariaHiddenNotFocusable,
  auditTree,
  buttonName,
  formatFailure,
  formFieldName,
  imageName,
  labelInName,
  linkName,
  menuitemName,
  requiredContext,
  requiredOwned,
  requiredStates,
  validRole,
} from '@pkgs/a11y';
import { byId, page } from './dom';

type Outcome = 'passed' | 'failed' | 'inapplicable';

function outcome(rule: ActRule, html: string): Outcome {
  const target = byId(page(html), 'target');
  if (!rule.applicable(target)) return 'inapplicable';
  return rule.passes(target) ? 'passed' : 'failed';
}

const CASES: readonly (readonly [ActRule, Outcome, string])[] = [
  [buttonName, 'passed', '<button id="target">My button</button>'],
  [
    buttonName,
    'passed',
    '<span id="target" role="button" aria-label="Go"></span>',
  ],
  [buttonName, 'failed', '<button id="target"></button>'],
  [
    buttonName,
    'failed',
    '<button id="target"><span aria-hidden="true">x</span></button>',
  ],
  [
    buttonName,
    'inapplicable',
    '<button id="target" style="display:none"></button>',
  ],
  [buttonName, 'inapplicable', '<input id="target" type="image" src="x.png">'],
  [linkName, 'passed', '<a id="target" href="#">Home</a>'],
  [linkName, 'failed', '<a id="target" href="#"><img alt="" src="x.png"></a>'],
  [linkName, 'inapplicable', '<a id="target">not a link</a>'],
  [formFieldName, 'passed', '<label>Name <input id="target"></label>'],
  [formFieldName, 'failed', '<input id="target">'],
  [
    formFieldName,
    'failed',
    '<div id="target" role="switch" aria-checked="false"></div>',
  ],
  [formFieldName, 'inapplicable', '<input id="target" aria-hidden="true">'],
  [
    menuitemName,
    'passed',
    '<div role="menu"><button id="target" role="menuitem">New</button></div>',
  ],
  [
    menuitemName,
    'failed',
    '<div role="menu"><button id="target" role="menuitem"></button></div>',
  ],
  [imageName, 'passed', '<img id="target" alt="W3C logo" src="w3c.png">'],
  [
    imageName,
    'passed',
    '<span id="target" role="img" aria-label="Your avatar"></span>',
  ],
  [imageName, 'failed', '<img id="target" src="w3c.png">'],
  [imageName, 'inapplicable', '<img id="target" alt="" src="w3c.png">'],
  [imageName, 'inapplicable', '<img id="target" role="none" src="w3c.png">'],
  [
    labelInName,
    'passed',
    '<button id="target" aria-label="Next page">Next</button>',
  ],
  [
    labelInName,
    'passed',
    '<a id="target" href="#" aria-label="Go to Settings!">settings</a>',
  ],
  [
    labelInName,
    'failed',
    '<button id="target" aria-label="Online">Connectivity <span>Online</span></button>',
  ],
  [
    labelInName,
    'failed',
    '<a id="target" href="#" aria-label="Next">Proceed</a>',
  ],
  [
    labelInName,
    'inapplicable',
    '<button id="target" aria-label="Close"><span aria-hidden="true"></span></button>',
  ],
  [validRole, 'passed', '<div id="target" role="button">x</div>'],
  [validRole, 'passed', '<div id="target" role="foo button">x</div>'],
  [validRole, 'failed', '<div id="target" role="lnik">x</div>'],
  [validRole, 'inapplicable', '<div id="target" role="lnik" hidden>x</div>'],
  [
    requiredOwned,
    'passed',
    '<div id="target" role="tablist"><div><button role="tab">A</button></div></div>',
  ],
  [
    requiredOwned,
    'passed',
    '<div id="target" role="menu"><div><button role="menuitem">A</button><div aria-hidden="true"></div></div></div>',
  ],
  [
    requiredOwned,
    'failed',
    '<div id="target" role="tablist"><button>A</button></div>',
  ],
  [
    requiredOwned,
    'failed',
    '<div id="target" role="list"><span role="button">x</span></div>',
  ],
  [
    requiredOwned,
    'inapplicable',
    '<ul id="target"><li>implicit list</li></ul>',
  ],
  [
    requiredOwned,
    'inapplicable',
    '<div id="target" role="list" aria-busy="true"><span role="button">x</span></div>',
  ],
  [
    requiredContext,
    'passed',
    '<div role="tablist"><span><button id="target" role="tab">A</button></span></div>',
  ],
  [
    requiredContext,
    'failed',
    '<div><button id="target" role="tab">A</button></div>',
  ],
  [
    requiredContext,
    'failed',
    '<div role="list"><button id="target" role="menuitem">A</button></div>',
  ],
  [requiredContext, 'inapplicable', '<ul><li id="target">implicit</li></ul>'],
  [
    requiredStates,
    'passed',
    '<div id="target" role="checkbox" aria-checked="false">x</div>',
  ],
  [
    requiredStates,
    'passed',
    '<input id="target" type="checkbox" role="switch">',
  ],
  [requiredStates, 'failed', '<div id="target" role="switch">x</div>'],
  [requiredStates, 'failed', '<div id="target" role="heading">x</div>'],
  [requiredStates, 'inapplicable', '<h2 id="target" role="heading">x</h2>'],
  [
    ariaHiddenNotFocusable,
    'passed',
    '<div id="target" aria-hidden="true"><button tabindex="-1">x</button></div>',
  ],
  [
    ariaHiddenNotFocusable,
    'passed',
    '<div id="target" aria-hidden="true"><button disabled>x</button></div>',
  ],
  [
    ariaHiddenNotFocusable,
    'failed',
    '<div id="target" aria-hidden="true"><a href="#">x</a></div>',
  ],
  [
    ariaHiddenNotFocusable,
    'inapplicable',
    '<div id="target" aria-hidden="false"><a href="#">x</a></div>',
  ],
];

describe('ACT rules', () => {
  test.each(
    CASES.map(
      ([rule, expected, html]) => [rule.id, expected, html, rule] as const
    )
  )('%s %s: %s', (_, expected, html, rule) => {
    expect(outcome(rule, html)).toBe(expected);
  });

  test('an audit lists every failure in tree order, as a listener hears the target', () => {
    const document = page(
      '<div role="tablist"><button aria-label="Spaces">Spaces</button></div><a href="#"></a><img src="x.png">'
    );
    expect(auditTree(document.body).map(formatFailure)).toEqual([
      'bc4a75 ARIA required owned elements (WCAG 1.3.1): tablist ""',
      'c487ae Link has non-empty accessible name (WCAG 2.4.4, 2.4.9, 4.1.2): link ""',
      '23a2a8 Image has non-empty accessible name (WCAG 1.1.1): img ""',
    ]);
  });
});
