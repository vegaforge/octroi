package probe

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"time"
)

type Result struct {
	OK               bool   `json:"ok"`
	Status           int    `json:"status"`
	HasPaymentHeader bool   `json:"hasPaymentHeader"`
	Detail           string `json:"detail"`
	URL              string `json:"url"`
}

const timeout = 10 * time.Second

var schemeRe = regexp.MustCompile(`^https?://`)

// Probe GETs a random path on the publisher's domain and checks for working
// middleware (402 + a Payment-Required header). Not a security check, just a
// setup smoke test.
func Probe(domain string) Result {
	host := sanitizeDomain(domain)
	n := make([]byte, 8)
	_, _ = rand.Read(n)
	url := fmt.Sprintf("https://%s/__octroi-probe-%s", host, hex.EncodeToString(n))

	client := &http.Client{
		Timeout:       timeout,
		CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse },
	}
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return Result{OK: false, Status: 0, Detail: fmt.Sprintf("Could not reach https://%s: %s", host, err.Error()), URL: url}
	}
	req.Header.Set("User-Agent", "Octroi-Integration-Probe/1.0")

	resp, err := client.Do(req)
	if err != nil {
		return Result{OK: false, Status: 0, Detail: fmt.Sprintf("Could not reach https://%s: %s", host, err.Error()), URL: url}
	}
	defer resp.Body.Close()

	status := resp.StatusCode
	paymentHeader := firstNonEmpty(
		resp.Header.Get("Payment-Required"),
		resp.Header.Get("X-Payment-Required"),
		resp.Header.Get("Www-Payment-Required"),
	)

	if status == 402 && paymentHeader != "" {
		return Result{OK: true, Status: 402, HasPaymentHeader: true, Detail: "Middleware is responding with 402 + Payment-Required. You're live.", URL: url}
	}
	if status == 402 {
		return Result{OK: false, Status: 402, HasPaymentHeader: false, Detail: "Got 402 but no Payment-Required header. Check middleware config.", URL: url}
	}
	return Result{OK: false, Status: status, HasPaymentHeader: paymentHeader != "", Detail: fmt.Sprintf("Expected 402, got %d. Is the middleware mounted on this path?", status), URL: url}
}

func sanitizeDomain(domain string) string {
	d := strings.ToLower(strings.TrimSpace(domain))
	d = schemeRe.ReplaceAllString(d, "")
	if i := strings.IndexByte(d, '/'); i >= 0 {
		d = d[:i]
	}
	return strings.TrimSpace(d)
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if v != "" {
			return v
		}
	}
	return ""
}
