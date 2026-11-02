// Loaded inline in the head so a validated theme is applied before first paint.
(() => {
  if (window.portfolioTheme) {
    window.portfolioTheme.apply();
    return;
  }

  const themes = ['green', 'amber', 'cyber', 'cyber-yellow', 'severance'];
  const defaultMode = document.documentElement.dataset.colorScheme || 'system';
  const read = (key) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  };
  const write = (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      // The current selection still works when browser storage is unavailable.
    }
  };
  const legacyTheme = read('theme');
  let theme = themes.includes(legacyTheme) ? legacyTheme : 'severance';
  let colorScheme = read('color-scheme');
  if (!['light', 'dark'].includes(colorScheme) && ['light', 'dark'].includes(legacyTheme)) {
    colorScheme = legacyTheme;
    write('color-scheme', colorScheme);
  }
  write('theme', theme);

  const resolveMode = () => {
    if (defaultMode.endsWith(':only')) return defaultMode.replace(':only', '');
    if (['light', 'dark'].includes(colorScheme)) return colorScheme;
    if (defaultMode !== 'system') return defaultMode;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };
  const apply = (root = document.documentElement) => {
    const staleClasses = Array.from(root.classList).filter((name) => name.startsWith('theme-'));
    root.classList.remove(...staleClasses);
    root.classList.add(`theme-${theme}`);
    root.classList.toggle('dark', resolveMode() === 'dark');
  };
  const syncButtons = () => {
    document.querySelectorAll('.theme-button').forEach((button) => {
      const active = button.getAttribute('data-theme') === theme;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    document.querySelectorAll('[data-aw-toggle-color-scheme] > input').forEach((input) => {
      input.checked = resolveMode() !== 'dark';
    });
  };
  const notify = () => {
    apply();
    syncButtons();
    document.dispatchEvent(new CustomEvent('themeChanged'));
  };
  window.portfolioTheme = {
    apply,
    setTheme(value) {
      theme = themes.includes(value) ? value : 'severance';
      write('theme', theme);
      notify();
    },
    toggleColorScheme() {
      if (defaultMode.endsWith(':only')) return;
      colorScheme = resolveMode() === 'dark' ? 'light' : 'dark';
      write('color-scheme', colorScheme);
      notify();
    },
  };
  document.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest('.theme-button');
    if (button) window.portfolioTheme.setTheme(button.getAttribute('data-theme'));
  });
  document.addEventListener('astro:before-swap', (event) => apply(event.newDocument.documentElement));
  document.addEventListener('astro:page-load', notify);
  window.addEventListener('pageshow', notify);
  apply();
})();
