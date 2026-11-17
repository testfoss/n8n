#!/usr/bin/env bash
# Run real n8n workflows against checksum-pinned lmmock fixtures.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
cd "$ROOT"
lock="$HERE/lmmock.lock"
version=$(sed -n 's/^version=//p' "$lock")
compiler=$(sed -n 's/^compiler=//p' "$lock")

case "$(uname -s)" in
	Linux) os=linux ;;
	Darwin) os=macos ;;
	*) echo "The lmmock workflow runner supports Linux and macOS" >&2; exit 2 ;;
esac
case "$(uname -m)" in
	x86_64|amd64) arch=x64 ;;
	aarch64|arm64) arch=arm64 ;;
	*) echo "No lmmock release for $(uname -m)" >&2; exit 2 ;;
esac
asset="lmmock-$os-$arch"
cache=${LMMOCK_CACHE:-$ROOT/.build/lmmock/$version-lmctl-$compiler}
mkdir -p "$cache/bin"

sha256() {
	if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1"; else shasum -a 256 "$1"; fi | cut -c1-64
}

download() {
	local name=$1 want url got
	want=$(sed -n "s/^sha256\.$name=//p" "$lock")
	[[ -n $want ]] || { echo "lmmock.lock pins no $name" >&2; return 2; }
	if [[ ! -f $cache/$name ]] || [[ $(sha256 "$cache/$name") != "$want" ]]; then
		url="https://github.com/lmctl-ai/lmmock/releases/download/$version/$name"
		curl -fsSL --retry 3 -o "$cache/$name.part" "$url"
		got=$(sha256 "$cache/$name.part")
		[[ $got == "$want" ]] || { rm -f "$cache/$name.part"; echo "$name sha256 $got does not match lmmock.lock" >&2; return 2; }
		mv "$cache/$name.part" "$cache/$name"
	fi
}

download SHA256SUMS
download examples.tar.gz
download "$asset"
install -m 0755 "$cache/$asset" "$cache/bin/lmmock"
tar -xzf "$cache/examples.tar.gz" -C "$cache"

compiler_dir="$cache/compiler"
if [[ ! -x $compiler_dir/node_modules/.bin/lmscript ]]; then
	mkdir -p "$compiler_dir"
	pnpm --dir "$compiler_dir" add --ignore-workspace --save-exact --store-dir "$cache/pnpm-store" "@lmctl-ai/lmctl@$compiler"
fi
actual_compiler=$("$compiler_dir/node_modules/.bin/lmscript" --version)
[[ $actual_compiler == "lmscript $compiler" ]] || { echo "Unexpected compiler: $actual_compiler" >&2; exit 2; }

export PATH="$cache/bin:$compiler_dir/node_modules/.bin:$PATH"
export NO_PROXY="${NO_PROXY:+$NO_PROXY,}127.0.0.1,localhost"
export no_proxy="${no_proxy:+$no_proxy,}127.0.0.1,localhost"

lmmock --version
lmscript "$cache/examples/telegram.lms" \
	pnpm --dir "$ROOT/packages/nodes-base" exec vitest run \
	nodes/Telegram/tests/Workflow/lmmock.workflow.test.ts --maxWorkers=1

lmmock exec --builtin llm-api --config "$cache/examples/llm-config-coding-cli.json" -- \
	pnpm --dir "$ROOT/packages/@n8n/nodes-langchain" exec vitest run \
	nodes/agents/Agent/test/integration/agent-lmmock.workflow.test.ts --maxWorkers=1
