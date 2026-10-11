declare module '*.module.css' {
  const classes: Readonly<Record<string, string>>;
  export default classes;
}

/** A plain stylesheet, imported for its side effect (`mount.tsx`). */
declare module '*.css';
