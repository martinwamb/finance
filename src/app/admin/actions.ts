"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  createAdminSession,
  destroyAdminSession,
  isAdminAuthed,
  verifyAdminPassword,
} from "@/lib/auth";
import { db } from "@/lib/db";
import { extractPdfText } from "@/lib/pdf";

export interface FormState {
  success: boolean;
  message: string;
}

export async function adminLoginAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const password = String(formData.get("password") ?? "");
  const ok = await verifyAdminPassword(password);
  if (!ok) return { success: false, message: "Incorrect password." };

  await createAdminSession();
  redirect("/admin");
}

export async function adminLogoutAction() {
  await destroyAdminSession();
  redirect("/admin/login");
}

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

export async function uploadReportAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  if (!(await isAdminAuthed())) return { success: false, message: "Not authenticated." };

  const companyId = String(formData.get("companyId") ?? "");
  const fiscalYear = Number(formData.get("fiscalYear"));
  const period = String(formData.get("period") ?? "ANNUAL") as
    | "ANNUAL"
    | "Q1"
    | "Q2"
    | "Q3"
    | "Q4";
  const file = formData.get("file") as File | null;

  if (!companyId || !fiscalYear || !file || file.size === 0) {
    return { success: false, message: "Company, fiscal year, and PDF file are required." };
  }

  const company = await db.company.findUnique({ where: { id: companyId } });
  if (!company) return { success: false, message: "Company not found." };

  const buffer = Buffer.from(await file.arrayBuffer());
  let text: string;
  try {
    text = await extractPdfText(buffer);
  } catch (err) {
    return { success: false, message: `Could not read PDF: ${err}` };
  }

  if (!text.trim()) {
    return {
      success: false,
      message: "No extractable text found in this PDF (it may be a scanned image).",
    };
  }

  await mkdir(path.join(UPLOAD_DIR, companyId), { recursive: true });
  const filePath = path.join(UPLOAD_DIR, companyId, `${fiscalYear}-${period}.pdf`);
  await writeFile(filePath, buffer);

  await db.report.upsert({
    where: { companyId_fiscalYear_period: { companyId, fiscalYear, period } },
    update: {
      source: "UPLOAD",
      filePath,
      rawText: text,
      status: "PENDING",
      failReason: null,
    },
    create: {
      companyId,
      fiscalYear,
      period,
      source: "UPLOAD",
      filePath,
      rawText: text,
      status: "PENDING",
    },
  });

  revalidatePath("/admin");
  return { success: true, message: `Queued ${company.name} FY${fiscalYear} for analysis.` };
}
