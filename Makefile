# Grug Makefile — only the checks that matter

.PHONY: size check build zip

# Adjust ODIN path if needed
ODIN ?= odin

build:
	$(ODIN) build src -target:js_wasm32 -out:game.wasm -o:size -no-entry-point

# Produce the submission zip and enforce the hard limit
zip: build
	@rm -f game.zip
	@zip -9 -j game.zip index.html game.js game.wasm odin.js 2>/dev/null || true
	@echo "=== size check ==="
	@ls -l game.zip
	@SIZE=$$(stat -c%s game.zip 2>/dev/null || stat -f%z game.zip); \
	if [ $$SIZE -gt 13312 ]; then \
		echo "FAIL: $$SIZE > 13312"; exit 1; \
	else \
		echo "OK: $$SIZE <= 13312"; \
	fi

size: zip

check:
	@test -f index.html || (echo "missing index.html"; exit 1)
	@test -f game.js || (echo "missing game.js"; exit 1)
	@grep -q "http" index.html game.js && echo "WARN: possible external URL" || true
	@echo "basic file check passed"
