"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import { adminModulesSeed } from "@/lib/mockData";
import type { ModuleNode } from "@/lib/mockData";

export default function AdminModulesPage() {
  const [rows, setRows] = useState<ModuleNode[]>(adminModulesSeed);
  const [degree, setDegree] = useState("");
  const [moduleName, setModuleName] = useState("");
  const [batch, setBatch] = useState("");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-text">Modules</h1>
        <p className="text-sm text-mutedText">Manage degree, module, and batch structures.</p>
      </div>

      <Card title="Add module mapping">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_120px_auto]">
          <Input onChange={(e) => setDegree(e.target.value)} placeholder="Degree" value={degree} />
          <Input onChange={(e) => setModuleName(e.target.value)} placeholder="Module" value={moduleName} />
          <Input onChange={(e) => setBatch(e.target.value)} placeholder="Batch" value={batch} />
          <Button
            onClick={() => {
              if (!degree.trim() || !moduleName.trim() || !batch.trim()) {
                return;
              }
              setRows((prev) => [
                { id: `m-${Date.now()}`, degree: degree.trim(), module: moduleName.trim(), batch: batch.trim() },
                ...prev,
              ]);
              setDegree("");
              setModuleName("");
              setBatch("");
            }}
          >
            Add
          </Button>
        </div>
      </Card>

      <Card title="Current structure">
        <div className="space-y-2">
          {rows.map((row) => (
            <div className="flex items-center justify-between rounded-xl bg-surface2 px-3 py-2" key={row.id}>
              <p className="text-sm text-mutedText">
                {row.degree} • {row.module} • Batch {row.batch}
              </p>
              <Button onClick={() => setRows((prev) => prev.filter((item) => item.id !== row.id))} variant="ghost">
                Remove
              </Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
