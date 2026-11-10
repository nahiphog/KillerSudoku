/** Wall-clock progress independent of worker messages. */
export function generationTimer(output: HTMLElement) {
  let timer: ReturnType<typeof setInterval> | undefined;
  let started = 0;
  const update = () => { output.textContent = `Generating · ${((performance.now() - started) / 1000).toFixed(1)} s elapsed`; };
  return {
    start() { if (timer) clearInterval(timer); started = performance.now(); output.hidden = false; update(); timer = setInterval(update, 100); },
    stop() { if (timer) clearInterval(timer); timer = undefined; output.hidden = true; },
  };
}
