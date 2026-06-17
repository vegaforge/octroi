package receipt

import (
	"encoding/json"
	"testing"
)

// Golden receipts signed by the TypeScript receipt-signer (Ed25519 over the
// canonical JSON). Go must verify them, proving the two implementations agree.
const goldenX402 = `{"version":"1","resource":"https://example.com/articles/how-soroban-works","amount":"1000","asset":"USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN","network":"stellar-testnet","from":"GCBFU4JRIBELJO4VG2SH54R4RGZS6ACCSOUZ5ZVAAMMD52AUDKE7OAUH","to":"GAZH5LOBQ5SNT7IVUS77D6SBK6OTIMSL5M5MBSXV2Q5DSDNMAPLCBASK","nonce":"8f2ac41d8f2ac41d8f2ac41d8f2ac41d","timestamp":"2026-06-16T12:00:00Z","settlement":"x402","onchainTxHash":"a1b2c3d4e5f6","mppSessionRef":null,"facilitatorPubkey":"GAGKSIFYESGEZUJZH4PJB333B3QGGNOT43LFV2ANAK4NWIVJJDM33J7P","signature":"z9DUrt/JR3e7xt4V1EncH9A0RhiogZWgQtwkvgIL5rdaRhx0j6nkm35ISWt9txwkQJ2Vwn7QxrrlWcKk43foCg=="}`

const goldenMPP = `{"version":"1","resource":"https://example.com/articles/how-soroban-works","amount":"1000","asset":"USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN","network":"stellar-testnet","from":"GCBFU4JRIBELJO4VG2SH54R4RGZS6ACCSOUZ5ZVAAMMD52AUDKE7OAUH","to":"GAZH5LOBQ5SNT7IVUS77D6SBK6OTIMSL5M5MBSXV2Q5DSDNMAPLCBASK","nonce":"8f2ac41d8f2ac41d8f2ac41d8f2ac41d","timestamp":"2026-06-16T12:00:00Z","settlement":"mpp","onchainTxHash":null,"mppSessionRef":{"sessionId":"sess_01","sequence":42},"facilitatorPubkey":"GDJGGHUX5TOJONQAL3F4UMUAY2UBRDV74DLRTQ4RKML47QFHACZ6GFCW","signature":"2gTMoNh/4pbFq96rY9IwZJltqWvSEoCghWHcK+a+T3skgm7MBNiXPgnPQoOIMco5H4oOWyPrpIg46Ko1SYAQAw=="}`

const goldenX402Signer = "GAGKSIFYESGEZUJZH4PJB333B3QGGNOT43LFV2ANAK4NWIVJJDM33J7P"

func TestVerifyGoldenX402(t *testing.T) {
	r := Verify([]byte(goldenX402), "")
	if !r.Valid {
		t.Fatalf("expected valid x402 receipt, got %+v", r)
	}
	if r.SignerPubkey != goldenX402Signer {
		t.Fatalf("signer = %q", r.SignerPubkey)
	}
}

func TestVerifyGoldenMPP(t *testing.T) {
	r := Verify([]byte(goldenMPP), "")
	if !r.Valid {
		t.Fatalf("expected valid mpp receipt (nested mppSessionRef), got %+v", r)
	}
}

func TestVerifyRejectsTamperedField(t *testing.T) {
	var obj map[string]interface{}
	if err := json.Unmarshal([]byte(goldenX402), &obj); err != nil {
		t.Fatal(err)
	}
	obj["amount"] = "999999"
	tampered, _ := json.Marshal(obj)

	r := Verify(tampered, "")
	if r.Valid {
		t.Fatal("tampered receipt must not verify")
	}
}

func TestVerifyExpectedSigner(t *testing.T) {
	if r := Verify([]byte(goldenX402), goldenX402Signer); !r.Valid {
		t.Fatalf("expected valid when expectedSigner matches, got %+v", r)
	}
	other := "GAZH5LOBQ5SNT7IVUS77D6SBK6OTIMSL5M5MBSXV2Q5DSDNMAPLCBASK"
	r := Verify([]byte(goldenX402), other)
	if r.Valid {
		t.Fatal("must reject a non-matching expectedSigner")
	}
}

func TestDecodeAccountIDRoundTrip(t *testing.T) {
	pub, err := decodeAccountID(goldenX402Signer)
	if err != nil {
		t.Fatalf("decode failed: %v", err)
	}
	if len(pub) != 32 {
		t.Fatalf("pubkey len = %d", len(pub))
	}
	if _, err := decodeAccountID("not-a-key"); err == nil {
		t.Fatal("expected error for a bad address")
	}
}
