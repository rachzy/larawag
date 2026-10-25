const CSS = `.larawag{position:relative;overflow:hidden;background:#04060d;width:100%;height:100%}
.larawag canvas{display:block;width:100%;height:100%}
.larawag-label{position:absolute;left:0;top:0;pointer-events:none;font-family:var(--larawag-font,"IBM Plex Mono",ui-monospace,monospace);font-size:12px;color:var(--larawag-label-color,#e6e9f5);background:var(--larawag-label-bg,rgba(7,10,20,.65));border:1px solid var(--larawag-label-border,#232a47);padding:1px 6px;border-radius:3px;white-space:nowrap;transform:translate(-50%,-150%)}
.larawag-clock{position:absolute;left:10px;bottom:8px;font-family:var(--larawag-font,"IBM Plex Mono",ui-monospace,monospace);font-size:12px;color:var(--larawag-clock-color,#8e97b8);font-variant-numeric:tabular-nums}
.larawag-badge{position:absolute;right:10px;top:8px;font-family:var(--larawag-font,"IBM Plex Mono",ui-monospace,monospace);font-size:12px;color:var(--larawag-badge-color,#e8b04a);border:1px solid var(--larawag-badge-color,#e8b04a);padding:1px 8px;border-radius:3px;background:var(--larawag-badge-bg,rgba(7,10,20,.65))}
.larawag-fallback{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px;color:var(--larawag-clock-color,#8e97b8)}
.larawag-fallback[hidden]{display:none}`;

let count = 0;
let el: HTMLStyleElement | null = null;

/**
 * Adds the default stylesheet once (ref-counted). Returns a release function;
 * the `<style data-larawag>` is removed when the last holder releases.
 */
export function injectStyles(): () => void {
  if (count === 0) {
    el = document.createElement('style');
    el.setAttribute('data-larawag', '');
    el.textContent = CSS;
    document.head.appendChild(el);
  }
  count++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    count--;
    if (count === 0 && el) {
      el.remove();
      el = null;
    }
  };
}
