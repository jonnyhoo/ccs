/**
 * Accounts Table Component
 * Phase 03: REST API Routes & CRUD
 */

import { useReactTable, getCoreRowModel, flexRender, type ColumnDef } from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';
import { useSetDefaultAccount } from '@/hooks/use-accounts';
import type { Account } from '@/lib/api-client';

interface AccountsTableProps {
  data: Account[];
  defaultAccount: string | null;
}

export function AccountsTable({ data, defaultAccount }: AccountsTableProps) {
  const setDefaultMutation = useSetDefaultAccount();

  const columns: ColumnDef<Account>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      size: 200,
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{row.original.name}</span>
          {row.original.name === defaultAccount && (
            <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20">
              default
            </span>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'type',
      header: 'Type',
      size: 100,
      cell: ({ row }) => (
        <span className="capitalize text-muted-foreground">{row.original.type || 'oauth'}</span>
      ),
    },
    {
      accessorKey: 'created',
      header: 'Created',
      size: 150,
      cell: ({ row }) => {
        const date = new Date(row.original.created);
        return <span className="text-muted-foreground">{date.toLocaleDateString()}</span>;
      },
    },
    {
      accessorKey: 'last_used',
      header: 'Last Used',
      size: 150,
      cell: ({ row }) => {
        if (!row.original.last_used) return <span className="text-muted-foreground/50">-</span>;
        const date = new Date(row.original.last_used);
        return <span className="text-muted-foreground">{date.toLocaleDateString()}</span>;
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      size: 100,
      cell: ({ row }) => {
        const isDefault = row.original.name === defaultAccount;
        return (
          <Button
            variant={isDefault ? 'secondary' : 'default'}
            size="sm"
            className="h-8 px-2 w-full"
            disabled={isDefault || setDefaultMutation.isPending}
            onClick={() => setDefaultMutation.mutate(row.original.name)}
          >
            <Check className={`w-3 h-3 mr-1.5 ${isDefault ? 'opacity-50' : ''}`} />
            {isDefault ? 'Active' : 'Set Default'}
          </Button>
        );
      },
    },
  ];

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No accounts found. Use <code className="text-sm bg-muted px-1 rounded">ccs login</code> to
        add accounts.
      </div>
    );
  }

  return (
    <div className="border rounded-md">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const widthClass =
                  {
                    name: 'w-[200px]',
                    type: 'w-[100px]',
                    created: 'w-[150px]',
                    last_used: 'w-[150px]',
                    actions: 'w-[100px]',
                  }[header.id] || 'w-auto';

                return (
                  <TableHead key={header.id} className={widthClass}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
