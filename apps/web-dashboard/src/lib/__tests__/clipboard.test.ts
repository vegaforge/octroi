import { describe, expect, it } from 'vitest';
import { copyText, type TextClipboard } from '../clipboard';

class RecordingClipboard implements TextClipboard {
  written: string[] = [];
  writeText(text: string): Promise<void> {
    this.written.push(text);
    return Promise.resolve();
  }
}

class RefusingClipboard implements TextClipboard {
  writeText(): Promise<void> {
    return Promise.reject(new DOMException('Write permission denied.', 'NotAllowedError'));
  }
}

describe('copyText', () => {
  it('writes the text and resolves true', async () => {
    const clipboard = new RecordingClipboard();
    await expect(copyText('GABC', clipboard)).resolves.toBe(true);
    expect(clipboard.written).toEqual(['GABC']);
  });

  // The copy buttons used to await writeText with no catch, so a refused clipboard became
  // an unhandled rejection from a click handler.
  it('resolves false instead of rejecting when the browser refuses the write', async () => {
    await expect(copyText('GABC', new RefusingClipboard())).resolves.toBe(false);
  });

  it('resolves false when there is no Clipboard API', async () => {
    await expect(copyText('GABC', undefined)).resolves.toBe(false);
  });
});
