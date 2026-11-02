// Animation engine entry point. Feature modules add their start calls below.
import { startOverlay } from './overlay';

declare global {
  interface Window {
    __fxReady?: boolean;
  }
}

// The overlay outlives page swaps, so it starts here rather than through `onPage`.
document.addEventListener('astro:page-load', startOverlay);

// Features must be statically imported above this line: `__fxReady` is set only after they have
// loaded, so a failed feature chunk leaves it unset and the bootstrap failsafe fires.
window.__fxReady = true;

export {};
