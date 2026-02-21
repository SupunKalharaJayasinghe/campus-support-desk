import os

BASE_DIR = os.path.join("src", "app")

def needs_client(content: str) -> bool:
    return "DataTable" in content or "rowActions" in content

def has_use_client(content: str) -> bool:
    stripped = content.lstrip()
    return stripped.startswith("\"use client\"") or stripped.startswith("'use client'")

for root, _, files in os.walk(BASE_DIR):
    for file in files:
        if not file.endswith(".tsx"):
            continue
        path = os.path.join(root, file)
        with open(path, "r", encoding="utf-8") as handle:
            content = handle.read()
        if not needs_client(content):
            continue
        if has_use_client(content):
            continue
        updated = "\"use client\";\n\n" + content
        with open(path, "w", encoding="utf-8") as handle:
            handle.write(updated)

print("Marked DataTable pages as client components.")
