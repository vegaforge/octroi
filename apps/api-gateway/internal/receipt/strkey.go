package receipt

import (
	"encoding/base32"
	"errors"
)

// versionByteAccountID is the StrKey version byte for an Ed25519 account ('G').
const versionByteAccountID = 6 << 3

var base32NoPad = base32.StdEncoding.WithPadding(base32.NoPadding)

// decodeAccountID decodes a Stellar G-address into its 32-byte Ed25519 public
// key, validating the version byte and CRC16 checksum.
func decodeAccountID(addr string) ([]byte, error) {
	if len(addr) != 56 || addr[0] != 'G' {
		return nil, errors.New("not a Stellar G-address")
	}
	raw, err := base32NoPad.DecodeString(addr)
	if err != nil {
		return nil, err
	}
	if len(raw) != 35 {
		return nil, errors.New("unexpected strkey length")
	}
	if raw[0] != versionByteAccountID {
		return nil, errors.New("wrong strkey version byte")
	}
	payload := raw[:33] // version byte + 32-byte key
	want := uint16(raw[33]) | uint16(raw[34])<<8
	if crc16xmodem(payload) != want {
		return nil, errors.New("strkey checksum mismatch")
	}
	return raw[1:33], nil
}

// crc16xmodem is the CRC16-XModem checksum Stellar appends to a strkey.
func crc16xmodem(data []byte) uint16 {
	var crc uint16
	for _, b := range data {
		crc ^= uint16(b) << 8
		for i := 0; i < 8; i++ {
			if crc&0x8000 != 0 {
				crc = (crc << 1) ^ 0x1021
			} else {
				crc <<= 1
			}
		}
	}
	return crc
}
