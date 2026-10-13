export interface User {
  id: number;
  email: string;
  name: string;
  theme: "light" | "dark" | "system";
}
export interface Wallet {
  id: number;
  name: string;
  type: string;
  balance: number;
  archived: boolean;
}
export interface Category {
  id: number;
  name: string;
}
export interface Transaction {
  id: number;
  walletId: number;
  categoryId: number;
  type: "INCOME" | "EXPENSE";
  amount: number;
  description: string;
  occurredAt: string;
}
export interface Budget {
  id: number;
  categoryId: number;
  month: string;
  amount: number;
  spent: number;
  percentage: number;
}
export interface Contribution {
  id: number;
  amount: number;
  note: string;
  createdAt: string;
}
export interface Goal {
  id: number;
  name: string;
  targetAmount: number;
  dueDate: string;
  saved: number;
  monthlyPlan: number;
  contributions: Contribution[];
  planMethod: string;
}
export interface Notice {
  id: number;
  message: string;
  readFlag: boolean;
  createdAt: string;
}
export interface AlertRow {
  alert: {
    id: number;
    score: number;
    severity: string;
    reason: string;
    status: string;
    modelVersion: string;
    createdAt: string;
  };
  transaction: Transaction;
}
export interface Dashboard {
  month: string;
  balance: number;
  income: number;
  expense: number;
  remaining: number;
  netAssets: number;
  reservedSavings: number;
  daily: { date: string; income: number; expense: number }[];
  categories: { name: string; amount: number }[];
  recent: Transaction[];
  budgets: Budget[];
  goals: Goal[];
  openAlerts: number;
}
export interface Forecast {
  status: string;
  message?: string;
  daysAvailable?: number;
  modelVersion?: string;
  modelName?: string;
  predictions?: { date: string; amount: number }[];
  historical?: { date: string; amount: number }[];
  total?: number;
  monthEnd?: number;
  monthEndComplete?: boolean;
  budgetRisk?: boolean;
  metrics?: { mae: number; rmse: number };
  evaluationDataset?: string;
}
