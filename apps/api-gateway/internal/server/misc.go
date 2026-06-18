package server

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/vegaforge/octroi/apps/api-gateway/internal/analytics"
	"github.com/vegaforge/octroi/apps/api-gateway/internal/reputation"
	"github.com/vegaforge/octroi/apps/api-gateway/internal/store"
)

func (s *server) crawlerReceipts(c *gin.Context) {
	wallet := c.Param("wallet")
	if !gAddressRe.MatchString(wallet) {
		badRequest(c, "wallet must be a Stellar G-address")
		return
	}
	limit, ok := parseIntParam(c.Query("limit"), defaultLimit, maxLimit)
	if !ok || limit < 1 {
		badRequest(c, "limit must be in [1, 100]")
		return
	}
	offset, ok := parseIntParam(c.Query("offset"), 0, 0)
	if !ok {
		badRequest(c, "invalid offset")
		return
	}

	items, err := s.d.Receipts.List(store.ReceiptFilter{From: wallet, Limit: limit, Offset: offset})
	if err != nil {
		serverError(c, err)
		return
	}
	total, err := s.d.Receipts.Count(store.ReceiptFilter{From: wallet})
	if err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"crawler":    gin.H{"walletAddress": wallet},
		"receipts":   items,
		"pagination": gin.H{"total": total, "limit": limit, "offset": offset},
	})
}

func (s *server) analyticsPublisher(c *gin.Context) {
	window, ok := analytics.ParseWindow(c.Query("window"))
	if !ok {
		badRequest(c, "window must be one of: day, week, month")
		return
	}
	a, err := s.d.Analytics.ForPublisher(c.Param("id"), window)
	if err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"analytics": a})
}

func (s *server) analyticsCrawler(c *gin.Context) {
	wallet := c.Param("wallet")
	if !gAddressRe.MatchString(wallet) {
		badRequest(c, "wallet must be a Stellar G-address")
		return
	}
	window, ok := analytics.ParseWindow(c.Query("window"))
	if !ok {
		badRequest(c, "window must be one of: day, week, month")
		return
	}
	a, err := s.d.Analytics.ForCrawler(wallet, window)
	if err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"analytics": a})
}

func (s *server) reputation(c *gin.Context) {
	address := c.Param("address")
	if !gAddressRe.MatchString(address) {
		badRequest(c, "address must be a Stellar G-address")
		return
	}
	summary, err := reputation.Get(s.d.Receipts, address)
	if err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"reputation": summary})
}
