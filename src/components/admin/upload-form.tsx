"use client";

import { useActionState } from "react";
import { uploadReportAction, type FormState } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const initialState: FormState = { success: false, message: "" };

export interface CompanyOption {
  id: string;
  name: string;
  ticker: string;
  exchangeCode: string;
}

export function UploadForm({ companies }: { companies: CompanyOption[] }) {
  const [state, formAction, pending] = useActionState(uploadReportAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="companyId">Company</Label>
        <Select name="companyId" required>
          <SelectTrigger id="companyId" className="w-full">
            <SelectValue placeholder="Select a company" />
          </SelectTrigger>
          <SelectContent>
            {companies.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name} ({c.ticker} · {c.exchangeCode})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="fiscalYear">Fiscal year</Label>
          <Input
            id="fiscalYear"
            name="fiscalYear"
            type="number"
            defaultValue={new Date().getFullYear() - 1}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="period">Period</Label>
          <Select name="period" defaultValue="ANNUAL">
            <SelectTrigger id="period" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ANNUAL">Annual</SelectItem>
              <SelectItem value="Q1">Q1</SelectItem>
              <SelectItem value="Q2">Q2</SelectItem>
              <SelectItem value="Q3">Q3</SelectItem>
              <SelectItem value="Q4">Q4</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="file">Report PDF</Label>
        <Input id="file" name="file" type="file" accept="application/pdf" required />
      </div>

      {state.message && (
        <p className={state.success ? "text-sm text-foreground" : "text-sm text-destructive"}>
          {state.message}
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Uploading…" : "Upload & queue for analysis"}
      </Button>
    </form>
  );
}
