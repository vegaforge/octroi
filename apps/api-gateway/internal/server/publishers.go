package server

import (
	"errors"
	"math/big"
	"net/http"
	"regexp"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/vegaforge/crawlpay/apps/api-gateway/internal/auth"
	"github.com/vegaforge/crawlpay/apps/api-gateway/internal/probe"
	"github.com/vegaforge/crawlpay/apps/api-gateway/internal/store"
)

var (
	delimRe    = regexp.MustCompile(`[-_]`)
	nonAlnumRe = regexp.MustCompile(`[^a-zA-Z0-9]`)
)

func (s *server) listPublishers(c *gin.Context) {
	var f store.PublisherFilter
	if v := c.Query("active"); v != "" {
		active := v == "true" || v == "1"
		f.Active = &active
	}
	f.Network = c.Query("network")

	limit, ok := parseIntParam(c.Query("limit"), defaultLimit, maxLimit)
	if !ok {
		badRequest(c, "limit must be in [0, 100]")
		return
	}
	offset, ok := parseIntParam(c.Query("offset"), 0, 0)
	if !ok {
		badRequest(c, "invalid offset")
		return
	}
	f.Limit, f.Offset = limit, offset

	items, err := s.d.Publishers.List(f)
	if err != nil {
		serverError(c, err)
		return
	}
	countFilter := f
	countFilter.Limit, countFilter.Offset = 0, 0
	total, err := s.d.Publishers.Count(countFilter)
	if err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"publishers": items,
		"pagination": gin.H{"total": total, "limit": limit, "offset": offset},
	})
}

func (s *server) createPublisher(c *gin.Context) {
	var body struct {
		ID                 string `json:"id"`
		Domain             string `json:"domain"`
		WalletAddress      string `json:"walletAddress"`
		DefaultPriceAtomic string `json:"defaultPriceAtomic"`
		Description        string `json:"description"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		badRequest(c, "invalid_domain")
		return
	}
	domain := strings.ToLower(strings.TrimSpace(body.Domain))
	if !domainRe.MatchString(domain) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_domain", "detail": "expected e.g. example.com"})
		return
	}
	if !gAddressRe.MatchString(body.WalletAddress) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_wallet_address", "detail": "expected a Stellar G-address"})
		return
	}

	in := store.CreatePublisherInput{
		Domain:        domain,
		WalletAddress: body.WalletAddress,
		Network:       s.d.Network,
	}
	in.ID = body.ID
	if in.ID == "" {
		in.ID = makePublisherID(domain)
	}
	if body.DefaultPriceAtomic != "" {
		if _, ok := new(big.Int).SetString(body.DefaultPriceAtomic, 10); !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_default_price"})
			return
		}
		in.DefaultPriceAtomic = body.DefaultPriceAtomic
	}
	if body.Description != "" {
		in.Description = &body.Description
	}

	key, hash := auth.GenerateAPIKey()
	in.APIKeyHash = hash

	created, err := s.d.Publishers.Create(in)
	if err != nil {
		var exists store.ErrPublisherExists
		if errors.As(err, &exists) {
			c.JSON(http.StatusConflict, gin.H{"error": "already_exists", "field": exists.Field, "value": exists.Value})
			return
		}
		serverError(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"publisher": created, "apiKey": key})
}

func (s *server) getPublisher(c *gin.Context) {
	p, err := s.d.Publishers.Get(c.Param("id"))
	if err != nil {
		serverError(c, err)
		return
	}
	if p == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "publisher not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"publisher": p})
}

func (s *server) publisherReceipts(c *gin.Context) {
	id := c.Param("id")
	limit, ok := parseIntParam(c.Query("limit"), defaultLimit, maxLimit)
	if !ok {
		badRequest(c, "limit must be in [0, 100]")
		return
	}
	offset, ok := parseIntParam(c.Query("offset"), 0, 0)
	if !ok {
		badRequest(c, "invalid offset")
		return
	}

	p, err := s.d.Publishers.Get(id)
	if err != nil {
		serverError(c, err)
		return
	}
	if p == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "publisher not found"})
		return
	}

	items, err := s.d.Receipts.List(store.ReceiptFilter{PublisherID: id, Limit: limit, Offset: offset})
	if err != nil {
		serverError(c, err)
		return
	}
	total, err := s.d.Receipts.Count(store.ReceiptFilter{PublisherID: id})
	if err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"publisher":  gin.H{"id": p.ID, "domain": p.Domain},
		"receipts":   items,
		"pagination": gin.H{"total": total, "limit": limit, "offset": offset},
	})
}

func (s *server) probePublisher(c *gin.Context) {
	authed, err := auth.Authenticate(c.GetHeader("Authorization"), s.d.Publishers)
	if err != nil {
		serverError(c, err)
		return
	}
	if authed == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid_api_key"})
		return
	}
	p, err := s.d.Publishers.Get(c.Param("id"))
	if err != nil {
		serverError(c, err)
		return
	}
	if p == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "publisher not found"})
		return
	}
	if p.ID != authed.ID {
		c.JSON(http.StatusForbidden, gin.H{"error": "not_owner"})
		return
	}
	c.JSON(http.StatusOK, probe.Probe(p.Domain))
}

// makePublisherID slugifies a domain into a stable id (pub_<camelCase>).
func makePublisherID(domain string) string {
	d := strings.TrimPrefix(strings.ToLower(domain), "www.")
	label := d
	if i := strings.IndexByte(d, '.'); i >= 0 {
		label = d[:i]
	}
	if label == "" {
		label = "site"
	}
	var camel strings.Builder
	first := true
	for _, part := range delimRe.Split(label, -1) {
		if part == "" {
			continue
		}
		if first {
			camel.WriteString(part)
			first = false
		} else {
			camel.WriteString(strings.ToUpper(part[:1]) + part[1:])
		}
	}
	clean := nonAlnumRe.ReplaceAllString(camel.String(), "")
	if len(clean) > 32 {
		clean = clean[:32]
	}
	if clean == "" {
		clean = "site"
	}
	return "pub_" + clean
}
