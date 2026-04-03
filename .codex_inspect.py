from pathlib import Path
import sys


def main() -> None:
    path = Path(sys.argv[1])
    start = int(sys.argv[2]) if len(sys.argv) > 2 else 1
    end = int(sys.argv[3]) if len(sys.argv) > 3 else None
    lines = path.read_text(encoding="utf-8").splitlines()
    if end is None:
      end = len(lines)
    for idx in range(max(1, start), min(end, len(lines)) + 1):
        print(f"{idx}: {lines[idx - 1]}")


if __name__ == "__main__":
    main()
