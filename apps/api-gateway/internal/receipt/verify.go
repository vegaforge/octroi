package receipt

import (
	"bytes"
	"crypto/ed25519"
	"encoding/base64"
	"encoding/json"
)

// Result mirrors the TypeScript VerificationResult.
type Result struct {
	Valid        bool   `json:"valid"`
	SignerPubkey string `json:"signerPubkey"`
	Reason       string `json:"reason,omitempty"`
}

// Verify checks a receipt's Ed25519 signature against the embedded
// facilitatorPubkey. If expectedSigner is non-empty it must match. It never
// errors; a bad receipt comes back as Valid=false with a reason.
func Verify(receiptJSON []byte, expectedSigner string) Result {
	dec := json.NewDecoder(bytes.NewReader(receiptJSON))
	dec.UseNumber()
	var parsed interface{}
	if err := dec.Decode(&parsed); err != nil {
		return Result{Valid: false, Reason: "receipt is not valid JSON"}
	}
	obj, ok := parsed.(map[string]interface{})
	if !ok {
		return Result{Valid: false, Reason: "receipt must be a JSON object"}
	}

	signerPub, _ := obj["facilitatorPubkey"].(string)
	sigStr, _ := obj["signature"].(string)

	if expectedSigner != "" && signerPub != expectedSigner {
		return Result{Valid: false, SignerPubkey: signerPub, Reason: "facilitatorPubkey is not the expected signer " + expectedSigner}
	}

	pub, err := decodeAccountID(signerPub)
	if err != nil {
		return Result{Valid: false, SignerPubkey: signerPub, Reason: "facilitatorPubkey is not a valid Stellar public key"}
	}
	sig, err := base64.StdEncoding.DecodeString(sigStr)
	if err != nil {
		return Result{Valid: false, SignerPubkey: signerPub, Reason: "signature is not valid base64"}
	}

	delete(obj, "signature")
	canon, err := canonicalize(obj)
	if err != nil {
		return Result{Valid: false, SignerPubkey: signerPub, Reason: "cannot canonicalize receipt"}
	}

	if !ed25519.Verify(ed25519.PublicKey(pub), []byte(canon), sig) {
		return Result{Valid: false, SignerPubkey: signerPub, Reason: "signature does not verify against facilitatorPubkey"}
	}
	return Result{Valid: true, SignerPubkey: signerPub}
}
