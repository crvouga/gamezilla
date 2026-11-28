// Retire installations that still serve the old Workbox shell.
self.addEventListener('install', (event) =>
  event.waitUntil(self.skipWaiting())
);
self.addEventListener('activate', (event) => {
  event.waitUntil(self.registration.unregister());
});
