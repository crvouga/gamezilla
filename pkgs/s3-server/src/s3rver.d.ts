declare module 's3rver' {
  type S3rverOptions = {
    readonly port: number;
    readonly address: string;
    readonly silent: boolean;
    readonly directory: string;
    readonly configureBuckets: readonly { readonly name: string }[];
  };

  export default class S3rver {
    constructor(options: S3rverOptions);
    run(): Promise<{ readonly port: number }>;
    close(): Promise<void>;
  }
}
