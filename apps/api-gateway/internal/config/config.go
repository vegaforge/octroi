package config

import (
	"fmt"
	"os"
	"strconv"
)

type Config struct {
	Port           int
	Network        string
	DatabaseURL    string
	FacilitatorURL string
}

var supportedNetworks = map[string]bool{
	"stellar-testnet": true,
	"stellar-mainnet": true,
}

// Load reads and validates the gateway configuration from the environment.
func Load() (Config, error) {
	port := 8080
	if v := os.Getenv("API_PORT"); v != "" {
		p, err := strconv.Atoi(v)
		if err != nil || p < 1 || p > 65535 {
			return Config{}, fmt.Errorf("API_PORT must be an integer in [1, 65535]; got %q", v)
		}
		port = p
	}

	network := os.Getenv("OCTROI_NETWORK")
	if network == "" {
		network = "stellar-testnet"
	}
	if !supportedNetworks[network] {
		return Config{}, fmt.Errorf("OCTROI_NETWORK %q is not supported", network)
	}

	return Config{
		Port:           port,
		Network:        network,
		DatabaseURL:    os.Getenv("DATABASE_URL"),
		FacilitatorURL: os.Getenv("NEXT_PUBLIC_FACILITATOR_URL"),
	}, nil
}
