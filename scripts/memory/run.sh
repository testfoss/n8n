#!/usr/bin/env bash
# Run durable-memory checks with a checksum-pinned lmhtml release.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
cd "$ROOT"
(($# >= 2)) || { echo 'usage: run.sh check DIR | index DIR [--check]' >&2; exit 2; }
mode=$1
dir=$2
shift 2

sha256() {
	if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1"; else shasum -a 256 "$1"; fi | cut -c1-64
}

pinned_lmhtml() {
	local lock="$HERE/lmhtml.lock" version os arch asset want cache url got
	version=$(sed -n 's/^version=//p' "$lock")
	case "$(uname -s)" in
		Linux) os=linux ;;
		Darwin) os=macos ;;
		MINGW*|MSYS*|CYGWIN*) os=windows ;;
		*) echo "no lmhtml release for $(uname -s)" >&2; return 2 ;;
	esac
	case "$(uname -m)" in
		x86_64|amd64) arch=x64 ;;
		aarch64|arm64) arch=arm64 ;;
		*) echo "no lmhtml release for $(uname -m)" >&2; return 2 ;;
	esac
	asset="lmhtml-$os-$arch"
	[[ $os != windows ]] || asset="$asset.exe"
	want=$(sed -n "s/^sha256\.$asset=//p" "$lock")
	[[ -n $want ]] || { echo "lmhtml.lock pins no $asset" >&2; return 2; }
	cache="$ROOT/.build/memory-tools/lmhtml/$version"
	if [[ ! -x $cache/$asset ]] || [[ $(sha256 "$cache/$asset") != "$want" ]]; then
		mkdir -p "$cache"
		url="https://github.com/lmctl-ai/lmhtml/releases/download/$version/$asset"
		curl -fsSL --retry 3 -o "$cache/$asset.part" "$url" || { echo "download failed: $url" >&2; return 2; }
		got=$(sha256 "$cache/$asset.part")
		[[ $got == "$want" ]] || { rm -f "$cache/$asset.part"; echo "$asset sha256 $got does not match lmhtml.lock" >&2; return 2; }
		chmod +x "$cache/$asset.part"
		mv "$cache/$asset.part" "$cache/$asset"
	fi
	printf '%s\n' "$cache/$asset"
}

host=${LMHTML:-}
if [[ -z $host ]]; then
	if command -v lmhtml >/dev/null 2>&1; then host=$(command -v lmhtml); else host=$(pinned_lmhtml); fi
fi
[[ -x $host ]] || { echo "lmhtml is not executable: $host" >&2; exit 2; }

case "$mode" in
	index)
		"$host" index "$dir" "$@"
		;;
	check)
		(($# == 0)) || exit 2
		"$host" index "$dir" --check
		"$host" mdcheck "$dir"
		python3 "$HERE/check.py" "$dir"
		"$host" lint --stats "$dir"
		;;
	*) echo "unknown memory command: $mode" >&2; exit 2 ;;
esac
echo "$mode: OK"
