// Animation engine entry point. Feature modules add their start calls below.
declare global {
  interface Window {
    __fxReady?: boolean;
  }
}

// Features must be statically imported above this line: `__fxReady` is set only after they have
// loaded, so a failed feature chunk leaves it unset and the bootstrap failsafe fires.
window.__fxReady = true;

export {};
