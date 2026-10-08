import './style.css';
import { sdk } from './sdk';
import { setLang, t } from './i18n';
import { mergeSave } from './state';
import { Game } from './game/game';

const fill = document.getElementById('loader-fill') as HTMLElement;
const setProgress = (p: number) => {
  fill.style.width = `${p}%`;
};
const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

function blockBrowserGestures() {
  const scrollable = (e: Event) => (e.target as HTMLElement | null)?.closest?.('.modal-body');
  document.addEventListener(
    'touchmove',
    (e) => {
      if (!scrollable(e)) e.preventDefault();
    },
    { passive: false },
  );
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());
  document.addEventListener(
    'wheel',
    (e) => {
      if (e.ctrlKey || !scrollable(e)) e.preventDefault();
    },
    { passive: false },
  );
  document.addEventListener('selectstart', (e) => e.preventDefault());
  document.addEventListener('contextmenu', (e) => e.preventDefault());
}

async function boot() {
  blockBrowserGestures();
  setProgress(10);
  await sdk.init();
  setLang(sdk.lang());
  document.title = t('title');
  const title = document.getElementById('loader-title');
  if (title) title.textContent = t('title');
  setProgress(35);
  const save = mergeSave(await sdk.load());
  setProgress(55);
  await nextFrame();
  const game = new Game(save, sdk.isMobile());
  setProgress(85);
  game.stage.render();
  await nextFrame();
  setProgress(100);
  await new Promise((r) => setTimeout(r, 150));
  document.getElementById('loader')?.classList.add('hide');
  setTimeout(() => document.getElementById('loader')?.remove(), 600);
  sdk.ready();
  game.start();
  (window as unknown as { __game: Game }).__game = game;
}

boot().catch((e) => {
  console.error(e);
  const title = document.getElementById('loader-title');
  if (title) title.textContent = 'Error: ' + (e?.message || e);
});
