"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CHROME, STATUS } from "@/lib/palette";
import { formatCompact, formatPct } from "@/lib/format";

export interface FiscalPoint {
  fiscalYear: number;
  revenue: number | null;
  netIncome: number | null;
  revenueGrowthPct: number | null;
  profitMarginPct: number | null;
}

function useMode(): "light" | "dark" {
  const [mode, setMode] = useState<"light" | "dark">("light");
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setMode(mq.matches ? "dark" : "light");
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return mode;
}

function ChartTooltip({
  active,
  payload,
  label,
  formatter,
  mode,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string | number;
  formatter: (v: number) => string;
  mode: "light" | "dark";
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-md border px-3 py-2 text-xs shadow-md"
      style={{
        background: CHROME.surface[mode],
        borderColor: CHROME.gridline[mode],
        color: CHROME.textPrimary[mode],
      }}
    >
      <p className="font-medium">FY{label}</p>
      <p style={{ color: CHROME.textSecondary[mode] }}>{formatter(payload[0].value)}</p>
    </div>
  );
}

export function CompanyCharts({
  data,
  currency = "USD",
}: {
  data: FiscalPoint[];
  currency?: string;
}) {
  const mode = useMode();
  const blue = mode === "dark" ? "#3987e5" : "#2a78d6";
  const sorted = [...data].sort((a, b) => a.fiscalYear - b.fiscalYear);
  // Axis and tooltip money labels follow the company's own reporting currency,
  // so a JPY filer isn't rendered with a dollar sign.
  const money = (v: number) => formatCompact(v, currency);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Revenue</CardTitle>
        </CardHeader>
        <CardContent className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sorted} barCategoryGap="30%">
              <CartesianGrid vertical={false} stroke={CHROME.gridline[mode]} />
              <XAxis
                dataKey="fiscalYear"
                tickLine={false}
                axisLine={{ stroke: CHROME.baseline[mode] }}
                tick={{ fill: CHROME.muted[mode], fontSize: 12 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={56}
                tick={{ fill: CHROME.muted[mode], fontSize: 12 }}
                tickFormatter={money}
              />
              <Tooltip
                cursor={{ fill: CHROME.gridline[mode], opacity: 0.4 }}
                content={<ChartTooltip formatter={money} mode={mode} />}
              />
              <Bar dataKey="revenue" fill={blue} radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Net income</CardTitle>
        </CardHeader>
        <CardContent className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sorted} barCategoryGap="30%">
              <CartesianGrid vertical={false} stroke={CHROME.gridline[mode]} />
              <XAxis
                dataKey="fiscalYear"
                tickLine={false}
                axisLine={{ stroke: CHROME.baseline[mode] }}
                tick={{ fill: CHROME.muted[mode], fontSize: 12 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={56}
                tick={{ fill: CHROME.muted[mode], fontSize: 12 }}
                tickFormatter={money}
              />
              <Tooltip
                cursor={{ fill: CHROME.gridline[mode], opacity: 0.4 }}
                content={<ChartTooltip formatter={money} mode={mode} />}
              />
              <Bar dataKey="netIncome" radius={[4, 4, 0, 0]} maxBarSize={40}>
                {sorted.map((d, i) => (
                  <Cell
                    key={i}
                    fill={(d.netIncome ?? 0) >= 0 ? STATUS.good[mode] : STATUS.critical[mode]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Revenue growth (YoY)
          </CardTitle>
        </CardHeader>
        <CardContent className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sorted} barCategoryGap="30%">
              <CartesianGrid vertical={false} stroke={CHROME.gridline[mode]} />
              <XAxis
                dataKey="fiscalYear"
                tickLine={false}
                axisLine={{ stroke: CHROME.baseline[mode] }}
                tick={{ fill: CHROME.muted[mode], fontSize: 12 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={48}
                tick={{ fill: CHROME.muted[mode], fontSize: 12 }}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                cursor={{ fill: CHROME.gridline[mode], opacity: 0.4 }}
                content={<ChartTooltip formatter={(v) => formatPct(v)} mode={mode} />}
              />
              <Bar dataKey="revenueGrowthPct" radius={[4, 4, 0, 0]} maxBarSize={40}>
                {sorted.map((d, i) => (
                  <Cell
                    key={i}
                    fill={
                      (d.revenueGrowthPct ?? 0) >= 0 ? STATUS.good[mode] : STATUS.critical[mode]
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Profit margin
          </CardTitle>
        </CardHeader>
        <CardContent className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sorted}>
              <CartesianGrid vertical={false} stroke={CHROME.gridline[mode]} />
              <XAxis
                dataKey="fiscalYear"
                tickLine={false}
                axisLine={{ stroke: CHROME.baseline[mode] }}
                tick={{ fill: CHROME.muted[mode], fontSize: 12 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={48}
                tick={{ fill: CHROME.muted[mode], fontSize: 12 }}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip content={<ChartTooltip formatter={(v) => formatPct(v)} mode={mode} />} />
              <Line
                type="monotone"
                dataKey="profitMarginPct"
                stroke={blue}
                strokeWidth={2}
                dot={{ r: 4, fill: blue, strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
