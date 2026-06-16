'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { highlightTypeScript } from '@/lib/highlight';

type CodeBlockProps = {
  /** Source code to render. Indentation preserved. */
  code: string;
  /** Filename label shown in the header. */
  filename: string;
  /** Language label badge. Decorative only (the highlighter is TS-only). */
  language?: string;
};

/** Code block with header, language badge, and copy button. Highlighting is sync (no Shiki). */
export function CodeBlock({ code, filename, language = 'typescript' }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard denied (insecure context or permissions), no-op
    }
  };

  return (
    <div className="code">
      <div className="code-head">
        <span className="code-file">
          {filename}
          <span className="lang">{language}</span>
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className={`code-copy ${copied ? 'copied' : ''}`}
          aria-label={copied ? 'Copied' : 'Copy code'}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <Copy className="h-3.5 w-3.5" aria-hidden />
          )}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre>
        <code dangerouslySetInnerHTML={{ __html: highlightTypeScript(code) }} />
      </pre>
    </div>
  );
}
