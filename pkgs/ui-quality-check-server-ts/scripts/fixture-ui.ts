export const FAMILIES = [
  'desktop',
  'mobile',
  'dialog',
  'chessboard',
  'dense',
  'loading',
  'wrapped-text',
  'compact',
] as const;
export const DEFECTS = [
  'overlap',
  'clipping',
  'broken-wrapping',
  'crowding',
  'spacing',
  'offscreen-dialog',
  'cut-controls',
  'giant-text',
  'responsive',
  'duplicate',
  'empty-region',
  'alignment',
] as const;
interface FixtureOptions {
  family: (typeof FAMILIES)[number];
  defect?: (typeof DEFECTS)[number];
  variant: number;
}

function rect(
  position: readonly [number, number, number, number],
  color: string,
  radius = 10
): string {
  const [x, y, w, h] = position;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${color}" rx="${radius}"/>`;
}
function text(
  position: readonly [number, number],
  value: string,
  size = 16,
  color = '#253047'
): string {
  const [x, y] = position;
  return `<text x="${x}" y="${y}" font-family="Arial,sans-serif" font-size="${size}" fill="${color}">${value}</text>`;
}
function button(x: number, y: number, width: number, label: string): string {
  return (
    rect([x, y, width, 42], '#365eea', 8) +
    text([x + 16, y + 27], label, 15, '#fff')
  );
}

function content(options: FixtureOptions, width: number): string {
  const compact = width < 500;
  const left = 24;
  const right = width - 24;
  let out =
    text(
      [left, 116],
      options.family === 'chessboard' ? 'Your turn' : 'Workspace overview',
      26
    ) + text([left, 145], 'Everything you need, in one place.', 15, '#617084');
  if (options.family === 'chessboard') return chessboard(out, width);
  if (options.family === 'loading')
    return (
      out +
      rect([left, 185, right - left, 260], '#fff') +
      rect([48, 217, width - 96, 16], '#e2e7ef') +
      rect([48, 251, width - 136, 12], '#e2e7ef') +
      rect([48, 282, width - 96, 120], '#edf0f5') +
      text([left, 485], 'Preparing your workspace…', 17)
    );
  if (options.family === 'wrapped-text') {
    out += rect([left, 174, right - left, 374], '#fff');
    const lines = compact
      ? [
          'A longer message can still be easy',
          'to read on a narrow screen. Each',
          'line stays inside the card, with',
          'enough space between paragraphs.',
          'Clear text helps people understand',
          'what comes next.',
        ]
      : [
          'A longer message can still be easy to read.',
          'Every line stays comfortably inside the card,',
          'with enough space between paragraphs.',
          'Clear text helps people understand what comes next.',
        ];
    lines.forEach((line, i) => {
      out += text([44, 218 + i * 34], line, 17);
    });
    return out + button(44, 472, 150, 'Save changes');
  }
  const columns = compact ? 1 : 2;
  const rows =
    options.family === 'dense' ? 7 : options.family === 'compact' ? 4 : 3;
  const spacing =
    options.family === 'dense' ? 68 : options.family === 'compact' ? 88 : 114;
  const cardWidth = (width - 48 - (columns - 1) * 16) / columns;
  for (let row = 0; row < rows; row++)
    for (let column = 0; column < columns; column++) {
      const x = left + column * (cardWidth + 16);
      const y = 176 + row * spacing;
      out +=
        rect([x, y, cardWidth, spacing - 14], '#fff') +
        rect([x + 16, y + 16, 28, 28], '#e5ebff', 8) +
        text(
          [x + 56, y + 32],
          ['Activity', 'Projects', 'Messages', 'Schedule'][row % 4] ??
            'Activity',
          17
        );
      if (spacing > 80)
        out += text([x + 16, y + 67], 'Updated moments ago', 14, '#738198');
    }
  return (
    out +
    button(
      left,
      Math.min(660, 176 + rows * spacing + 12),
      152,
      'Create project'
    )
  );
}

function dialog(width: number, defect?: string): string {
  const x = defect === 'offscreen-dialog' ? width - 70 : 34;
  const y = defect === 'offscreen-dialog' ? 620 : 240;
  return (
    rect([0, 0, width, 760], '#25304780', 0) +
    rect([x, y, width - 68, 252], '#fff', 16) +
    text([x + 20, y + 40], 'Rename project', 23) +
    text([x + 20, y + 74], 'Choose a clear, descriptive name.', 14, '#617084') +
    rect([x + 20, y + 96, width - 108, 44], '#edf0f7', 6) +
    text([x + 32, y + 124], 'Summer plans', 16) +
    button(x + 20, y + 175, 140, 'Save name')
  );
}

function degrade(body: string, options: FixtureOptions, width: number): string {
  const defect = options.defect;
  if (!defect) return body;
  if (defect === 'overlap')
    return (
      body +
      text([24, 119], 'THIS MESSAGE COLLIDES WITH THE TITLE', 32, '#c41e3a') +
      button(26, 179, width - 52, 'Another control covers the cards')
    );
  if (defect === 'clipping')
    return (
      body +
      rect([20, 164, width - 40, 25], '#fff') +
      `<g clip-path="url(#clip)">${text([24, 188], 'Critical account settings clipped here', 38)}</g>`
    );
  if (defect === 'broken-wrapping')
    return (
      body +
      rect([18, 174, width - 36, 260], '#fff') +
      [
        'Important information for the account',
        'unnecessarily runs outside its region',
        'without wrapping or readable spacing.',
      ]
        .map((v, i) => text([24, 212 + i * 15], v, 33))
        .join('')
    );
  if (defect === 'crowding')
    return (
      body +
      Array.from({ length: 20 }, (_, i) =>
        button(
          10 + (i % 3) * (width / 3 - 4),
          166 + Math.floor(i / 3) * 27,
          width / 3 + 20,
          'Continue'
        )
      ).join('')
    );
  if (defect === 'spacing')
    return (
      `<g transform="translate(0,-84)">${body}</g>` +
      text([40, 187], 'No room to read', 50) +
      button(width - 80, 192, 140, 'Next')
    );
  if (defect === 'offscreen-dialog') return body + dialog(width, defect);
  if (['cut-controls', 'giant-text'].includes(defect))
    return overflowingContent(body, defect, width);
  if (defect === 'responsive') return `<g transform="scale(1.9,1)">${body}</g>`;
  if (defect === 'duplicate')
    return (
      body +
      dialog(width) +
      `<g transform="translate(15,-70)">${dialog(width)}</g>` +
      button(70, 272, width - 110, 'Duplicate confirmation')
    );
  if (defect === 'empty-region')
    return (
      rect([0, 160, width, 540], '#f1f4f9') +
      `<g transform="translate(0,445) scale(.42)">${body}</g>`
    );
  return (
    `<g transform="skewX(12)">${body}</g>` +
    rect([width / 2, 178, 3, 440], '#f35', 0)
  );
}

export function fixtureSvg(options: FixtureOptions): string {
  const width =
    options.family === 'compact'
      ? 320
      : ['mobile', 'dialog', 'wrapped-text'].includes(options.family)
        ? 360
        : 720;
  let body =
    rect([0, 0, width, 760], options.variant ? '#edf1f5' : '#f1f4f9', 0) +
    rect([0, 0, width, 70], '#fff', 0) +
    text([24, 43], options.variant ? 'Studio' : 'Dashboard', 21) +
    text([width - 110, 42], 'Account', 15, '#365eea') +
    content(options, width);
  if (options.family === 'dialog') body += dialog(width);
  body = degrade(body, options, width);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="760"><defs><clipPath id="clip"><rect x="20" y="164" width="${width - 40}" height="25"/></clipPath></defs>${body}</svg>`;
}

function chessboard(out: string, width: number): string {
  const left = 24;
  const board = Math.min(width - 48, 384);
  const square = board / 8;
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++)
      out += rect(
        [left + x * square, 172 + y * square, square, square],
        (x + y) % 2 ? '#6e927e' : '#eef0d9',
        0
      );
  const pieces = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
  for (let x = 0; x < 8; x++)
    out +=
      text(
        [left + x * square + square * 0.28, 172 + square * 0.72],
        pieces[x] ?? '',
        square * 0.5,
        '#162b21'
      ) +
      text(
        [left + x * square + square * 0.28, 172 + square * 7.72],
        pieces[x] ?? '',
        square * 0.5,
        '#fff'
      );
  return (
    out +
    text([left, 194 + board], 'White  04:32    Black  03:58', 17) +
    button(left, 212 + board, 130, 'Offer draw')
  );
}

function overflowingContent(
  body: string,
  defect: string,
  width: number
): string {
  if (defect === 'cut-controls')
    return (
      body +
      button(width - 30, 320, 240, 'Confirm purchase') +
      button(-142, 375, 175, 'Cancel')
    );
  if (defect === 'giant-text')
    return (
      body +
      text([12, 310], 'Settings', 160) +
      text([8, 390], 'Preferences', 100)
    );
  return body;
}
