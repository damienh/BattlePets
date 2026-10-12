// Save/Load Game. The original used a Windows file dialog for "<name>.gam" files;
// the browser equivalent is a download / file picker using the same text format,
// so saves from the original game load here and vice versa.

import { parseSave, serializeSave } from '../game/gameState.js';

export function saveGameToFile(app, name = 'battlepets') {
  const text = serializeSave(app.state, app.data).replace(/\n/g, '\r\n');
  const blob = new Blob([text], { type: 'text/plain' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${name}.gam`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function pickFile() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.gam';
    input.addEventListener('change', () => resolve(input.files[0] ?? null), { once: true });
    input.addEventListener('cancel', () => resolve(null), { once: true });
    input.click();
  });
}

/** Returns true when a game was loaded into app.state. */
export async function loadGameFromFile(app) {
  const file = await pickFile();
  if (!file) return false;
  try {
    const text = await file.text();
    const state = parseSave(text, app.data, app.takeSeed());
    app.state = state;
    app.setOptions({ difficulty: state.difficulty, gender: state.gender, textSpeed: state.textSpeed });
    return true;
  } catch (error) {
    window.alert(`Could not load ${file.name}: ${error.message}`);
    return false;
  }
}
