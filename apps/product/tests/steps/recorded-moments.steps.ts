import { expect } from 'bun:test';
import {
  provideRecordedReport,
  selectRecordedMoment,
  shownControlResult,
  shownMoment,
  shownObservations,
  shownPicture,
  showRecordedControl,
} from '@apps/product/developer-report';
import { Given, Then, When } from '@libs/harness/define';

Given(
  'a test report has several failed steps with recorded moments',
  async (w) => {
    await w.s.apply(provideRecordedReport, 'failed');
  }
);
Given('a passing test report has several recorded moments', async (w) => {
  await w.s.apply(provideRecordedReport, 'passed');
});
When('the team opens that test report', async (w) => {
  await w.s.apply(selectRecordedMoment);
});
Then(
  "the team sees the first failed step's first recorded moment",
  async (w) => {
    expect(await w.s.read(shownMoment)).toBe(1);
  }
);
Then('the team sees its final recorded moment', async (w) => {
  expect(await w.s.read(shownMoment)).toBe(2);
});
Given(
  "a test report has Alice's picture at the second recorded moment",
  async (w) => {
    await w.s.apply(provideRecordedReport, 'passed');
  }
);
Given(
  "a test report has Bob's pictures only at its first and third recorded moments",
  async (w) => {
    await w.s.apply(provideRecordedReport, 'passed');
  }
);
When('the team selects the second recorded moment', async (w) => {
  await w.s.apply(selectRecordedMoment, 2);
});
Then(
  "the team sees Alice's picture from the second recorded moment",
  async (w) => {
    expect(await w.s.read(shownPicture, 'alice')).toEqual({
      file: 'frames/alice-2.html',
      earlier: false,
    });
  }
);
Then("the team sees Bob's first picture marked as earlier", async (w) => {
  expect(await w.s.read(shownPicture, 'bob')).toEqual({
    file: 'frames/bob-1.html',
    earlier: true,
  });
});
Then(
  "Bob's third picture cannot appear because it was recorded later",
  async (w) => {
    expect((await w.s.read(shownPicture, 'bob')).file).not.toBe(
      'frames/bob-3.html'
    );
  }
);
Given(
  "a recorded moment has observations but no person's picture",
  async (w) => {
    await w.s.apply(provideRecordedReport, 'observations', 2);
  }
);
When('the team selects that recorded moment', async (w) => {
  await w.s.apply(selectRecordedMoment, 2);
});
Then('the team sees the observations recorded at that moment', async (w) => {
  expect(await w.s.read(shownObservations)).toContain(
    'The invitation is waiting at moment 2'
  );
});
Given(
  "Bob's first picture was captured after the selected recorded moment",
  async (w) => {
    await w.s.apply(provideRecordedReport, 'future', 2);
  }
);
When('the team shows Bob at the selected recorded moment', async (w) => {
  await w.s.apply(selectRecordedMoment, 2);
});
Then(
  "Bob's picture is not offered because none was recorded by that moment",
  async (w) => {
    expect((await w.s.read(shownPicture, 'bob')).file).toBeNull();
  }
);
Given(
  "a recorded moment names a control present in Alice's picture",
  async (w) => {
    await w.s.apply(provideRecordedReport, 'control', 2);
  }
);
Given(
  "a recorded moment names a control absent from Alice's picture",
  async (w) => {
    await w.s.apply(provideRecordedReport, 'missing-control', 2);
  }
);
When('the team shows the recorded action in that moment', async (w) => {
  await w.s.apply(showRecordedControl);
});
Then("the team sees that control highlighted in Alice's picture", async (w) => {
  expect(await w.s.read(shownControlResult)).toBe('found');
});
Then(
  'the team is told the recorded control cannot be found in that picture',
  async (w) => {
    expect(await w.s.read(shownControlResult)).toBe('missing');
  }
);
