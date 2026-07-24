import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UploadForm, type CompanyOption } from "@/components/admin/upload-form";

export const dynamic = "force-dynamic";

export default async function AdminUploadPage() {
  const companies = await db.company.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, ticker: true, exchange: { select: { code: true } } },
  });

  const options: CompanyOption[] = companies.map((c) => ({
    id: c.id,
    name: c.name,
    ticker: c.ticker,
    exchangeCode: c.exchange.code,
  }));

  return (
    <div className="mx-auto w-full max-w-xl px-6 py-12">
      <h1 className="mb-8 text-2xl font-semibold tracking-tight">Upload report</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            PDF annual or quarterly report
          </CardTitle>
        </CardHeader>
        <CardContent>
          <UploadForm companies={options} />
        </CardContent>
      </Card>
    </div>
  );
}
