package auth

import (
	"strings"
	"testing"

	"github.com/vegaforge/crawlpay/apps/api-gateway/internal/store"
)

func TestGenerateAndHash(t *testing.T) {
	key, hash := GenerateAPIKey()
	if !strings.HasPrefix(key, "cpk_") {
		t.Fatalf("key prefix: %s", key)
	}
	if HashAPIKey(key) != hash {
		t.Fatal("hash does not match key")
	}
	if len(hash) != 64 {
		t.Fatalf("sha256 hex length = %d", len(hash))
	}
}

func TestAuthenticate(t *testing.T) {
	ps := store.NewMemoryPublisherStore()
	key, hash := GenerateAPIKey()
	if _, err := ps.Create(store.CreatePublisherInput{
		ID: "pub_a", Domain: "a.com", WalletAddress: "GA", Network: "stellar-testnet", APIKeyHash: hash,
	}); err != nil {
		t.Fatal(err)
	}

	p, err := Authenticate("Bearer "+key, ps)
	if err != nil || p == nil || p.ID != "pub_a" {
		t.Fatalf("expected pub_a, got %+v (err %v)", p, err)
	}

	for _, header := range []string{"Bearer wrong-key", "", "Basic " + key, "Bearer "} {
		got, _ := Authenticate(header, ps)
		if got != nil {
			t.Fatalf("expected nil for %q, got %+v", header, got)
		}
	}
}
