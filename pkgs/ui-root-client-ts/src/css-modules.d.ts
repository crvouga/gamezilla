declare module '*.module.css' {
  const classes: Readonly<Record<string, string>>;
  export default classes;
}

/** A plain stylesheet, imported for its side effect (`mount.tsx`). */
declare module '*.css';

/** A build-time image import. Its data URL travels with the consuming module. */
declare module '*?inline' {
  const dataUrl: string;
  export default dataUrl;
}
