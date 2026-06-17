package receipt

import (
	"bytes"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
)

// canonicalize renders a JSON value in CrawlPay's canonical form: object keys
// sorted, no whitespace, null kept. It mirrors the TypeScript canonicalizer so
// receipts hash identically across languages.
func canonicalize(v interface{}) (string, error) {
	switch t := v.(type) {
	case nil:
		return "null", nil
	case bool:
		if t {
			return "true", nil
		}
		return "false", nil
	case json.Number:
		return t.String(), nil
	case string:
		return jsonString(t)
	case []interface{}:
		parts := make([]string, len(t))
		for i, e := range t {
			s, err := canonicalize(e)
			if err != nil {
				return "", err
			}
			parts[i] = s
		}
		return "[" + strings.Join(parts, ",") + "]", nil
	case map[string]interface{}:
		keys := make([]string, 0, len(t))
		for k := range t {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		parts := make([]string, 0, len(keys))
		for _, k := range keys {
			kb, err := jsonString(k)
			if err != nil {
				return "", err
			}
			vb, err := canonicalize(t[k])
			if err != nil {
				return "", err
			}
			parts = append(parts, kb+":"+vb)
		}
		return "{" + strings.Join(parts, ",") + "}", nil
	default:
		return "", fmt.Errorf("cannot canonicalize %T", v)
	}
}

// jsonString encodes a string the way JSON.stringify does (no HTML escaping).
func jsonString(s string) (string, error) {
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	if err := enc.Encode(s); err != nil {
		return "", err
	}
	return strings.TrimRight(buf.String(), "\n"), nil
}
