"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { reportSeries } from "@/data/mock-data";

type ChartPoint = {
  day: string;
  cost: number;
};

export function ExpensesChart({ data = reportSeries }: Readonly<{ data?: ChartPoint[] }>) {
  return (
    <div className="h-40 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: 0, right: 0, top: 12, bottom: 0 }}>
          <defs>
            <linearGradient id="cost" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#adc6ff" stopOpacity={0.75} />
              <stop offset="95%" stopColor="#adc6ff" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#c2c6d6", fontSize: 12 }} />
          <Tooltip
            contentStyle={{ background: "#1e2023", border: "1px solid #424754", borderRadius: 12, color: "#e2e2e6" }}
            labelStyle={{ color: "#adc6ff" }}
          />
          <Area type="monotone" dataKey="cost" stroke="#adc6ff" strokeWidth={2} fill="url(#cost)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
