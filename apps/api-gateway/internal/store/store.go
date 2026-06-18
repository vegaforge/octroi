package store

import (
	"errors"
	"time"
)

// Publisher mirrors the TypeScript PublisherRecord. APIKeyHash is never
// serialized; it is only used for authentication.
type Publisher struct {
	ID                 string    `json:"id"`
	Domain             string    `json:"domain"`
	WalletAddress      string    `json:"walletAddress"`
	Network            string    `json:"network"`
	DefaultPriceAtomic string    `json:"defaultPriceAtomic"`
	OctroiAgentID      *string   `json:"octroiAgentId,omitempty"`
	Description        *string   `json:"description,omitempty"`
	MinReputationScore int       `json:"minReputationScore"`
	RobotsTxtAware     bool      `json:"robotsTxtAware"`
	Active             bool      `json:"active"`
	CreatedAt          time.Time `json:"createdAt"`
	UpdatedAt          time.Time `json:"updatedAt"`
	APIKeyHash         string    `json:"-"`
}

type CreatePublisherInput struct {
	ID                 string
	Domain             string
	WalletAddress      string
	Network            string
	DefaultPriceAtomic string // atomic USDC; defaults to "1000" when empty
	Description        *string
	APIKeyHash         string
}

type PublisherFilter struct {
	Active  *bool
	Network string
	Limit   int
	Offset  int
}

// MppSessionRef is the session coordinate on an MPP-settled receipt.
type MppSessionRef struct {
	SessionID string `json:"sessionId"`
	Sequence  int    `json:"sequence"`
}

// Receipt mirrors the TypeScript StoredReceipt: the canonical signed receipt
// plus publisherId. onchainTxHash and mppSessionRef serialize as null, not
// omitted, to match the canonical shape.
type Receipt struct {
	Version           string         `json:"version"`
	PublisherID       string         `json:"publisherId"`
	Resource          string         `json:"resource"`
	Amount            string         `json:"amount"`
	Asset             string         `json:"asset"`
	Network           string         `json:"network"`
	From              string         `json:"from"`
	To                string         `json:"to"`
	Nonce             string         `json:"nonce"`
	Timestamp         string         `json:"timestamp"`
	Settlement        string         `json:"settlement"`
	OnchainTxHash     *string        `json:"onchainTxHash"`
	MppSessionRef     *MppSessionRef `json:"mppSessionRef"`
	FacilitatorPubkey string         `json:"facilitatorPubkey"`
	Signature         string         `json:"signature"`
}

type ReceiptFilter struct {
	PublisherID   string
	From          string
	To            string
	FromTimestamp string // ISO 8601 inclusive lower bound
	ToTimestamp   string // ISO 8601 inclusive upper bound
	Limit         int
	Offset        int
}

// ErrPublisherExists is returned by PublisherStore.Create on an id or domain collision.
type ErrPublisherExists struct {
	Field string // "id" or "domain"
	Value string
}

func (e ErrPublisherExists) Error() string {
	return "publisher already exists: " + e.Field + "=" + e.Value
}

var ErrNotFound = errors.New("not found")

type PublisherStore interface {
	Create(in CreatePublisherInput) (Publisher, error)
	Get(id string) (*Publisher, error)
	GetByAPIKeyHash(hash string) (*Publisher, error)
	List(f PublisherFilter) ([]Publisher, error)
	Count(f PublisherFilter) (int, error)
}

type ReceiptStore interface {
	List(f ReceiptFilter) ([]Receipt, error)
	Count(f ReceiptFilter) (int, error)
	GetByNonce(nonce string) (*Receipt, error)
}
