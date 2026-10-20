// Runs in the document head before CSS/first paint, without waiting for hydration.
export const themeBootstrap = `(() => {
  let preference;
  try { preference = localStorage.getItem('codesocean-dark-mode'); } catch {}
  const dark = preference === 'dark' || (preference !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
})();`
