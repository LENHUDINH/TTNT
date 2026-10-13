import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { useReducedMotion } from "motion/react";
export function AnomalyChart({
  data,
}: {
  data: { date: string; count: number }[];
}) {
  const reduced = useReducedMotion();
  return (
    <div
      className="chart"
      role="img"
      aria-label="Số giao dịch đã được cảnh báo theo ngày giao dịch"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 6" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(v) => v.slice(5)}
            minTickGap={30}
          />
          <YAxis allowDecimals={false} width={35} />
          <Tooltip />
          <Bar
            dataKey="count"
            name="Giao dịch được cảnh báo"
            fill="#494bd6"
            radius={[4, 4, 0, 0]}
            isAnimationActive={!reduced}
            animationDuration={400}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
