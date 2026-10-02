/** Owns retained room storage without running rooms or writing their data. */
export class RoomStorageArchive {
  fetch(): Response {
    return new Response('Retained room storage is read-only', { status: 410 });
  }

  // Outstanding alarms must finish without executing room mutations.
  alarm(): void {}
}
