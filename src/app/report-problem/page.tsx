'use client';

import Link from 'next/link';
import { useState } from 'react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Container from '@/components/ui/Container';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Textarea from '@/components/ui/Textarea';

interface FormState {
  role: string;
  fullName: string;
  email: string;
  category: string;
  subject: string;
  description: string;
  priority: 'Low' | 'Medium' | 'High';
}

const initialState: FormState = {
  role: '',
  fullName: '',
  email: '',
  category: 'Technical',
  subject: '',
  description: '',
  priority: 'Medium',
};

export default function ReportProblemPage() {
  const [form, setForm] = useState<FormState>(initialState);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  function setValue<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((previous) => ({ ...previous, [key]: value }));
    setSubmitted(false);
  }

  function validate() {
    const nextErrors: Record<string, string> = {};
    if (!form.role) nextErrors.role = 'Role is required.';
    if (!form.fullName.trim()) nextErrors.fullName = 'Full Name is required.';
    if (!form.email.trim()) nextErrors.email = 'Email is required.';
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) {
      nextErrors.email = 'Enter a valid email address.';
    }
    if (!form.subject.trim()) nextErrors.subject = 'Subject is required.';
    if (!form.description.trim()) nextErrors.description = 'Description is required.';
    return nextErrors;
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setSubmitted(false);
      return;
    }
    setSubmitted(true);
  }

  return (
    <div className="min-h-screen bg-bg py-16">
      <Container size="6xl">
        <div className="mx-auto max-w-4xl">
          <Card className="p-8 md:p-10">
            <h1 className="text-3xl font-semibold text-heading">Report a Problem</h1>
            <p className="mt-3 text-sm text-text/78">
              Submit your issue details for Administrator review and assistance.
            </p>

            {submitted ? (
              <div className="mt-5 rounded-2xl border border-primary/35 bg-primary/10 px-4 py-3 text-sm text-text">
                Report submitted successfully. The Administrator will review your request.
              </div>
            ) : null}

            {Object.keys(errors).length > 0 ? (
              <p className="mt-5 text-sm text-primaryHover">
                Please complete all required fields correctly.
              </p>
            ) : null}

            <form className="mt-8 space-y-5" noValidate onSubmit={onSubmit}>
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-heading" htmlFor="role">
                    Role
                  </label>
                  <Select
                    id="role"
                    onChange={(event) => setValue('role', event.target.value)}
                    required
                    value={form.role}
                  >
                    <option value="">Select Role</option>
                    <option value="Student">Student</option>
                    <option value="Lecturer">Lecturer</option>
                    <option value="Lost Item Officer">Lost Item Officer</option>
                  </Select>
                  {errors.role ? <p className="mt-1 text-xs text-primaryHover">{errors.role}</p> : null}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-heading" htmlFor="fullName">
                    Full Name
                  </label>
                  <Input
                    id="fullName"
                    onChange={(event) => setValue('fullName', event.target.value)}
                    placeholder="Enter your full name"
                    required
                    value={form.fullName}
                  />
                  {errors.fullName ? <p className="mt-1 text-xs text-primaryHover">{errors.fullName}</p> : null}
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-heading" htmlFor="email">
                    Email
                  </label>
                  <Input
                    id="email"
                    onChange={(event) => setValue('email', event.target.value)}
                    placeholder="name@university.edu"
                    required
                    type="email"
                    value={form.email}
                  />
                  {errors.email ? <p className="mt-1 text-xs text-primaryHover">{errors.email}</p> : null}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-heading" htmlFor="category">
                    Category
                  </label>
                  <Select
                    id="category"
                    onChange={(event) => setValue('category', event.target.value)}
                    value={form.category}
                  >
                    <option value="Technical">Technical</option>
                    <option value="Academic">Academic</option>
                    <option value="Booking">Booking</option>
                    <option value="Lost Item">Lost Item</option>
                    <option value="Other">Other</option>
                  </Select>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-heading" htmlFor="subject">
                  Subject
                </label>
                <Input
                  id="subject"
                  onChange={(event) => setValue('subject', event.target.value)}
                  placeholder="Brief subject"
                  required
                  value={form.subject}
                />
                {errors.subject ? <p className="mt-1 text-xs text-primaryHover">{errors.subject}</p> : null}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-heading" htmlFor="description">
                  Description
                </label>
                <Textarea
                  id="description"
                  onChange={(event) => setValue('description', event.target.value)}
                  placeholder="Describe the issue in detail"
                  required
                  value={form.description}
                />
                {errors.description ? <p className="mt-1 text-xs text-primaryHover">{errors.description}</p> : null}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-heading" htmlFor="attachment">
                  Optional Attachment
                </label>
                <input
                  className="w-full rounded-[16px] border border-border bg-card px-3.5 py-2.5 text-sm text-text file:mr-3 file:rounded-xl file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-primary"
                  id="attachment"
                  type="file"
                />
              </div>

              <fieldset>
                <legend className="mb-2 block text-sm font-medium text-heading">Priority</legend>
                <div className="flex flex-wrap gap-3">
                  {(['Low', 'Medium', 'High'] as const).map((level) => (
                    <label
                      className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm text-text"
                      key={level}
                    >
                      <input
                        checked={form.priority === level}
                        className="h-4 w-4 accent-primary"
                        name="priority"
                        onChange={() => setValue('priority', level)}
                        type="radio"
                      />
                      {level}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                <button
                  className="rounded-2xl border-none bg-[#034AA6] px-6 py-2.5 text-sm font-semibold text-[#D9D9D9] transition-all duration-200 hover:bg-[#0339A6] hover:shadow-shadowHover"
                  type="submit"
                >
                  Submit Report
                </button>
                <Link href="/">
                  <Button variant="secondary">Back to Home</Button>
                </Link>
              </div>
            </form>
          </Card>
        </div>
      </Container>
    </div>
  );
}
