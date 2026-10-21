globalThis.addEventListener('message', (event: MessageEvent<string>) => {
  document.body.textContent = event.data;
  globalThis.postMessage({
    text: document.body.textContent,
    url: location.href,
  });
});
