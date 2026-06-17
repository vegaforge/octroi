package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"strings"

	"github.com/vegaforge/crawlpay/apps/api-gateway/internal/store"
)

// HashAPIKey returns the hex sha256 of a key. Only the hash is ever stored.
func HashAPIKey(key string) string {
	sum := sha256.Sum256([]byte(key))
	return hex.EncodeToString(sum[:])
}

// GenerateAPIKey mints a fresh key and its hash. The plaintext is shown once.
func GenerateAPIKey() (key, hash string) {
	b := make([]byte, 24)
	_, _ = rand.Read(b)
	key = "cpk_" + base64.RawURLEncoding.EncodeToString(b)
	return key, HashAPIKey(key)
}

// Authenticate resolves a publisher from an `Authorization: Bearer <key>`
// header, or nil if the header is missing or the key does not match.
func Authenticate(authorization string, ps store.PublisherStore) (*store.Publisher, error) {
	parts := strings.SplitN(strings.TrimSpace(authorization), " ", 2)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
		return nil, nil
	}
	key := strings.TrimSpace(parts[1])
	if key == "" {
		return nil, nil
	}
	return ps.GetByAPIKeyHash(HashAPIKey(key))
}
