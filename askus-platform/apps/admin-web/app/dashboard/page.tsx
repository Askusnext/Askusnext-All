'use client';

import { useAuth } from '@askus/authentication';
import { Button, Card } from '@askus/ui-components';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { api } from '../../lib/api';

export default function DashboardPage() {
  const router = useRouter();
  const { tokens, ready, signOut } = useAuth();

  useEffect(() => {
    if (ready && !tokens) router.replace('/login');
  }, [ready, tokens, router]);

  const summary = useQuery({ queryKey: ['summary'], queryFn: api.reporting.summary, enabled: !!tokens });
  const users = useQuery({ queryKey: ['users'], queryFn: api.admin.listUsers, enabled: !!tokens });

  if (!ready || !tokens) return null;

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">AskUs Solutions Admin</h1>
        <Button
          onClick={() => {
            void api.auth.logout(tokens.refreshToken).catch(() => undefined);
            signOut();
            router.replace('/login');
          }}
        >
          Sign out
        </Button>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(['taxi', 'insurance', 'loans', 'organic'] as const).map((product) => {
          const row = summary.data?.find((s) => s.product === product);
          return (
            <Card key={product}>
              <p className="text-sm capitalize text-slate-500">{product}</p>
              <p className="text-2xl font-semibold">{row?.totalRecords ?? 0}</p>
              <p className="text-xs text-slate-500">Amount: {row?.totalAmount ?? '0.00'}</p>
            </Card>
          );
        })}
      </section>

      <Card>
        <h2 className="mb-3 text-lg font-medium">Users</h2>
        {users.error && <p className="text-sm text-red-600">{(users.error as Error).message}</p>}
        <table className="w-full text-left text-sm">
          <thead className="text-slate-500">
            <tr>
              <th className="py-1">Mobile / Email</th>
              <th>Roles</th>
              <th>Active</th>
            </tr>
          </thead>
          <tbody>
            {users.data?.map((u) => (
              <tr key={u.id} className="border-t border-slate-100">
                <td className="py-1">{u.mobile ?? u.email}</td>
                <td>{u.roles.join(', ')}</td>
                <td>{u.isActive ? 'Yes' : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </main>
  );
}
