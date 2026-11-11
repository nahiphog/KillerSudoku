/** Wall-clock progress independent of worker messages. */
export function generationTimer(output: HTMLElement) {
  let timer: ReturnType<typeof setInterval> | undefined;
  let started = 0;
  let attempts = 0;
  let showAttempts = true;
  const update = () => { output.textContent = `Generating · ${((performance.now() - started) / 1000).toFixed(1)} s elapsed${showAttempts ? ` · Attempts: ${attempts.toLocaleString()}` : ''}`; };
  return {
    start(countAttempts = true) { if (timer) clearInterval(timer); started = performance.now(); attempts = 0; showAttempts = countAttempts; output.hidden = false; update(); timer = setInterval(update, 100); },
    setAttempts(count: number) { attempts = count; if (timer) update(); },
    stop() { if (timer) clearInterval(timer); timer = undefined; output.hidden = true; },
  };
}
