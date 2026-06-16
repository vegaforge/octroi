/**
 * Minimal TypeScript highlighter (no deps, sync). Emits `<span class="tok-*">`
 * styled by globals.css. Fine for short snippets; swap in Shiki for full TSX fidelity.
 */

const KEYWORDS = new Set([
  'import',
  'from',
  'const',
  'let',
  'var',
  'new',
  'await',
  'async',
  'function',
  'return',
  'export',
  'default',
  'type',
  'interface',
  'if',
  'else',
  'for',
  'of',
  'in',
  'extends',
  'this',
  'void',
  'true',
  'false',
  'null',
  'undefined',
]);

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function highlightTypeScript(source: string): string {
  let out = '';
  let i = 0;
  const n = source.length;
  const isIdStart = (c: string) => /[A-Za-z_$]/.test(c);
  const isId = (c: string) => /[A-Za-z0-9_$]/.test(c);

  while (i < n) {
    const c = source[i]!;

    if (c === '/' && source[i + 1] === '/') {
      let j = i;
      while (j < n && source[j] !== '\n') j++;
      out += `<span class="tok-com">${escapeHtml(source.slice(i, j))}</span>`;
      i = j;
      continue;
    }

    if (c === "'" || c === '"' || c === '`') {
      const quote = c;
      let k = i + 1;
      while (k < n && source[k] !== quote) {
        if (source[k] === '\\') k++;
        k++;
      }
      k++;
      out += `<span class="tok-str">${escapeHtml(source.slice(i, k))}</span>`;
      i = k;
      continue;
    }

    if (isIdStart(c)) {
      let p = i;
      while (p < n && isId(source[p]!)) p++;
      const word = source.slice(i, p);
      let cls = '';
      if (KEYWORDS.has(word)) cls = 'tok-kw';
      else if (/^[A-Z]/.test(word)) cls = 'tok-cls';
      else if (source[p] === '(') cls = 'tok-fn';
      else if (source[p] === ':') cls = 'tok-prop';
      out += cls ? `<span class="${cls}">${escapeHtml(word)}</span>` : escapeHtml(word);
      i = p;
      continue;
    }

    if (/[0-9]/.test(c)) {
      let q = i;
      while (q < n && /[0-9._n]/.test(source[q]!)) q++;
      out += `<span class="tok-num">${escapeHtml(source.slice(i, q))}</span>`;
      i = q;
      continue;
    }

    out += escapeHtml(c);
    i++;
  }

  return out;
}
