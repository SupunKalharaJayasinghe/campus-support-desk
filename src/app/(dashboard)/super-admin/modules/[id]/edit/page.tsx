"use client";

import { useRouter, useParams } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

interface DegreeProgram {
  id: string;
  name: string;
}

interface ModuleFormData {
  code: string;
  name: string;
  credits: number;
  selectedDegrees: string[];
  selectedYear: string;
  description: string;
  status: string;
}

const degreePrograms: DegreeProgram[] = [
  { id: "D-01", name: "BSc Computer Science" },
  { id: "D-02", name: "BSc Information Systems" },
  { id: "D-03", name: "BSc Software Engineering" },
  { id: "D-04", name: "BSc Information Technology" }
];

const yearOptions = [
  "Y1S1", "Y1S2",
  "Y2S1", "Y2S2",
  "Y3S1", "Y3S2",
  "Y4S1", "Y4S2"
];

export default function EditModulePage() {
  const router = useRouter();
  const params = useParams();
  const moduleId = params.id as string;
  
  const [formData, setFormData] = useState<ModuleFormData>({
    code: "CS101",
    name: "Introduction to Programming",
    credits: 3,
    selectedDegrees: ["D-01", "D-02"],
    selectedYear: "Y1S1",
    description: "Basic programming concepts",
    status: "Active"
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === "credits" ? parseInt(value) : value
    }));
  };

  const handleDegreeToggle = (degreeId: string) => {
    setFormData(prev => ({
      ...prev,
      selectedDegrees: prev.selectedDegrees.includes(degreeId)
        ? prev.selectedDegrees.filter(d => d !== degreeId)
        : [...prev.selectedDegrees, degreeId]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      console.log("Updating module:", moduleId, formData);
      // API call to update module
      // await updateModule(moduleId, formData);
      router.push("/super-admin/modules");
    } catch (error) {
      console.error("Error updating module:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit Module"
        description="Update module details and degree/year assignments."
        showBreadcrumbs
        backHref="/super-admin/modules"
      />
      
      <Card title="Module Information">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Module Code *
              </label>
              <input
                type="text"
                name="code"
                value={formData.code}
                onChange={handleInputChange}
                placeholder="e.g., CS101"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Credits *
              </label>
              <input
                type="number"
                name="credits"
                value={formData.credits}
                onChange={handleInputChange}
                min="1"
                max="4"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Module Name *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="e.g., Introduction to Programming"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Module description..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500"
            />
          </div>

          {/* Degree Assignment */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-4">
              Assign to Degrees (Select Multiple) *
            </label>
            <div className="space-y-3 border border-gray-200 p-4 rounded-md bg-gray-50">
              {degreePrograms.map(degree => (
                <div key={degree.id} className="flex items-center">
                  <input
                    type="checkbox"
                    id={`degree-${degree.id}`}
                    checked={formData.selectedDegrees.includes(degree.id)}
                    onChange={() => handleDegreeToggle(degree.id)}
                    className="h-4 w-4 text-blue-600 rounded"
                  />
                  <label htmlFor={`degree-${degree.id}`} className="ml-3 text-sm text-gray-700">
                    {degree.name}
                  </label>
                </div>
              ))}
            </div>
            {formData.selectedDegrees.length === 0 && (
              <p className="text-sm text-red-500 mt-2">Please select at least one degree</p>
            )}
          </div>

          {/* Year/Semester Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Academic Year/Semester *
            </label>
            <select
              name="selectedYear"
              value={formData.selectedYear}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500"
            >
              {yearOptions.map(year => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-2">
              Y = Year, S = Semester (e.g., Y1S1 = Year 1, Semester 1)
            </p>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              name="status"
              value={formData.status}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500"
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Archived">Archived</option>
            </select>
          </div>

          {/* Buttons */}
          <div className="flex gap-4 justify-end pt-6 border-t">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || formData.selectedDegrees.length === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? "Updating..." : "Update Module"}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
