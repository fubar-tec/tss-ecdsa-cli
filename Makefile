# TSS CLI Makefile
# ==================

SHELL := /bin/bash
export LIBRARY_PATH := /opt/homebrew/opt/gmp/lib:$(LIBRARY_PATH)

BIN := ./target/release/tss_cli
MANAGER_ADDR := http://127.0.0.1:8001
TEST_MESSAGE := 1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef

.PHONY: all build clean manager keygen sign pubkey test help

# =============================================================================
# BUILD
# =============================================================================

all: build

build:
	@echo "Building TSS CLI..."
	@cargo build --release
	@echo "Build complete: $(BIN)"

clean:
	@cargo clean
	@rm -f keys*.store .manager.pid
	@echo "Cleaned."

clean-keys:
	@rm -f keys*.store
	@echo "Key files removed."

# =============================================================================
# MANAGER
# =============================================================================

manager:
	@echo "Starting manager on port 8001..."
	$(BIN) manager

# =============================================================================
# KEYGEN (2-of-2: both parties required)
# =============================================================================

keygen: clean-keys
	@echo "Keygen 2-of-2 (both parties required to sign)"
	@echo "Manager must be running: make manager"
	@echo ""
	$(BIN) keygen keys1.store 1/2 -a $(MANAGER_ADDR) &
	@sleep 2
	$(BIN) keygen keys2.store 1/2 -a $(MANAGER_ADDR)
	@echo ""
	@echo "Done. Key files:"
	@ls -la keys*.store 2>/dev/null || true

# =============================================================================
# SIGN (requires both parties)
# =============================================================================

sign:
	@echo "Sign with both parties"
	@echo "Message: $(TEST_MESSAGE)"
	@echo ""
	$(BIN) sign keys1.store 1/2 $(TEST_MESSAGE) -a $(MANAGER_ADDR) &
	@sleep 2
	$(BIN) sign keys2.store 1/2 $(TEST_MESSAGE) -a $(MANAGER_ADDR)

sign-custom:
	@if [ -z "$(MSG)" ]; then echo "Usage: make sign-custom MSG=<hex>"; exit 1; fi
	$(BIN) sign keys1.store 1/2 $(MSG) -a $(MANAGER_ADDR) &
	@sleep 2
	$(BIN) sign keys2.store 1/2 $(MSG) -a $(MANAGER_ADDR)

# =============================================================================
# PUBKEY
# =============================================================================

pubkey:
	$(BIN) pubkey keys1.store

pubkey-path:
	@if [ -z "$(P)" ]; then echo "Usage: make pubkey-path P=0/1/2"; exit 1; fi
	$(BIN) pubkey keys1.store -p $(P)

# =============================================================================
# SAFETY CHECK
# =============================================================================

safety-check:
	@for f in keys*.store; do echo "Checking $$f..."; $(BIN) safety_check $$f || true; done

verify-keys:
	@PK1=$$($(BIN) pubkey keys1.store 2>/dev/null) && \
	PK2=$$($(BIN) pubkey keys2.store 2>/dev/null) && \
	if [ "$$PK1" = "$$PK2" ]; then \
		echo "OK: Public keys match"; \
		X=$$(echo "$$PK1" | sed 's/.*"x":"\([^"]*\)".*/\1/') && \
		Y=$$(echo "$$PK1" | sed 's/.*"y":"\([^"]*\)".*/\1/') && \
		echo "x: $$X" && \
		echo "y: $$Y" && \
		echo "Uncompressed: 04$$X$$Y"; \
	else \
		echo "ERROR: Public keys do not match!"; \
		echo "keys1: $$PK1"; \
		echo "keys2: $$PK2"; \
		exit 1; \
	fi

# =============================================================================
# FULL TEST
# =============================================================================

test: build
	@echo "=== Full TSS Test (2-of-2) ==="
	@$(BIN) manager & echo $$! > .manager.pid
	@sleep 2
	@$(MAKE) keygen
	@sleep 1
	@echo ""
	@echo "=== Verify Keys ==="
	@$(MAKE) verify-keys
	@echo ""
	@echo "=== Sign ==="
	@$(MAKE) sign
	@echo ""
	@kill `cat .manager.pid` 2>/dev/null || true
	@rm -f .manager.pid
	@echo "=== Test Complete ==="

# =============================================================================
# HELP
# =============================================================================

help:
	@echo "TSS CLI - 2-of-2 Threshold Signature"
	@echo ""
	@echo "Setup:"
	@echo "  make build        Build project"
	@echo "  make clean        Clean all"
	@echo ""
	@echo "Usage (separate terminals):"
	@echo "  make manager      Start manager (Terminal 1)"
	@echo "  make keygen       Generate 2 key shares (Terminal 2)"
	@echo "  make sign         Sign with both parties"
	@echo "  make pubkey       Get public key"
	@echo ""
	@echo "Automated:"
	@echo "  make test         Run full test automatically"
	@echo "  make verify-keys  Verify both keys have same public key"
	@echo ""
	@echo "Custom:"
	@echo "  make sign-custom MSG=<hex>   Sign custom message"
	@echo "  make pubkey-path P=0/1/2     Derived public key"
