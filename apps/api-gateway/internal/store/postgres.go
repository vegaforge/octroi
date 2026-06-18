package store

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Postgres holds the connection pool and hands out the repositories.
type Postgres struct {
	pool *pgxpool.Pool
}

func NewPostgres(url string) (*Postgres, error) {
	pool, err := pgxpool.New(context.Background(), url)
	if err != nil {
		return nil, err
	}
	return &Postgres{pool: pool}, nil
}

func (p *Postgres) Close()                     { p.pool.Close() }
func (p *Postgres) Publishers() PublisherStore { return &pgPublishers{pool: p.pool} }
func (p *Postgres) Receipts() ReceiptStore     { return &pgReceipts{pool: p.pool} }

// isoMillis matches JS Date.toISOString(): UTC, millisecond precision, 'Z'.
func isoMillis(t time.Time) string {
	return t.UTC().Format("2006-01-02T15:04:05.000Z")
}

const publisherColumns = `id, domain, wallet_address, octroi_agent_id, api_key_hash,
	default_price_atomic, network, min_reputation_score, robots_txt_aware, active,
	description, created_at, updated_at`

type pgPublishers struct{ pool *pgxpool.Pool }

func scanPublisher(row interface {
	Scan(dest ...any) error
}) (Publisher, error) {
	var (
		p        Publisher
		agentID  *string
		apiKey   *string
		priceI64 int64
		descr    *string
	)
	if err := row.Scan(&p.ID, &p.Domain, &p.WalletAddress, &agentID, &apiKey, &priceI64,
		&p.Network, &p.MinReputationScore, &p.RobotsTxtAware, &p.Active, &descr,
		&p.CreatedAt, &p.UpdatedAt); err != nil {
		return Publisher{}, err
	}
	p.OctroiAgentID = agentID
	p.Description = descr
	p.DefaultPriceAtomic = strconv.FormatInt(priceI64, 10)
	if apiKey != nil {
		p.APIKeyHash = *apiKey
	}
	return p, nil
}

func (s *pgPublishers) Create(in CreatePublisherInput) (Publisher, error) {
	price := int64(1000)
	if in.DefaultPriceAtomic != "" {
		v, err := strconv.ParseInt(in.DefaultPriceAtomic, 10, 64)
		if err != nil {
			return Publisher{}, fmt.Errorf("invalid default price: %w", err)
		}
		price = v
	}
	row := s.pool.QueryRow(context.Background(),
		`INSERT INTO publishers (id, domain, wallet_address, api_key_hash, default_price_atomic, network)
		 VALUES ($1,$2,$3,$4,$5,$6) RETURNING `+publisherColumns,
		in.ID, in.Domain, in.WalletAddress, in.APIKeyHash, price, in.Network)
	p, err := scanPublisher(row)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			field := "id"
			value := in.ID
			if strings.Contains(pgErr.ConstraintName, "domain") {
				field, value = "domain", in.Domain
			}
			return Publisher{}, ErrPublisherExists{Field: field, Value: value}
		}
		return Publisher{}, err
	}
	if in.Description != nil {
		_, _ = s.pool.Exec(context.Background(), `UPDATE publishers SET description=$1 WHERE id=$2`, *in.Description, p.ID)
		p.Description = in.Description
	}
	return p, nil
}

func (s *pgPublishers) Get(id string) (*Publisher, error) {
	row := s.pool.QueryRow(context.Background(), `SELECT `+publisherColumns+` FROM publishers WHERE id=$1`, id)
	p, err := scanPublisher(row)
	return optional(p, err)
}

func (s *pgPublishers) GetByAPIKeyHash(hash string) (*Publisher, error) {
	row := s.pool.QueryRow(context.Background(), `SELECT `+publisherColumns+` FROM publishers WHERE api_key_hash=$1`, hash)
	p, err := scanPublisher(row)
	return optional(p, err)
}

func (s *pgPublishers) List(f PublisherFilter) ([]Publisher, error) {
	where, args := publisherWhere(f)
	q := `SELECT ` + publisherColumns + ` FROM publishers` + where + ` ORDER BY created_at DESC`
	q += limitOffset(&args, f.Limit, f.Offset)
	rows, err := s.pool.Query(context.Background(), q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Publisher{}
	for rows.Next() {
		p, err := scanPublisher(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (s *pgPublishers) Count(f PublisherFilter) (int, error) {
	where, args := publisherWhere(f)
	var n int
	err := s.pool.QueryRow(context.Background(), `SELECT COUNT(*) FROM publishers`+where, args...).Scan(&n)
	return n, err
}

func publisherWhere(f PublisherFilter) (string, []any) {
	var clauses []string
	var args []any
	if f.Active != nil {
		args = append(args, *f.Active)
		clauses = append(clauses, fmt.Sprintf("active = $%d", len(args)))
	}
	if f.Network != "" {
		args = append(args, f.Network)
		clauses = append(clauses, fmt.Sprintf("network = $%d", len(args)))
	}
	return whereClause(clauses), args
}

const receiptColumns = `nonce, publisher_id, from_wallet, to_wallet, resource, amount_atomic,
	asset, network, settlement, onchain_tx_hash, mpp_session_id, mpp_sequence,
	facilitator_pubkey, signature, issued_at`

type pgReceipts struct{ pool *pgxpool.Pool }

func scanReceipt(row interface {
	Scan(dest ...any) error
}) (Receipt, error) {
	var (
		r        Receipt
		amount   int64
		txHash   *string
		sessID   *string
		sequence *int
		issuedAt time.Time
	)
	if err := row.Scan(&r.Nonce, &r.PublisherID, &r.From, &r.To, &r.Resource, &amount,
		&r.Asset, &r.Network, &r.Settlement, &txHash, &sessID, &sequence,
		&r.FacilitatorPubkey, &r.Signature, &issuedAt); err != nil {
		return Receipt{}, err
	}
	r.Version = "1"
	r.Amount = strconv.FormatInt(amount, 10)
	r.Timestamp = isoMillis(issuedAt)
	r.OnchainTxHash = txHash
	if sessID != nil {
		seq := 0
		if sequence != nil {
			seq = *sequence
		}
		r.MppSessionRef = &MppSessionRef{SessionID: *sessID, Sequence: seq}
	}
	return r, nil
}

func (s *pgReceipts) List(f ReceiptFilter) ([]Receipt, error) {
	where, args := receiptWhere(f)
	q := `SELECT ` + receiptColumns + ` FROM receipts` + where + ` ORDER BY issued_at DESC`
	q += limitOffset(&args, f.Limit, f.Offset)
	rows, err := s.pool.Query(context.Background(), q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Receipt{}
	for rows.Next() {
		r, err := scanReceipt(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func (s *pgReceipts) Count(f ReceiptFilter) (int, error) {
	where, args := receiptWhere(f)
	var n int
	err := s.pool.QueryRow(context.Background(), `SELECT COUNT(*) FROM receipts`+where, args...).Scan(&n)
	return n, err
}

func (s *pgReceipts) GetByNonce(nonce string) (*Receipt, error) {
	row := s.pool.QueryRow(context.Background(), `SELECT `+receiptColumns+` FROM receipts WHERE nonce=$1`, nonce)
	r, err := scanReceipt(row)
	return optionalReceipt(r, err)
}

func receiptWhere(f ReceiptFilter) (string, []any) {
	var clauses []string
	var args []any
	add := func(col string, val any) {
		args = append(args, val)
		clauses = append(clauses, fmt.Sprintf("%s = $%d", col, len(args)))
	}
	cmp := func(col, op string, val any) {
		args = append(args, val)
		clauses = append(clauses, fmt.Sprintf("%s %s $%d", col, op, len(args)))
	}
	if f.PublisherID != "" {
		add("publisher_id", f.PublisherID)
	}
	if f.From != "" {
		add("from_wallet", f.From)
	}
	if f.To != "" {
		add("to_wallet", f.To)
	}
	if f.FromTimestamp != "" {
		cmp("issued_at", ">=", f.FromTimestamp)
	}
	if f.ToTimestamp != "" {
		cmp("issued_at", "<=", f.ToTimestamp)
	}
	return whereClause(clauses), args
}

// ── small SQL helpers ────────────────────────────────────────────

func whereClause(clauses []string) string {
	if len(clauses) == 0 {
		return ""
	}
	out := " WHERE "
	for i, c := range clauses {
		if i > 0 {
			out += " AND "
		}
		out += c
	}
	return out
}

func limitOffset(args *[]any, limit, offset int) string {
	out := ""
	if limit > 0 {
		*args = append(*args, limit)
		out += fmt.Sprintf(" LIMIT $%d", len(*args))
	}
	if offset > 0 {
		*args = append(*args, offset)
		out += fmt.Sprintf(" OFFSET $%d", len(*args))
	}
	return out
}

func optional(p Publisher, err error) (*Publisher, error) {
	if err != nil {
		if isNoRows(err) {
			return nil, nil
		}
		return nil, err
	}
	return &p, nil
}

func optionalReceipt(r Receipt, err error) (*Receipt, error) {
	if err != nil {
		if isNoRows(err) {
			return nil, nil
		}
		return nil, err
	}
	return &r, nil
}

func isNoRows(err error) bool {
	return errors.Is(err, pgx.ErrNoRows)
}
