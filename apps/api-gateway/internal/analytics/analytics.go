package analytics

import (
	"math/big"
	"sort"
	"time"

	"github.com/vegaforge/crawlpay/apps/api-gateway/internal/store"
)

var windowDays = map[string]int{"day": 1, "week": 7, "month": 30}

// ParseWindow defaults an empty window to "week" and rejects anything else.
func ParseWindow(w string) (string, bool) {
	if w == "" {
		return "week", true
	}
	if _, ok := windowDays[w]; ok {
		return w, true
	}
	return "", false
}

type DailyPoint struct {
	Date                 string `json:"date"`
	TotalAtomic          string `json:"totalAtomic"`
	RequestCount         int    `json:"requestCount"`
	UniqueCounterparties int    `json:"uniqueCounterparties"`
}

type PublisherAnalytics struct {
	PublisherID        string       `json:"publisherId"`
	Window             string       `json:"window"`
	TotalRevenueAtomic string       `json:"totalRevenueAtomic"`
	TotalRequestCount  int          `json:"totalRequestCount"`
	UniqueCrawlers     int          `json:"uniqueCrawlers"`
	Daily              []DailyPoint `json:"daily"`
}

type CrawlerAnalytics struct {
	CrawlerWallet     string       `json:"crawlerWallet"`
	Window            string       `json:"window"`
	TotalSpendAtomic  string       `json:"totalSpendAtomic"`
	TotalRequestCount int          `json:"totalRequestCount"`
	UniquePublishers  int          `json:"uniquePublishers"`
	Daily             []DailyPoint `json:"daily"`
}

// Service aggregates receipts from the store in JS, matching the TS gateway.
type Service struct {
	receipts store.ReceiptStore
	now      func() time.Time
}

func New(receipts store.ReceiptStore) *Service {
	return &Service{receipts: receipts, now: func() time.Time { return time.Now() }}
}

// NewWithClock injects the clock for tests.
func NewWithClock(receipts store.ReceiptStore, now func() time.Time) *Service {
	return &Service{receipts: receipts, now: now}
}

func (s *Service) ForPublisher(publisherID, window string) (PublisherAnalytics, error) {
	days := windowDays[window]
	now := s.now()
	receipts, err := s.receipts.List(store.ReceiptFilter{
		PublisherID:   publisherID,
		FromTimestamp: isoMillis(now.Add(-time.Duration(days) * 24 * time.Hour)),
		Limit:         100000,
	})
	if err != nil {
		return PublisherAnalytics{}, err
	}
	total, count, unique := totalize(receipts, func(r store.Receipt) string { return r.From })
	return PublisherAnalytics{
		PublisherID:        publisherID,
		Window:             window,
		TotalRevenueAtomic: total,
		TotalRequestCount:  count,
		UniqueCrawlers:     unique,
		Daily:              bucketize(receipts, days, now, func(r store.Receipt) string { return r.From }),
	}, nil
}

func (s *Service) ForCrawler(wallet, window string) (CrawlerAnalytics, error) {
	days := windowDays[window]
	now := s.now()
	receipts, err := s.receipts.List(store.ReceiptFilter{
		From:          wallet,
		FromTimestamp: isoMillis(now.Add(-time.Duration(days) * 24 * time.Hour)),
		Limit:         100000,
	})
	if err != nil {
		return CrawlerAnalytics{}, err
	}
	total, count, unique := totalize(receipts, func(r store.Receipt) string { return r.PublisherID })
	return CrawlerAnalytics{
		CrawlerWallet:     wallet,
		Window:            window,
		TotalSpendAtomic:  total,
		TotalRequestCount: count,
		UniquePublishers:  unique,
		Daily:             bucketize(receipts, days, now, func(r store.Receipt) string { return r.PublisherID }),
	}, nil
}

func totalize(receipts []store.Receipt, counterparty func(store.Receipt) string) (string, int, int) {
	total := new(big.Int)
	unique := map[string]struct{}{}
	for _, r := range receipts {
		if n, ok := new(big.Int).SetString(r.Amount, 10); ok {
			total.Add(total, n)
		}
		unique[counterparty(r)] = struct{}{}
	}
	return total.String(), len(receipts), len(unique)
}

func bucketize(receipts []store.Receipt, days int, now time.Time, counterparty func(store.Receipt) string) []DailyPoint {
	type bucket struct {
		total  *big.Int
		count  int
		unique map[string]struct{}
	}
	buckets := map[string]*bucket{}
	for i := days - 1; i >= 0; i-- {
		date := now.Add(-time.Duration(i) * 24 * time.Hour).UTC().Format("2006-01-02")
		buckets[date] = &bucket{total: new(big.Int), unique: map[string]struct{}{}}
	}
	for _, r := range receipts {
		if len(r.Timestamp) < 10 {
			continue
		}
		b, ok := buckets[r.Timestamp[:10]]
		if !ok {
			continue
		}
		if n, ok := new(big.Int).SetString(r.Amount, 10); ok {
			b.total.Add(b.total, n)
		}
		b.count++
		b.unique[counterparty(r)] = struct{}{}
	}
	dates := make([]string, 0, len(buckets))
	for d := range buckets {
		dates = append(dates, d)
	}
	sort.Strings(dates)
	out := make([]DailyPoint, 0, len(dates))
	for _, d := range dates {
		b := buckets[d]
		out = append(out, DailyPoint{
			Date:                 d,
			TotalAtomic:          b.total.String(),
			RequestCount:         b.count,
			UniqueCounterparties: len(b.unique),
		})
	}
	return out
}

// isoMillis matches JS Date.toISOString(): UTC, millisecond precision, 'Z'.
func isoMillis(t time.Time) string {
	return t.UTC().Format("2006-01-02T15:04:05.000Z")
}
