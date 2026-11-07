/**
 * Preview imports the production font CSS before this loader runs. Reject a
 * missing registration: fonts.ready alone can resolve before any face exists.
 * Keep failures native to Storybook; never mark the canvas successful here.
 */
export async function loadStoryFonts(fonts: FontFaceSet): Promise<void> {
  const weights = ['400', '500', '600', '700'];
  const registered = [...fonts];
  for (const weight of weights) {
    if (
      !registered.some(
        (face) =>
          face.family.replaceAll('"', '') === 'Manrope' &&
          face.weight === weight
      )
    )
      throw new Error(`Storybook font Manrope ${weight} is not registered`);
  }
  await Promise.all(
    weights.map(async (weight) => {
      const faces = await fonts.load(`${weight} 16px Manrope`);
      if (faces.length === 0 || faces.some((face) => face.status !== 'loaded'))
        throw new Error(`Storybook font Manrope ${weight} did not load`);
    })
  );
  await fonts.ready;
}
