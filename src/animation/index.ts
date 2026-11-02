// Animation engine entry point. Feature modules add their start calls below.
declare global {
  interface Window {
    __fxReady?: boolean;
  }
}

window.__fxReady = true;

export {};
