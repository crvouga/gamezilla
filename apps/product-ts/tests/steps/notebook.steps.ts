import { expect } from 'bun:test';
import {
  editNotebookQuestion,
  FRIENDS_QUESTION,
  notebookAnswer,
  openNotebook,
  SPACES_QUESTION,
  savedNotebook,
  saveNotebookQuestion,
  shownNotebook,
} from '@apps/product-ts/developer-notebook';
import { Given, Then, When } from '@libs/harness-ts/define';
import type { Actor } from '@libs/harness-ts/parameter-types';

Given(
  "{actor}'s phone has a saved data notebook question about her friends",
  async (w, actor: Actor) => {
    await w.s.apply(saveNotebookQuestion, actor, 'friends');
  }
);
Given(
  "{actor}'s phone has a saved data notebook question about his spaces",
  async (w, actor: Actor) => {
    await w.s.apply(saveNotebookQuestion, actor, 'spaces');
  }
);
Given(
  "the team has been investigating {actor}'s phone",
  async (w, actor: Actor) => {
    await w.s.apply(openNotebook, actor);
  }
);
When(
  "the team opens the data notebook for {actor}'s phone",
  async (w, actor: Actor) => {
    await w.s.apply(openNotebook, actor);
  }
);
Then(
  "the team sees {actor}'s saved data notebook question about her friends",
  async (w, actor: Actor) => {
    expect((await w.s.read(shownNotebook))?.nodeId).toBe(actor);
    expect((await w.s.read(shownNotebook))?.cells[0]?.sql).toBe(
      FRIENDS_QUESTION
    );
  }
);
Then(
  "the team sees {actor}'s saved data notebook question about his spaces",
  async (w, actor: Actor) => {
    expect((await w.s.read(shownNotebook))?.nodeId).toBe(actor);
    expect((await w.s.read(shownNotebook))?.cells[0]?.sql).toBe(
      SPACES_QUESTION
    );
  }
);
Then(
  "{actor}'s data notebook still keeps the question about her friends",
  async (w, actor: Actor) => {
    expect((await w.s.read(savedNotebook, actor))?.cells[0]?.sql).toBe(
      FRIENDS_QUESTION
    );
  }
);
Given(
  "the team's data notebook has a question about {actor}'s friends",
  async (w, actor: Actor) => {
    await w.s.apply(saveNotebookQuestion, actor, 'friends');
  }
);
Given(
  "the team's data notebook question about {actor}'s friends answers automatically",
  async (w, actor: Actor) => {
    await w.s.apply(saveNotebookQuestion, actor, 'friends', {
      automatic: true,
    });
  }
);
Given(
  "the team's data notebook has questions about {actor}'s friends and {actor}'s spaces",
  async (w, actor: Actor) => {
    await w.s.apply(saveNotebookQuestion, actor, 'friends', { two: true });
  }
);
Given(
  "the team's data notebook has only a question about {actor}'s friends",
  async (w, actor: Actor) => {
    await w.s.apply(saveNotebookQuestion, actor, 'friends');
  }
);
Given(
  'the team has a data notebook question that cannot be answered',
  async (w) => {
    await w.s.apply(saveNotebookQuestion, 'alice', 'invalid');
  }
);
When(
  "the team duplicates the data notebook question about {actor}'s friends",
  async (w) => {
    await w.s.apply(editNotebookQuestion, 'duplicate');
  }
);
When(
  "the team removes the data notebook question about {actor}'s friends",
  async (w) => {
    await w.s.apply(editNotebookQuestion, 'remove');
  }
);
When(
  "the team runs the data notebook question about {actor}'s friends",
  async (w) => {
    await w.s.apply(editNotebookQuestion, 'run');
  }
);
When('the team runs that data notebook question', async (w) => {
  await w.s.apply(editNotebookQuestion, 'run');
});
Then(
  'the team sees the copied question immediately after its original',
  async (w) => {
    const doc = await w.s.read(shownNotebook);
    expect(doc?.cells).toHaveLength(2);
    expect(doc?.cells[1]?.sql).toBe(doc?.cells[0]?.sql);
    expect(doc?.cells[1]?.id).not.toBe(doc?.cells[0]?.id);
  }
);
Then(
  'the copied question still waits for the team to ask for its answer',
  async (w) => {
    expect((await w.s.read(shownNotebook))?.cells[1]?.live).toBe(false);
  }
);
Then(
  "the team sees only the data notebook question about {actor}'s spaces",
  async (w) => {
    expect(
      (await w.s.read(shownNotebook))?.cells.map((cell) => cell.sql)
    ).toEqual([SPACES_QUESTION]);
  }
);
Then(
  'the data notebook still has that question because it is the last one',
  async (w) => {
    expect(
      (await w.s.read(shownNotebook))?.cells.map((cell) => cell.sql)
    ).toEqual([FRIENDS_QUESTION]);
  }
);
Then("the team sees the question's answer", async (w) => {
  expect((await w.s.read(notebookAnswer))?.error).toBeNull();
  expect((await w.s.read(notebookAnswer))?.statements[0]?.kind).toBe('rows');
});
Then('the team is told why the data notebook question failed', async (w) => {
  expect((await w.s.read(notebookAnswer))?.error).toContain(
    'nonexistent_investigation_table'
  );
});
When(
  "the team changes that data notebook question to ask about {actor}'s spaces",
  async (w) => {
    await w.s.apply(editNotebookQuestion, 'edit-spaces');
  }
);
When(
  "the team moves the data notebook question about {actor}'s spaces ahead",
  async (w) => {
    await w.s.apply(editNotebookQuestion, 'move-spaces-ahead');
  }
);
When(
  "the team moves the data notebook question about {actor}'s friends ahead",
  async (w) => {
    await w.s.apply(editNotebookQuestion, 'move-friends-ahead');
  }
);
Given(
  "the team's data notebook question would answer with {int} rows",
  async (w, rows: number) => {
    await w.s.apply(saveNotebookQuestion, 'alice', 'count', { rows });
  }
);
Then(
  "the team sees the data notebook question about {actor}'s spaces first",
  async (w) => {
    expect((await w.s.read(shownNotebook))?.cells[0]?.sql).toBe(
      SPACES_QUESTION
    );
  }
);
Then(
  "the team sees the data notebook question about {actor}'s friends first",
  async (w) => {
    expect((await w.s.read(shownNotebook))?.cells[0]?.sql).toBe(
      FRIENDS_QUESTION
    );
  }
);
Then(
  'the team sees 5000 rows and is not told the answer was cut off',
  async (w) => {
    const statement = (await w.s.read(notebookAnswer))?.statements[0];
    expect(statement?.kind).toBe('rows');
    if (statement?.kind !== 'rows') return;
    expect(statement.rows).toHaveLength(5000);
    expect(statement.truncated).toBe(false);
  }
);
Then(
  'the team sees 5000 rows and is told the answer was cut off',
  async (w) => {
    const statement = (await w.s.read(notebookAnswer))?.statements[0];
    expect(statement?.kind).toBe('rows');
    if (statement?.kind !== 'rows') return;
    expect(statement.rows).toHaveLength(5000);
    expect(statement.truncated).toBe(true);
  }
);
