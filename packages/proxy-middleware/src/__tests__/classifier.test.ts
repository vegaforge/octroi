import { describe, expect, it } from 'vitest';
import type { IncomingHttpHeaders } from 'http';
import { DefaultBotClassifier } from '../classifier';

const classifier = new DefaultBotClassifier();

function classify(headers: IncomingHttpHeaders = {}, url = '/foo') {
  return classifier.classify({ method: 'GET', url, headers });
}

describe('DefaultBotClassifier', () => {
  it('returns crawler at confidence 1 when X-PAYMENT header is present', () => {
    const r = classify({ 'x-payment': 'eyJ...' });
    expect(r.isCrawler).toBe(true);
    expect(r.confidence).toBe(1);
    expect(r.reason).toBe('x-payment-header');
  });

  it('matches known AI bot User-Agents', () => {
    expect(classify({ 'user-agent': 'GPTBot/1.0' }).isCrawler).toBe(true);
    expect(
      classify({
        'user-agent': 'Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)',
      }).isCrawler,
    ).toBe(true);
    expect(classify({ 'user-agent': 'PerplexityBot/1.0' }).isCrawler).toBe(true);
    expect(classify({ 'user-agent': 'CCBot/2.0' }).isCrawler).toBe(true);
    expect(classify({ 'user-agent': 'OctroiBot/1.0' }).isCrawler).toBe(true);
  });

  it('matches the generic bot/crawler/spider suffix', () => {
    const r = classify({ 'user-agent': 'AcmeContentSpider/1.0' });
    expect(r.isCrawler).toBe(true);
    expect(r.reason).toBe('ua-generic-bot-suffix');
  });

  it('classifies a browser-shaped request as human', () => {
    const r = classify({
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
      'accept-language': 'en-US,en;q=0.9',
      accept: 'text/html,application/xhtml+xml',
      cookie: 'session=abc',
      referer: 'https://news.ycombinator.com/',
    });
    expect(r.isCrawler).toBe(false);
  });

  it('flags requests missing all browser-like headers as crawler', () => {
    const r = classify({ 'user-agent': 'curl/8.0' });
    expect(r.isCrawler).toBe(true);
    expect(r.reason).toBe('missing-browser-headers');
  });
});
