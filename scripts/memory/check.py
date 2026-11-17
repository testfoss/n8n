#!/usr/bin/env python3
"""Check repository-specific durable-memory policy."""
from pathlib import Path
import sys


def pictographic(codepoint):
    return (
        0x1F000 <= codepoint <= 0x1FAFF
        or 0x2600 <= codepoint <= 0x27BF
        or codepoint
        in (0x2B1B, 0x2B1C, 0x2B50, 0x2B55, 0x231A, 0x231B, 0xFE0F, 0x20E3)
        or 0x23E9 <= codepoint <= 0x23F3
        or 0x23F8 <= codepoint <= 0x23FA
        or 0xE0020 <= codepoint <= 0xE007F
    )


def check(root):
    findings = []
    for path in sorted(root.rglob("*")):
        if not path.is_file():
            continue
        if path.suffix.lower() in (".html", ".htm"):
            findings.append(f"{path}: author Markdown instead of HTML")
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            if path.suffix == ".md":
                findings.append(f"{path}: Markdown must be UTF-8")
            continue
        for number, line in enumerate(text.splitlines(), 1):
            for char in line:
                if pictographic(ord(char)):
                    findings.append(f"{path}:{number}: emoji U+{ord(char):04X}; use words")
    for finding in findings:
        print(finding, file=sys.stderr)
    return bool(findings)


if __name__ == "__main__":
    raise SystemExit(check(Path(sys.argv[1])))
