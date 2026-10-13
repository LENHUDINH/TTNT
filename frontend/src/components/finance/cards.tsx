import { motion, useReducedMotion } from "motion/react";
import {
  ArrowUpRight,
  Wallet,
  TrendingUp,
  TrendingDown,
  PiggyBank,
} from "lucide-react";
import { money } from "../../utils/format";
import type { Budget, Goal, Category } from "../../types";
export function Metrics({
  values,
}: {
  values: { label: string; value: number; hint?: string }[];
}) {
  const reduced = useReducedMotion();
  const icons = [Wallet, TrendingUp, TrendingDown, PiggyBank];
  return (
    <div className="metrics">
      {values.map((v, i) => {
        const Icon = icons[i % 4];
        return (
          <motion.article
            className="metric card"
            key={v.label}
            initial={reduced ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04, duration: 0.25 }}
          >
            <div className="metric-top">
              <span>{v.label}</span>
              <span className={`metric-icon tone-${i % 4}`}>
                <Icon size={20} />
              </span>
            </div>
            <div className="metric-value">{money(v.value)}</div>
            <div className="metric-hint">
              <ArrowUpRight size={14} />
              {v.hint ?? "Cập nhật từ giao dịch của bạn"}
            </div>
          </motion.article>
        );
      })}
    </div>
  );
}
export function Progress({ value }: { value: number }) {
  const reduced = useReducedMotion();
  return (
    <div
      className={`progress ${value >= 100 ? "over" : value >= 90 ? "warn" : ""}`}
      role="progressbar"
      aria-valuenow={Math.min(100, Math.max(0, Math.round(value)))}
      aria-valuetext={`${Math.round(value)}%`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Tiến độ"
    >
      <motion.span
        initial={false}
        animate={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        transition={{ duration: reduced ? 0 : 0.35 }}
      />
    </div>
  );
}
export function BudgetRows({
  budgets,
  categories,
}: {
  budgets: Budget[];
  categories: Category[];
}) {
  return (
    <div className="budget-list">
      {budgets.map((b) => (
        <div className="budget-row" key={b.id}>
          <div>
            <b>
              {categories.find((c) => c.id === b.categoryId)?.name ??
                "Danh mục"}
            </b>
            <span className={b.percentage >= 100 ? "danger" : "muted"}>
              {b.percentage.toFixed(0)}%
            </span>
          </div>
          <Progress value={b.percentage} />
          <small>
            {money(b.spent)} <span className="muted">/ {money(b.amount)}</span>
          </small>
        </div>
      ))}
    </div>
  );
}
export function GoalSummary({ goal }: { goal: Goal }) {
  return (
    <>
      <div className="goal-heading">
        <span className="metric-icon tone-3">
          <PiggyBank size={22} />
        </span>
        <span className="badge">Mục tiêu tiết kiệm</span>
      </div>
      <h3>{goal.name}</h3>
      <div className="goal-value">
        {money(goal.saved)}{" "}
        <small className="muted">/ {money(goal.targetAmount)}</small>
      </div>
      <Progress
        value={(Number(goal.saved) / Number(goal.targetAmount)) * 100}
      />
      <div className="goal-footer">
        <span>
          {((Number(goal.saved) / Number(goal.targetAmount)) * 100).toFixed(0)}%
          hoàn thành
        </span>
        <span>{goal.dueDate}</span>
      </div>
    </>
  );
}
