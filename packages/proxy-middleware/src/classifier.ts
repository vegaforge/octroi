import type { IncomingHttpHeaders } from 'http';

export interface RequestSignals {
  method: string;
  url: string;
  headers: IncomingHttpHeaders;
  ip?: string;
}

export interface ClassificationResult {
  isCrawler: boolean;
  /** Confidence in `[0, 1]`. 1 = certain. */
  confidence: number;
  /** Id of the rule that fired, for logs/audit. */
  reason: string;
}

export interface BotClassifier {
  classify(signals: RequestSignals): ClassificationResult;
}

/** Known AI/agent crawler User-Agents (case-insensitive, first hit wins). */
const KNOWN_BOT_PATTERNS: RegExp[] = [
  // OpenAI
  /GPTBot/i,
  /ChatGPT-User/i,
  /OAI-SearchBot/i,
  // Anthropic
  /ClaudeBot/i,
  /Claude-Web/i,
  /anthropic-ai/i,
  // Perplexity
  /PerplexityBot/i,
  /Perplexity-User/i,
  // other model providers
  /cohere-ai/i,
  /mistralai/i,
  /Google-Extended/i,
  /Bytespider/i,
  /Applebot-Extended/i,
  /Meta-ExternalAgent/i,
  /Amazonbot/i,
  /DuckAssistBot/i,
  // general crawlers
  /CCBot/i,
  /Diffbot/i,
  /ImagesiftBot/i,
  /Omgilibot/i,
  // CrawlPay crawlers self-identify
  /CrawlPay/i,
];

/**
 * Heuristic classifier, checked in order: X-PAYMENT header, known bot UA,
 * generic bot/crawler/spider token, then missing browser headers.
 * Defaults to human when ambiguous (paywalling a real human is the worse error).
 */
export class DefaultBotClassifier implements BotClassifier {
  classify(signals: RequestSignals): ClassificationResult {
    if (signals.headers['x-payment']) {
      return { isCrawler: true, confidence: 1, reason: 'x-payment-header' };
    }

    const ua = headerString(signals.headers['user-agent']);

    for (const pattern of KNOWN_BOT_PATTERNS) {
      if (pattern.test(ua)) {
        return { isCrawler: true, confidence: 0.95, reason: `ua-match:${pattern.source}` };
      }
    }

    // match bot|crawler|spider at a real boundary (start, non-word, or camelCase
    // transition) so AcmeContentSpider hits but robots.txt doesn't.
    if (/(?:^|[\W_]|[a-z])(?:bot|crawler|spider)\b/i.test(ua)) {
      return { isCrawler: true, confidence: 0.7, reason: 'ua-generic-bot-suffix' };
    }

    const hasAcceptLanguage = signals.headers['accept-language'] !== undefined;
    const hasCookie = signals.headers['cookie'] !== undefined;
    const hasReferer = signals.headers['referer'] !== undefined;
    const accept = headerString(signals.headers['accept']);

    if (!hasAcceptLanguage && !hasCookie && !hasReferer && !accept.includes('text/html')) {
      return { isCrawler: true, confidence: 0.5, reason: 'missing-browser-headers' };
    }

    return { isCrawler: false, confidence: 0.5, reason: 'no-bot-signals' };
  }
}

function headerString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value.join(',');
  return value ?? '';
}
