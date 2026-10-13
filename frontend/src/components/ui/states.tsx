import { Inbox, AlertCircle, LoaderCircle } from "lucide-react";
import { Button } from "./button";
export function Loading() {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" />
      <span>Đang tải dữ liệu…</span>
      <div className="skeleton-grid">
        <i />
        <i />
        <i />
      </div>
    </div>
  );
}
export function Empty({
  title = "Chưa có dữ liệu",
  text = "Thêm thông tin để bắt đầu theo dõi tài chính.",
}: {
  title?: string;
  text?: string;
}) {
  return (
    <div className="empty">
      <Inbox />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
export function ErrorState({
  error,
  retry,
}: {
  error: Error;
  retry?: () => void;
}) {
  return (
    <div role="alert" className="error-state">
      <AlertCircle />
      <p>{error.message}</p>
      {retry && (
        <Button variant="outline" onClick={retry}>
          Thử lại
        </Button>
      )}
    </div>
  );
}
