import os

BASE_DIR = os.path.join("src", "components", "features")

def component_name_from_file(filename: str) -> str:
    return os.path.splitext(filename)[0]

for root, _, files in os.walk(BASE_DIR):
    for file in files:
        if not file.endswith(".tsx"):
            continue
        path = os.path.join(root, file)
        if os.path.getsize(path) > 0:
            continue
        name = component_name_from_file(file)
        content = f""""use client";

import {{ Card }} from "@/components/ui/Card";

export function {name}() {{
  return (
    <Card title="{name}">
      <p className="text-sm text-slate-600">Placeholder component for {name}.</p>
    </Card>
  );
}}
"""
        with open(path, "w", encoding="utf-8") as handle:
            handle.write(content)

print("Filled empty feature components.")
