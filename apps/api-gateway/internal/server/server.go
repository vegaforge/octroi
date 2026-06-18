package server

import (
	"net/http"
	"regexp"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/vegaforge/octroi/apps/api-gateway/internal/analytics"
	"github.com/vegaforge/octroi/apps/api-gateway/internal/store"
)

const version = "0.0.1"

var (
	gAddressRe = regexp.MustCompile(`^G[A-Z2-7]{55}$`)
	domainRe   = regexp.MustCompile(`^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$`)
)

type Deps struct {
	Publishers store.PublisherStore
	Receipts   store.ReceiptStore
	Analytics  *analytics.Service
	Network    string
	Storage    string
}

type server struct {
	d Deps
}

// New builds the gateway router. Routes mirror the TypeScript gateway exactly.
func New(d Deps) *gin.Engine {
	s := &server{d: d}
	r := gin.New()
	r.Use(gin.Recovery())

	r.GET("/health", s.health)

	r.GET("/receipts", s.listReceipts)
	r.GET("/receipts/:nonce", s.getReceipt)
	r.POST("/receipts/verify", s.verifyReceipt)

	r.GET("/publishers", s.listPublishers)
	r.POST("/publishers", s.createPublisher)
	r.GET("/publishers/:id", s.getPublisher)
	r.GET("/publishers/:id/receipts", s.publisherReceipts)
	r.POST("/publishers/:id/probe", s.probePublisher)

	r.GET("/crawlers/:wallet/receipts", s.crawlerReceipts)

	r.GET("/analytics/publisher/:id", s.analyticsPublisher)
	r.GET("/analytics/crawler/:wallet", s.analyticsCrawler)

	r.GET("/reputation/:address", s.reputation)

	return r
}

func (s *server) health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"ok":      true,
		"service": "octroi-api-gateway",
		"version": version,
		"network": s.d.Network,
		"storage": s.d.Storage,
	})
}

// ── helpers ──────────────────────────────────────────────────────

func badRequest(c *gin.Context, msg string) {
	c.JSON(http.StatusBadRequest, gin.H{"error": msg})
}

// parseIntParam reads a non-negative integer query param with a fallback and
// optional max. Returns ok=false on a malformed value.
func parseIntParam(raw string, fallback, max int) (int, bool) {
	if raw == "" {
		return fallback, true
	}
	n, err := strconv.Atoi(raw)
	if err != nil || n < 0 {
		return 0, false
	}
	if max > 0 && n > max {
		return 0, false
	}
	return n, true
}
