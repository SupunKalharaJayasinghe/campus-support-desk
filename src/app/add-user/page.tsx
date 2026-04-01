'use client';

import Link from 'next/link';
import { useState } from 'react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Container from '@/components/ui/Container';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';

type UserRole =
  | 'ADMIN'
  | 'LECTURER'
  | 'LAB_ASSISTANT'
  | 'STUDENT'
  | 'COMMUNITY_ADMIN';

interface FormState {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: UserRole | '';
  status: 'ACTIVE' | 'INACTIVE';
  mustChangePassword: boolean;
}

const initialState: FormState = {
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
  role: '',
  status: 'ACTIVE',
  mustChangePassword: true,
};

export default function AddUserPage() {
  const [form, setForm] = useState<FormState>(initialState);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverMessage, setServerMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );
  const [submitting, setSubmitting] = useState(false);

  function setValue<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((previous) => ({ ...previous, [key]: value }));
    setServerMessage(null);
  }

  function validate() {
    const nextErrors: Record<string, string> = {};
    if (!form.username.trim()) nextErrors.username = 'Username is required.';
    if (!form.email.trim()) nextErrors.email = 'Email is required.';
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) {
      nextErrors.email = 'Enter a valid email address.';
    }
    if (!form.password) nextErrors.password = 'Password is required.';
    if (form.password.length > 0 && form.password.length < 8) {
      nextErrors.password = 'Use at least 8 characters.';
    }
    if (form.password !== form.confirmPassword) {
      nextErrors.confirmPassword = 'Passwords do not match.';
    }
    if (!form.role) nextErrors.role = 'Role is required.';
    return nextErrors;
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setSubmitting(true);
    setServerMessage(null);

    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: form.username.trim(),
          email: form.email.trim(),
          password: form.password,
          role: form.role,
          status: form.status,
          mustChangePassword: form.mustChangePassword,
        }),
      });

      const data = (await response.json().catch(() => null)) as { message?: string } | null;
      const message = data?.message ?? (response.ok ? 'User created.' : 'Request failed.');

      if (!response.ok) {
        setServerMessage({ type: 'err', text: message });
        return;
      }

      setServerMessage({ type: 'ok', text: 'User account created successfully.' });
      setForm(initialState);
      setErrors({});
    } catch {
      setServerMessage({ type: 'err', text: 'Network error. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg py-16">
      <Container size="6xl">
        <div className="mx-auto max-w-2xl">
          <Card className="p-8 md:p-10">
            <h1 className="text-3xl font-semibold text-heading">Add user</h1>
            <p className="mt-3 text-sm text-text/78">
              Create a portal login aligned with your user directory (username, email, role, and
              password).
            </p>

            {serverMessage ? (
              <div
                className={
                  serverMessage.type === 'ok'
                    ? 'mt-5 rounded-2xl border border-primary/35 bg-primary/10 px-4 py-3 text-sm text-text'
                    : 'mt-5 rounded-2xl border border-primaryHover/40 bg-primaryHover/10 px-4 py-3 text-sm text-primaryHover'
                }
              >
                {serverMessage.text}
              </div>
            ) : null}

            {Object.keys(errors).length > 0 ? (
              <p className="mt-5 text-sm text-primaryHover">Fix the highlighted fields below.</p>
            ) : null}

            <form className="mt-8 space-y-5" noValidate onSubmit={onSubmit}>
              <div>
                <label className="mb-2 block text-sm font-medium text-heading" htmlFor="username">
                  Username
                </label>
                <Input
                  id="username"
                  autoComplete="username"
                  onChange={(event) => setValue('username', event.target.value)}
                  placeholder="Unique login name"
                  value={form.username}
                />
                {errors.username ? (
                  <p className="mt-1 text-xs text-primaryHover">{errors.username}</p>
                ) : null}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-heading" htmlFor="email">
                  Email
                </label>
                <Input
                  id="email"
                  autoComplete="email"
                  onChange={(event) => setValue('email', event.target.value)}
                  placeholder="name@university.edu"
                  type="email"
                  value={form.email}
                />
                {errors.email ? <p className="mt-1 text-xs text-primaryHover">{errors.email}</p> : null}
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-heading" htmlFor="password">
                    Password
                  </label>
                  <Input
                    id="password"
                    autoComplete="new-password"
                    onChange={(event) => setValue('password', event.target.value)}
                    type="password"
                    value={form.password}
                  />
                  {errors.password ? (
                    <p className="mt-1 text-xs text-primaryHover">{errors.password}</p>
                  ) : null}
                </div>
                <div>
                  <label
                    className="mb-2 block text-sm font-medium text-heading"
                    htmlFor="confirmPassword"
                  >
                    Confirm password
                  </label>
                  <Input
                    id="confirmPassword"
                    autoComplete="new-password"
                    onChange={(event) => setValue('confirmPassword', event.target.value)}
                    type="password"
                    value={form.confirmPassword}
                  />
                  {errors.confirmPassword ? (
                    <p className="mt-1 text-xs text-primaryHover">{errors.confirmPassword}</p>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-heading" htmlFor="role">
                    Role
                  </label>
                  <Select
                    id="role"
                    onChange={(event) =>
                      setValue('role', event.target.value as FormState['role'])
                    }
                    value={form.role}
                  >
                    <option value="">Select role</option>
                    <option value="STUDENT">Student</option>
                    <option value="LECTURER">Lecturer</option>
                    <option value="LAB_ASSISTANT">Lab assistant</option>
                    <option value="ADMIN">Administrator</option>
                    <option value="COMMUNITY_ADMIN">Community admin</option>
                  </Select>
                  {errors.role ? <p className="mt-1 text-xs text-primaryHover">{errors.role}</p> : null}
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-heading" htmlFor="status">
                    Account status
                  </label>
                  <Select
                    id="status"
                    onChange={(event) =>
                      setValue('status', event.target.value as 'ACTIVE' | 'INACTIVE')
                    }
                    value={form.status}
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </Select>
                </div>
              </div>

              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm text-text">
                <input
                  checked={form.mustChangePassword}
                  className="h-4 w-4 accent-primary"
                  onChange={(event) => setValue('mustChangePassword', event.target.checked)}
                  type="checkbox"
                />
                Require password change on first login
              </label>

              <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                <button
                  className="rounded-2xl border-none bg-[#034AA6] px-6 py-2.5 text-sm font-semibold text-[#D9D9D9] transition-all duration-200 hover:bg-[#0339A6] hover:shadow-shadowHover disabled:cursor-not-allowed disabled:opacity-60 sm:min-w-36"
                  disabled={submitting}
                  type="submit"
                >
                  {submitting ? 'Saving…' : 'Save'}
                </button>
                <Link href="/">
                  <Button type="button" variant="secondary">
                    Back to home
                  </Button>
                </Link>
              </div>
            </form>
          </Card>
        </div>
      </Container>
    </div>
  );
}
