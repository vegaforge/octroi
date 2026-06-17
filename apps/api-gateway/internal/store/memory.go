package store

import (
	"sort"
	"sync"
	"time"
)

// MemoryPublisherStore is an in-process PublisherStore for demos and tests.
type MemoryPublisherStore struct {
	mu      sync.RWMutex
	byID    map[string]Publisher
	domains map[string]string
}

func NewMemoryPublisherStore() *MemoryPublisherStore {
	return &MemoryPublisherStore{byID: map[string]Publisher{}, domains: map[string]string{}}
}

func (s *MemoryPublisherStore) Create(in CreatePublisherInput) (Publisher, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.byID[in.ID]; ok {
		return Publisher{}, ErrPublisherExists{Field: "id", Value: in.ID}
	}
	if _, ok := s.domains[in.Domain]; ok {
		return Publisher{}, ErrPublisherExists{Field: "domain", Value: in.Domain}
	}
	price := in.DefaultPriceAtomic
	if price == "" {
		price = "1000"
	}
	now := time.Now().UTC()
	p := Publisher{
		ID:                 in.ID,
		Domain:             in.Domain,
		WalletAddress:      in.WalletAddress,
		Network:            in.Network,
		DefaultPriceAtomic: price,
		Description:        in.Description,
		MinReputationScore: 0,
		RobotsTxtAware:     true,
		Active:             true,
		CreatedAt:          now,
		UpdatedAt:          now,
		APIKeyHash:         in.APIKeyHash,
	}
	s.byID[p.ID] = p
	s.domains[p.Domain] = p.ID
	return p, nil
}

func (s *MemoryPublisherStore) Get(id string) (*Publisher, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if p, ok := s.byID[id]; ok {
		return &p, nil
	}
	return nil, nil
}

func (s *MemoryPublisherStore) GetByAPIKeyHash(hash string) (*Publisher, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, p := range s.byID {
		if p.APIKeyHash != "" && p.APIKeyHash == hash {
			pp := p
			return &pp, nil
		}
	}
	return nil, nil
}

func (s *MemoryPublisherStore) List(f PublisherFilter) ([]Publisher, error) {
	s.mu.RLock()
	out := make([]Publisher, 0, len(s.byID))
	for _, p := range s.byID {
		if publisherMatches(p, f) {
			out = append(out, p)
		}
	}
	s.mu.RUnlock()
	sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt.After(out[j].CreatedAt) })
	return page(out, f.Offset, f.Limit), nil
}

func (s *MemoryPublisherStore) Count(f PublisherFilter) (int, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	n := 0
	for _, p := range s.byID {
		if publisherMatches(p, f) {
			n++
		}
	}
	return n, nil
}

func publisherMatches(p Publisher, f PublisherFilter) bool {
	if f.Active != nil && p.Active != *f.Active {
		return false
	}
	if f.Network != "" && p.Network != f.Network {
		return false
	}
	return true
}

// MemoryReceiptStore is an in-process ReceiptStore. The gateway only reads
// receipts (the facilitator writes them), so in memory mode it is empty unless
// seeded with Add (used by tests).
type MemoryReceiptStore struct {
	mu       sync.RWMutex
	byNonce  map[string]Receipt
	ordering []string
}

func NewMemoryReceiptStore() *MemoryReceiptStore {
	return &MemoryReceiptStore{byNonce: map[string]Receipt{}}
}

func (s *MemoryReceiptStore) Add(r Receipt) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.byNonce[r.Nonce]; ok {
		return
	}
	s.byNonce[r.Nonce] = r
	s.ordering = append(s.ordering, r.Nonce)
}

func (s *MemoryReceiptStore) List(f ReceiptFilter) ([]Receipt, error) {
	s.mu.RLock()
	out := make([]Receipt, 0, len(s.byNonce))
	for _, r := range s.byNonce {
		if receiptMatches(r, f) {
			out = append(out, r)
		}
	}
	s.mu.RUnlock()
	sort.Slice(out, func(i, j int) bool { return out[i].Timestamp > out[j].Timestamp })
	return page(out, f.Offset, f.Limit), nil
}

func (s *MemoryReceiptStore) Count(f ReceiptFilter) (int, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	n := 0
	for _, r := range s.byNonce {
		if receiptMatches(r, f) {
			n++
		}
	}
	return n, nil
}

func (s *MemoryReceiptStore) GetByNonce(nonce string) (*Receipt, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if r, ok := s.byNonce[nonce]; ok {
		return &r, nil
	}
	return nil, nil
}

func receiptMatches(r Receipt, f ReceiptFilter) bool {
	if f.PublisherID != "" && r.PublisherID != f.PublisherID {
		return false
	}
	if f.From != "" && r.From != f.From {
		return false
	}
	if f.To != "" && r.To != f.To {
		return false
	}
	if f.FromTimestamp != "" && r.Timestamp < f.FromTimestamp {
		return false
	}
	if f.ToTimestamp != "" && r.Timestamp > f.ToTimestamp {
		return false
	}
	return true
}

func page[T any](items []T, offset, limit int) []T {
	if offset > 0 {
		if offset >= len(items) {
			return []T{}
		}
		items = items[offset:]
	}
	if limit > 0 && limit < len(items) {
		items = items[:limit]
	}
	return items
}
