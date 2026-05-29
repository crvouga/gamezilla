/** POST hidden form to complete OAuth after account selection. */
export function submitSignInForm(
  completeActionPath: string,
  oauthParams: Readonly<Record<string, string>>,
  sub: string
): void {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = completeActionPath;
  form.style.display = 'none';
  const addField = (k: string, v: string): void => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = k;
    input.value = v;
    form.appendChild(input);
  };
  for (const [k, v] of Object.entries(oauthParams)) {
    addField(k, v);
  }
  addField('sub', sub);
  document.body.appendChild(form);
  form.submit();
}
