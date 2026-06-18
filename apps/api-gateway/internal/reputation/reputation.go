package reputation

import (
	"math"

	"github.com/vegaforge/octroi/apps/api-gateway/internal/store"
)

// halfSaturation is the settled-count at which the score reaches ~67.
const halfSaturation = 100

// Summary is the provisional, off-chain reputation (PRD §11.4).
type Summary struct {
	Address      string `json:"address"`
	Provisional  bool   `json:"provisional"`
	SettledCount int    `json:"settledCount"`
	Score        int    `json:"score"`
}

// Get computes a provisional score from the crawler's settlement history.
func Get(receipts store.ReceiptStore, address string) (Summary, error) {
	count, err := receipts.Count(store.ReceiptFilter{From: address})
	if err != nil {
		return Summary{}, err
	}
	score := int(math.Round(float64(100*count) / float64(count+halfSaturation)))
	return Summary{Address: address, Provisional: true, SettledCount: count, Score: score}, nil
}
