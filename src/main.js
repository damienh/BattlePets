import { App } from './app.js';
import { TitleMode } from './modes/title.js';

const canvas = document.getElementById('screen');
const overlay = document.getElementById('overlay');
const status = document.getElementById('status');
const start = document.getElementById('start');

const MISSING_HELP = 'The remake needs the original BattlePets files. Run <code>npm start</code> '
  + 'from the remake folder inside your BattlePets install (or pass <code>--original /path/to/BattlePets</code>).';

async function main() {
  const app = new App(canvas);
  try {
    await app.boot((step) => {
      status.textContent = `${step}...`;
    });
  } catch (error) {
    status.innerHTML = `${error.message}<br><br>${MISSING_HELP}`;
    return;
  }
  status.textContent = 'BattlePets V1.0';
  start.hidden = false;
  start.addEventListener('click', async () => {
    app.audio.unlock();
    overlay.classList.add('hidden');
    await app.modes.push(new TitleMode(app));
    app.run();
  }, { once: true });
}

main();
