package server

import (
	"bytes"
	"encoding/json"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/vegaforge/crawlpay/apps/api-gateway/internal/receipt"
	"github.com/vegaforge/crawlpay/apps/api-gateway/internal/store"
)

const defaultLimit = 20
const maxLimit = 100

func isISO(s string) bool {
	if _, err := time.Parse(time.RFC3339Nano, s); err == nil {
		return true
	}
	_, err := time.Parse(time.RFC3339, s)
	return err == nil
}

func (s *server) listReceipts(c *gin.Context) {
	f := store.ReceiptFilter{PublisherID: c.Query("publisher_id")}

	if v := c.Query("from_wallet"); v != "" {
		if !gAddressRe.MatchString(v) {
			badRequest(c, "invalid from_wallet")
			return
		}
		f.From = v
	}
	if v := c.Query("to_wallet"); v != "" {
		if !gAddressRe.MatchString(v) {
			badRequest(c, "invalid to_wallet")
			return
		}
		f.To = v
	}
	if v := c.Query("from_ts"); v != "" {
		if !isISO(v) {
			badRequest(c, "invalid from_ts (expected ISO 8601)")
			return
		}
		f.FromTimestamp = v
	}
	if v := c.Query("to_ts"); v != "" {
		if !isISO(v) {
			badRequest(c, "invalid to_ts (expected ISO 8601)")
			return
		}
		f.ToTimestamp = v
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
	f.Limit = limit
	f.Offset = offset

	items, err := s.d.Receipts.List(f)
	if err != nil {
		serverError(c, err)
		return
	}
	countFilter := f
	countFilter.Limit, countFilter.Offset = 0, 0
	total, err := s.d.Receipts.Count(countFilter)
	if err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"receipts":   items,
		"pagination": gin.H{"total": total, "limit": limit, "offset": offset},
	})
}

func (s *server) getReceipt(c *gin.Context) {
	r, err := s.d.Receipts.GetByNonce(c.Param("nonce"))
	if err != nil {
		serverError(c, err)
		return
	}
	if r == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "receipt not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"receipt": r})
}

func (s *server) verifyReceipt(c *gin.Context) {
	var body struct {
		Receipt        json.RawMessage `json:"receipt"`
		ExpectedSigner string          `json:"expectedSigner"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		badRequest(c, "receipt required (object)")
		return
	}
	trimmed := bytes.TrimSpace(body.Receipt)
	if len(trimmed) == 0 || trimmed[0] != '{' {
		badRequest(c, "receipt required (object)")
		return
	}
	expected := ""
	if gAddressRe.MatchString(body.ExpectedSigner) {
		expected = body.ExpectedSigner
	}
	c.JSON(http.StatusOK, receipt.Verify(trimmed, expected))
}

func serverError(c *gin.Context, err error) {
	c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error", "message": err.Error()})
}
