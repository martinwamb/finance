"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export interface CompanyRow {
  ticker: string;
  name: string;
  sector: string | null;
  exchangeCode: string;
  hasInsight: boolean;
}

export function CompaniesTable({ rows }: { rows: CompanyRow[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.ticker.toLowerCase().includes(q) ||
        r.sector?.toLowerCase().includes(q) ||
        r.exchangeCode.toLowerCase().includes(q)
    );
  }, [rows, query]);

  return (
    <div className="flex flex-col gap-4">
      <Input
        placeholder="Search by name, ticker, or sector…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="max-w-sm"
      />
      <div className="overflow-x-auto rounded-lg border border-border/60">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>Ticker</TableHead>
              <TableHead>Exchange</TableHead>
              <TableHead>Sector</TableHead>
              <TableHead className="text-right">Coverage</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => (
              <TableRow key={`${r.exchangeCode}-${r.ticker}`} className="hover:bg-muted/40">
                <TableCell>
                  <Link
                    href={`/company/${r.exchangeCode}/${r.ticker}`}
                    className="font-medium hover:underline"
                  >
                    {r.name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{r.ticker}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{r.exchangeCode}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{r.sector ?? "—"}</TableCell>
                <TableCell className="text-right">
                  {r.hasInsight ? (
                    <Badge>Analyzed</Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">Pending</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  No companies match your search.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
