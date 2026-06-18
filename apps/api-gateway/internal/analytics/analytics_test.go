package analytics

import (
	"testing"
	"time"

	"github.com/vegaforge/octroi/apps/api-gateway/internal/store"
)

var clock = time.Date(2026, 4, 27, 12, 0, 0, 0, time.UTC)

func iso(daysAgo int) string {
	return clock.AddDate(0, 0, -daysAgo).Format("2006-01-02T15:04:05.000Z")
}

func TestForPublisher(t *testing.T) {
	rs := store.NewMemoryReceiptStore()
	rs.Add(store.Receipt{Nonce: "n1", PublisherID: "pub_a", From: "GA", Amount: "100", Timestamp: iso(1)})
	rs.Add(store.Receipt{Nonce: "n2", PublisherID: "pub_a", From: "GB", Amount: "300", Timestamp: iso(2)})
	rs.Add(store.Receipt{Nonce: "n3", PublisherID: "pub_a", From: "GA", Amount: "100", Timestamp: iso(3)})
	rs.Add(store.Receipt{Nonce: "n4", PublisherID: "pub_a", From: "GA", Amount: "999", Timestamp: iso(20)}) // outside week

	svc := NewWithClock(rs, func() time.Time { return clock })
	a, err := svc.ForPublisher("pub_a", "week")
	if err != nil {
		t.Fatal(err)
	}
	if a.TotalRevenueAtomic != "500" {
		t.Fatalf("total revenue = %s", a.TotalRevenueAtomic)
	}
	if a.TotalRequestCount != 3 {
		t.Fatalf("request count = %d", a.TotalRequestCount)
	}
	if a.UniqueCrawlers != 2 {
		t.Fatalf("unique crawlers = %d", a.UniqueCrawlers)
	}
	if len(a.Daily) != 7 {
		t.Fatalf("daily buckets = %d", len(a.Daily))
	}
}

func TestForCrawlerSumsAcrossPublishers(t *testing.T) {
	rs := store.NewMemoryReceiptStore()
	rs.Add(store.Receipt{Nonce: "n1", PublisherID: "pub_a", From: "GC", Amount: "100", Timestamp: iso(1)})
	rs.Add(store.Receipt{Nonce: "n2", PublisherID: "pub_b", From: "GC", Amount: "400", Timestamp: iso(2)})

	svc := NewWithClock(rs, func() time.Time { return clock })
	a, err := svc.ForCrawler("GC", "week")
	if err != nil {
		t.Fatal(err)
	}
	if a.TotalSpendAtomic != "500" {
		t.Fatalf("spend = %s", a.TotalSpendAtomic)
	}
	if a.UniquePublishers != 2 {
		t.Fatalf("unique publishers = %d", a.UniquePublishers)
	}
}

func TestParseWindow(t *testing.T) {
	if w, ok := ParseWindow(""); !ok || w != "week" {
		t.Fatal("empty should default to week")
	}
	if _, ok := ParseWindow("year"); ok {
		t.Fatal("year should be rejected")
	}
}
