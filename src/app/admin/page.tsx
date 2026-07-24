import Link from "next/link";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { adminLogoutAction } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const [reports, counts] = await Promise.all([
    db.report.findMany({
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: { company: { include: { exchange: true } } },
    }),
    db.report.groupBy({ by: ["status"], _count: true }),
  ]);

  const countFor = (status: string) =>
    counts.find((c) => c.status === status)?._count ?? 0;

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-12">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <div className="flex gap-2">
          <Link href="/admin/upload">
            <Button>Upload report</Button>
          </Link>
          <form action={adminLogoutAction}>
            <Button type="submit" variant="outline">
              Sign out
            </Button>
          </form>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {(["PENDING", "PROCESSING", "ANALYZED", "FAILED"] as const).map((status) => (
          <Card key={status}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                {status}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{countFor(status)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border/60">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>Fiscal year</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reports.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">
                  {r.company.name}{" "}
                  <span className="text-muted-foreground">({r.company.exchange.code})</span>
                </TableCell>
                <TableCell>
                  FY{r.fiscalYear} {r.period !== "ANNUAL" ? r.period : ""}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{r.source}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={r.status === "FAILED" ? "destructive" : "outline"}>
                    {r.status}
                  </Badge>
                  {r.status === "FAILED" && r.failReason && (
                    <p className="mt-1 max-w-xs truncate text-xs text-muted-foreground">
                      {r.failReason}
                    </p>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {r.updatedAt.toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
            {reports.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  No reports yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
