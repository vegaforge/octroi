package main

import (
	"fmt"
	"log"

	"github.com/gin-gonic/gin"

	"github.com/vegaforge/octroi/apps/api-gateway/internal/analytics"
	"github.com/vegaforge/octroi/apps/api-gateway/internal/config"
	"github.com/vegaforge/octroi/apps/api-gateway/internal/server"
	"github.com/vegaforge/octroi/apps/api-gateway/internal/store"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	var publishers store.PublisherStore
	var receipts store.ReceiptStore
	storage := "memory"

	if cfg.DatabaseURL != "" {
		pg, err := store.NewPostgres(cfg.DatabaseURL)
		if err != nil {
			log.Fatalf("postgres: %v", err)
		}
		defer pg.Close()
		publishers = pg.Publishers()
		receipts = pg.Receipts()
		storage = "postgres"
	} else {
		publishers = store.NewMemoryPublisherStore()
		receipts = store.NewMemoryReceiptStore()
		log.Println("DATABASE_URL not set, using in-memory store. Demo only.")
	}

	gin.SetMode(gin.ReleaseMode)
	router := server.New(server.Deps{
		Publishers: publishers,
		Receipts:   receipts,
		Analytics:  analytics.New(receipts),
		Network:    cfg.Network,
		Storage:    storage,
	})

	addr := fmt.Sprintf(":%d", cfg.Port)
	log.Printf("octroi-api-gateway listening on %s (network=%s storage=%s)", addr, cfg.Network, storage)
	if err := router.Run(addr); err != nil {
		log.Fatal(err)
	}
}
