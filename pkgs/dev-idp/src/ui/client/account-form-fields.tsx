/** @jsxImportSource hono/jsx/dom */
import { c } from '../styles';

export const AccountFormFields = (props: {
  testIdRoot: string;
  initial: { name: string; email: string; picture: string };
}) => (
  <>
    <div class={c.field}>
      <label class={c.fieldLabel} for={`${props.testIdRoot}-name`}>
        Name
      </label>
      <input
        id={`${props.testIdRoot}-name`}
        class={c.fieldInput}
        name="name"
        type="text"
        required
        autoComplete="off"
        defaultValue={props.initial.name}
        data-testid={`${props.testIdRoot}-name`}
      />
    </div>
    <div class={c.field}>
      <label class={c.fieldLabel} for={`${props.testIdRoot}-email`}>
        Email
      </label>
      <input
        id={`${props.testIdRoot}-email`}
        class={c.fieldInput}
        name="email"
        type="email"
        required
        autoComplete="off"
        defaultValue={props.initial.email}
        data-testid={`${props.testIdRoot}-email`}
      />
    </div>
    <div class={c.field}>
      <label class={c.fieldLabel} for={`${props.testIdRoot}-picture`}>
        Picture URL (optional)
      </label>
      <input
        id={`${props.testIdRoot}-picture`}
        class={c.fieldInput}
        name="picture"
        type="url"
        autoComplete="off"
        defaultValue={props.initial.picture}
        data-testid={`${props.testIdRoot}-picture`}
      />
    </div>
  </>
);
