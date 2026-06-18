package server

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/vegaforge/octroi/apps/api-gateway/internal/analytics"
	"github.com/vegaforge/octroi/apps/api-gateway/internal/store"
)

const gAddr = "GCBFU4JRIBELJO4VG2SH54R4RGZS6ACCSOUZ5ZVAAMMD52AUDKE7OAUH"

const goldenReceipt = `{"version":"1","resource":"https://example.com/articles/how-soroban-works","amount":"1000","asset":"USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN","network":"stellar-testnet","from":"GCBFU4JRIBELJO4VG2SH54R4RGZS6ACCSOUZ5ZVAAMMD52AUDKE7OAUH","to":"GAZH5LOBQ5SNT7IVUS77D6SBK6OTIMSL5M5MBSXV2Q5DSDNMAPLCBASK","nonce":"8f2ac41d8f2ac41d8f2ac41d8f2ac41d","timestamp":"2026-06-16T12:00:00Z","settlement":"x402","onchainTxHash":"a1b2c3d4e5f6","mppSessionRef":null,"facilitatorPubkey":"GAGKSIFYESGEZUJZH4PJB333B3QGGNOT43LFV2ANAK4NWIVJJDM33J7P","signature":"z9DUrt/JR3e7xt4V1EncH9A0RhiogZWgQtwkvgIL5rdaRhx0j6nkm35ISWt9txwkQJ2Vwn7QxrrlWcKk43foCg=="}`

func testServer() (http.Handler, *store.MemoryReceiptStore) {
	gin.SetMode(gin.TestMode)
	mr := store.NewMemoryReceiptStore()
	r := New(Deps{
		Publishers: store.NewMemoryPublisherStore(),
		Receipts:   mr,
		Analytics:  analytics.New(mr),
		Network:    "stellar-testnet",
		Storage:    "memory",
	})
	return r, mr
}

func do(t *testing.T, h http.Handler, method, path, body string) (*httptest.ResponseRecorder, map[string]any) {
	t.Helper()
	var reader *strings.Reader
	if body != "" {
		reader = strings.NewReader(body)
	} else {
		reader = strings.NewReader("")
	}
	req := httptest.NewRequest(method, path, reader)
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	var parsed map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &parsed)
	return w, parsed
}

func TestHealth(t *testing.T) {
	h, _ := testServer()
	w, body := do(t, h, http.MethodGet, "/health", "")
	if w.Code != 200 {
		t.Fatalf("status %d", w.Code)
	}
	if body["ok"] != true || body["storage"] != "memory" || body["network"] != "stellar-testnet" {
		t.Fatalf("health body %v", body)
	}
}

func TestCreateAndGetPublisher(t *testing.T) {
	h, _ := testServer()
	w, body := do(t, h, http.MethodPost, "/publishers", `{"domain":"example.com","walletAddress":"`+gAddr+`"}`)
	if w.Code != 201 {
		t.Fatalf("create status %d body %s", w.Code, w.Body.String())
	}
	if !strings.HasPrefix(body["apiKey"].(string), "oct_") {
		t.Fatalf("apiKey: %v", body["apiKey"])
	}
	if strings.Contains(w.Body.String(), "apiKeyHash") {
		t.Fatal("response must not leak apiKeyHash")
	}
	pub := body["publisher"].(map[string]any)
	if pub["id"] != "pub_example" {
		t.Fatalf("publisher id %v", pub["id"])
	}

	w2, body2 := do(t, h, http.MethodGet, "/publishers/pub_example", "")
	if w2.Code != 200 || body2["publisher"].(map[string]any)["domain"] != "example.com" {
		t.Fatalf("get publisher %d %v", w2.Code, body2)
	}
}

func TestCreatePublisherRejectsBadInput(t *testing.T) {
	h, _ := testServer()
	if w, _ := do(t, h, http.MethodPost, "/publishers", `{"domain":"not a domain","walletAddress":"`+gAddr+`"}`); w.Code != 400 {
		t.Fatalf("bad domain status %d", w.Code)
	}
	if w, _ := do(t, h, http.MethodPost, "/publishers", `{"domain":"example.com","walletAddress":"0xabc"}`); w.Code != 400 {
		t.Fatalf("bad wallet status %d", w.Code)
	}
}

func TestProbeRequiresAuth(t *testing.T) {
	h, _ := testServer()
	w, _ := do(t, h, http.MethodPost, "/publishers/pub_example/probe", "")
	if w.Code != 401 {
		t.Fatalf("expected 401, got %d", w.Code)
	}
}

func TestVerifyReceiptEndpoint(t *testing.T) {
	h, _ := testServer()
	w, body := do(t, h, http.MethodPost, "/receipts/verify", `{"receipt":`+goldenReceipt+`}`)
	if w.Code != 200 || body["valid"] != true {
		t.Fatalf("verify status %d body %v", w.Code, body)
	}
}

func TestReputationAndValidation(t *testing.T) {
	h, _ := testServer()
	if w, _ := do(t, h, http.MethodGet, "/reputation/not-a-key", ""); w.Code != 400 {
		t.Fatalf("expected 400 for bad address, got %d", w.Code)
	}
	w, body := do(t, h, http.MethodGet, "/reputation/"+gAddr, "")
	if w.Code != 200 {
		t.Fatalf("status %d", w.Code)
	}
	rep := body["reputation"].(map[string]any)
	if rep["provisional"] != true || rep["settledCount"].(float64) != 0 || rep["score"].(float64) != 0 {
		t.Fatalf("reputation %v", rep)
	}
}

func TestReceiptsListEmpty(t *testing.T) {
	h, _ := testServer()
	w, body := do(t, h, http.MethodGet, "/receipts", "")
	if w.Code != 200 {
		t.Fatalf("status %d", w.Code)
	}
	if body["receipts"] == nil {
		t.Fatal("receipts should be [] not null")
	}
	if body["pagination"].(map[string]any)["total"].(float64) != 0 {
		t.Fatal("total should be 0")
	}
}
