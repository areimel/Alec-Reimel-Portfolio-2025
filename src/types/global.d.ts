interface Window {
  openThemeOptionsModal: () => void;
  [key: `open${string}Modal`]: (() => void) | undefined;
  [key: `close${string}Modal`]: (() => void) | undefined;
}
