Publish the repository's design system to the Gamezilla design-system
artifact, {{ARTIFACT_URL}}. Do nothing else: no repository edits, no commits.

The files to publish are already built under `{{FOLDER}}/project/`, and
`{{FOLDER}}/files.json` lists them. They are generated from the repository,
which is the only place this design system is edited; publish them exactly
as built, without rewriting their content.

1. Read the artifact (`action: "read"` on the URL above) and list its files
   (`action: "list"`, `scope: "files"`). Follow the artifact type's own
   instructions for a system kept in files.
2. Read the live index, `project/design-system.json`. Write a copy to
   `{{FOLDER}}/project/design-system.json` that keeps every key and the
   `createdOnFiles` marker as read, and sets:
   - `"editing": "code"`, so the page is read-only and sends edits to code;
   - `"namespace": "Gamezilla"` and `"libraries": []`;
   - `lastChange` to `{"by": "Gamezilla repository", "via": "Claude Code · design:sync", "at": <now>, "note": "Republished from the repository"}`.
3. Publish in one call: `url` the artifact, `root` `{{FOLDER}}`, `file_path`
   the absolute path of `{{FOLDER}}/project/README.md`, and `files` mapping
   every other path in `files.json` to itself, plus
   `project/design-system.json`. Map to `null` every existing file under
   `project/` that `files.json` does not list (the generated `tokens.css`,
   `api/` cards and `manifest.json` excepted), so the artifact holds exactly
   what the repository has. If the publish is refused because someone saved
   meanwhile, read the index again, redo step 2 and publish once more; if it
   is refused again, stop and say why.
4. Print one line: the artifact URL and how many files were published and
   removed.
