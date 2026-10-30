/** The part of the browser Clipboard API that the copy buttons use. */
export interface TextClipboard {
  writeText(text: string): Promise<void>;
}

function browserClipboard(): TextClipboard | undefined {
  return typeof navigator === 'undefined' ? undefined : navigator.clipboard;
}

/**
 * Copy `text` to the clipboard. Resolves true when it was written and false when the
 * browser refused (no secure context, permission denied, or no Clipboard API). It never
 * rejects, so a click handler can call it without leaving an unhandled rejection, and the
 * caller decides what to show on failure.
 */
export async function copyText(
  text: string,
  clipboard: TextClipboard | undefined = browserClipboard(),
): Promise<boolean> {
  if (!clipboard) return false;
  try {
    await clipboard.writeText(text);
    return true;
  } catch (err: unknown) {
    // A refused write is an expected outcome in the browser, not a bug; the boolean is the
    // report. Keep the reason in the console for anyone debugging a stuck copy button.
    console.warn('clipboard write refused', err);
    return false;
  }
}
