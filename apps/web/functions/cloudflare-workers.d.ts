declare module 'cloudflare:workers' {
  interface ContainerProcessOutput {
    stdout: ArrayBuffer;
    stderr: ArrayBuffer;
    exitCode: number;
  }

  interface ContainerProcess {
    stdin?: WritableStream<Uint8Array>;
    output(): Promise<ContainerProcessOutput>;
  }

  interface ExecutionContainer {
    readonly running: boolean;
    readonly images: Record<string, string>;
    start(options: {
      image: string;
      instance?: string;
      entrypoint?: string[];
      enableInternet: boolean;
    }): void;
    exec(command: string[], options?: {
      stdin?: ReadableStream<Uint8Array> | 'pipe';
      signal?: AbortSignal;
    }): Promise<ContainerProcess>;
    setInactivityTimeout(milliseconds: number): Promise<void>;
    destroy(): Promise<void>;
  }

  export abstract class DurableObject<Env = unknown> {
    protected readonly ctx: { container?: ExecutionContainer };
    protected readonly env: Env;
    constructor(ctx: { container?: ExecutionContainer }, env: Env);
  }
}
