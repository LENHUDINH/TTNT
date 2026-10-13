import { useReducedMotion } from "motion/react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from "recharts";
import { money, shortMoney } from "../../utils/format";
const colors = [
  "#10b981",
  "#00687a",
  "#494bd6",
  "#57dffe",
  "#9699ff",
  "#f59e0b",
  "#ba1a1a",
  "#6c7a71",
];
export function CashflowChart({
  data,
}: {
  data: { date: string; income: number; expense: number }[];
}) {
  const reduced = useReducedMotion();
  return (
    <div
      className="chart"
      role="img"
      aria-label="Biểu đồ thu nhập và chi tiêu theo ngày"
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="income-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#10b981" stopOpacity={0.25} />
              <stop offset="1" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 6" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(v) => v.slice(8)}
            minTickGap={30}
          />
          <YAxis tickFormatter={shortMoney} width={55} />
          <Tooltip formatter={(v) => money(Number(v))} />
          <Legend
            formatter={(value) => (
              <span style={{ color: "var(--text)" }}>{value}</span>
            )}
          />
          <Area
            isAnimationActive={!reduced}
            animationDuration={400}
            name="Thu nhập"
            dataKey="income"
            type="monotone"
            stroke="#10b981"
            fill="url(#income-fill)"
            strokeWidth={2}
          />
          <Area
            isAnimationActive={!reduced}
            animationDuration={400}
            name="Chi tiêu"
            dataKey="expense"
            type="monotone"
            stroke="#00687a"
            fill="#57dffe"
            fillOpacity={0.1}
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
export function CategoryChart({
  data,
}: {
  data: { name: string; amount: number }[];
}) {
  const reduced = useReducedMotion();
  return (
    <div
      className="chart"
      role="img"
      aria-label="Phân bổ chi tiêu theo danh mục"
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            isAnimationActive={!reduced}
            animationDuration={400}
            data={data}
            dataKey="amount"
            nameKey="name"
            innerRadius="53%"
            outerRadius="72%"
            paddingAngle={3}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(v) => money(Number(v))} />
          <Legend
            iconType="circle"
            formatter={(value) => (
              <span style={{ color: "var(--text)" }}>{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
export function ForecastChart({
  data,
}: {
  data: { date: string; actual?: number; predicted?: number }[];
}) {
  const reduced = useReducedMotion();
  return (
    <div
      className="chart chart-tall"
      role="img"
      aria-label="Chi tiêu thực tế và chi tiêu dự báo, đường dự báo nét đứt"
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 6" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(v) => v.slice(5)}
            minTickGap={40}
          />
          <YAxis tickFormatter={shortMoney} width={55} />
          <Tooltip formatter={(v) => money(Number(v))} />
          <Legend
            formatter={(value) => (
              <span style={{ color: "var(--text)" }}>{value}</span>
            )}
          />
          <Line
            isAnimationActive={!reduced}
            animationDuration={400}
            name="Thực tế"
            dataKey="actual"
            stroke="#10b981"
            dot={false}
            strokeWidth={2}
          />
          <Line
            isAnimationActive={!reduced}
            animationDuration={400}
            name="Dự báo AI"
            dataKey="predicted"
            stroke="#494bd6"
            strokeDasharray="6 4"
            dot={false}
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
