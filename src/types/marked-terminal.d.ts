declare module 'marked-terminal' {
  import type { Renderer } from 'marked';

  export type TerminalRendererOptions = Record<string, unknown>;

  export default class TerminalRenderer extends Renderer {
    constructor(options?: TerminalRendererOptions);
  }
}
