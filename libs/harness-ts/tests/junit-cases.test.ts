import { expect, test } from 'bun:test';
import { parseJunit } from '@libs/harness-ts/junit-cases';

test('cases keep their outcome, file and line through nested suites', () => {
  const cases = parseJunit(
    `<?xml version="1.0"?>
<testsuites>
  <testsuite name="a.test.ts" file="tests/a.test.ts">
    <testsuite name="group" file="tests/a.test.ts" line="3">
      <testcase name="adds &amp; &quot;quotes&quot;" classname="group" time="0.01" line="4" />
      <testcase name="fails" line="9">
        <failure type="AssertionError" message="short">expected &lt;1&gt;
at line</failure>
      </testcase>
    </testsuite>
    <testcase name="skipped"><skipped /></testcase>
    <testcase name="errors" file="tests/other.test.ts"><error message="boom" /></testcase>
  </testsuite>
</testsuites>`
  );
  expect(cases).toEqual([
    {
      file: 'tests/a.test.ts',
      name: 'adds & "quotes"',
      line: 4,
      status: 'passed',
      failure: null,
    },
    {
      file: 'tests/a.test.ts',
      name: 'fails',
      line: 9,
      status: 'failed',
      failure: 'expected <1>\nat line',
    },
    {
      file: 'tests/a.test.ts',
      name: 'skipped',
      line: null,
      status: 'skipped',
      failure: null,
    },
    {
      file: 'tests/other.test.ts',
      name: 'errors',
      line: null,
      status: 'failed',
      failure: 'boom',
    },
  ]);
});

test('text without cases reads as none', () => {
  expect(parseJunit('not xml')).toEqual([]);
});
