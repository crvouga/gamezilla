from pathlib import Path
p=Path('libs/word-tiles-client-ts/src/word-tiles-coordinate.example.tsx')
s=p.read_text();anchor="  for (const [keys, cell] of ["
assert anchor in s
s=s.replace(anchor,"""  await userEvent.click(canvas.getByRole('button', { name: 'View a1 to e5' }));
  await assertFocusedCoordinates(canvasElement, 'c3');
  await userEvent.click(canvas.getByRole('button', { name: 'View f6 to j10' }));
  await assertFocusedCoordinates(canvasElement, 'h8');
"""+anchor)
p.write_text(s)
