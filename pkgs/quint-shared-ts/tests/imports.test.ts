import { expect, test } from 'bun:test';
import { quintImportPaths } from '@pkgs/quint-shared-ts/imports';

test('only real import declarations contribute source dependencies', () => {
  expect(
    quintImportPaths(`module example {
    // import ignored.* from "./missing"
    /* import another.* from "./absent" */
    val example = "import sample.* from \\\"./quoted\\\""
    import events.*
      from "../events"
    import model(a = 1).* from "./model.qnt"
  }`)
  ).toEqual(['../events', './model.qnt']);
});
