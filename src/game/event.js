// Maze events (EVENT MODE, 0x406050). Keys live in a global item list, are never
// consumed and events re-trigger every time the player steps on them.

/**
 * @param {{mainText:string, needText:string, needs:string, gives:string}} event
 * @param {string[]} items
 * @returns {{ text: string, blocked: boolean, items: string[] }}
 */
export function resolveEvent(event, items) {
  // NEEDS uses strncmp(item, needs, strlen(needs)) - a prefix match;
  // GIVES de-duplication uses _stricmp (0x413ad0).
  const satisfied = event.needs === '' || items.some((item) => item.startsWith(event.needs));
  if (!satisfied) return { text: event.needText, blocked: true, items };
  const lower = event.gives.toLowerCase();
  const alreadyHas = items.some((item) => item.toLowerCase() === lower);
  const granted = event.gives !== '' && !alreadyHas ? [...items, event.gives] : items;
  return { text: event.mainText, blocked: false, items: granted };
}
