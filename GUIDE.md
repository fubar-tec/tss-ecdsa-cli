# TSS CLI Quick Start

2-of-2 threshold ECDSA signatures. Both parties required to sign.

## Requirements

```bash
# macOS
brew install gmp
export LIBRARY_PATH="/opt/homebrew/opt/gmp/lib:$LIBRARY_PATH"

# Rust nightly
rustup default nightly
```

## Build

```bash
make build
```

## Quick Test

```bash
make test
```

## Manual Usage

**Terminal 1 - Manager:**
```bash
make manager
```

**Terminal 2 - Keygen (once):**
```bash
make keygen
```

**Terminal 2 - Sign:**
```bash
make sign
```

## Commands

| Command | Description |
|---------|-------------|
| `make manager` | Start coordinator server |
| `make keygen` | Generate key shares (keys1.store, keys2.store) |
| `make sign` | Sign test message with both parties |
| `make pubkey` | Get public key |
| `make test` | Run automated full test |
| `make clean` | Remove build artifacts and keys |

## Custom Message

```bash
make sign-custom MSG=<32-byte-hex>
```

## Derived Keys (BIP32)

```bash
make pubkey-path P=0/1/2
```

## Output

**Public Key:**
```json
{"x":"...","y":"..."}
```

**Signature:**
```json
{"r":"...","s":"...","recid":0,"status":"signature_ready"}
```
