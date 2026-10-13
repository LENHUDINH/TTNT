import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect, useState, useRef } from "react";
import { Modal } from "../ui/dialog";
import { Button } from "../ui/button";
import { useAction } from "../../hooks/data";
import { api, jsonBody } from "../../services/api";
import { Sparkles } from "lucide-react";
export interface Field {
  key: string;
  label: string;
  type?: string;
  options?: { value: string | number; label: string }[];
  default?: string | number;
  validate?: z.ZodType;
  hint?: string;
}
export interface EditorConfig {
  title: string;
  path: string;
  method?: string;
  fields: Field[];
  onSaved?: () => void;
}
export const required = z
  .string()
  .trim()
  .min(1, "Vui lòng nhập thông tin")
  .max(250);
export const monetary = z
  .string()
  .regex(/^\d{1,15}(\.\d{1,2})?$/, "Nhập số tiền, tối đa hai chữ số thập phân")
  .refine((v) => Number(v) > 0, "Số tiền phải lớn hơn 0");
export function Editor({
  config,
  onClose,
}: {
  config: EditorConfig;
  onClose: () => void;
}) {
  const requestKey = useRef(crypto.randomUUID());
  const shape = Object.fromEntries(
    config.fields.map((f) => [f.key, f.validate ?? required]),
  );
  const schema = z.object(shape);
  const form = useForm<Record<string, unknown>>({
    resolver: zodResolver(schema) as never,
    defaultValues: Object.fromEntries(
      config.fields.map((f) => [f.key, f.default ?? ""]),
    ),
  });
  const [suggestion, setSuggestion] = useState<{
    category?: string;
    message?: string;
  }>();
  const [suggesting, setSuggesting] = useState(false);
  const canSuggest =
    config.fields.some((f) => f.key === "description") &&
    config.fields.some((f) => f.key === "categoryId");
  async function suggest() {
    setSuggesting(true);
    try {
      const r = await api<{ category?: string; message?: string }>(
        "/ai/classify",
        {
          method: "POST",
          body: jsonBody({ text: form.getValues("description") }),
        },
      );
      setSuggestion(r);
    } catch (e) {
      setSuggestion({ message: (e as Error).message });
    } finally {
      setSuggesting(false);
    }
  }
  const action = useAction(() => {
    if (suggestion?.category)
      api("/ai/classification-feedback", {
        method: "POST",
        body: jsonBody({
          description: form.getValues("description"),
          categoryId: Number(form.getValues("categoryId")),
        }),
      }).catch(() => {
        window.dispatchEvent(
          new CustomEvent("finsight-toast", {
            detail: "Giao dịch đã lưu nhưng phản hồi phân loại chưa lưu được.",
          }),
        );
      });
    config.onSaved?.();
    onClose();
  });
  useEffect(
    () =>
      form.reset(
        Object.fromEntries(config.fields.map((f) => [f.key, f.default ?? ""])),
      ),
    [config, form],
  );
  return (
    <Modal title={config.title} open onClose={onClose}>
      <form
        className="form-grid"
        onSubmit={form.handleSubmit((data) =>
          action.mutate({
            path: config.path,
            method: config.method,
            data,
            headers: { "Idempotency-Key": requestKey.current },
          }),
        )}
      >
        {config.fields.map((f) => (
          <label key={f.key} className="field">
            <span>{f.label}</span>
            {f.options ? (
              <select
                aria-label={f.label}
                {...form.register(f.key)}
                aria-invalid={!!form.formState.errors[f.key]}
              >
                {!f.default && (
                  <option value="">Chọn {f.label.toLowerCase()}</option>
                )}
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                aria-label={f.label}
                type={f.type ?? "text"}
                step={f.type === "number" ? "0.01" : undefined}
                {...form.register(f.key)}
                aria-invalid={!!form.formState.errors[f.key]}
              />
            )}{" "}
            {f.hint && <small className="muted">{f.hint}</small>}
            {form.formState.errors[f.key] && (
              <small className="danger" role="alert">
                {String(form.formState.errors[f.key]?.message)}
              </small>
            )}
          </label>
        ))}
        {canSuggest && (
          <div className="classification-suggestion">
            <Button
              variant="outline"
              size="sm"
              disabled={suggesting}
              onClick={suggest}
            >
              <Sparkles size={15} />
              {suggesting ? "Đang phân loại…" : "Gợi ý danh mục từ AI"}
            </Button>
            {suggestion?.category && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const option = config.fields
                    .find((f) => f.key === "categoryId")
                    ?.options?.find((o) => o.label === suggestion.category);
                  if (option) form.setValue("categoryId", option.value);
                }}
              >
                Áp dụng: {suggestion.category}
              </Button>
            )}
            {suggestion?.message && (
              <small role="status" className="muted">
                {suggestion.message}
              </small>
            )}
          </div>
        )}
        {action.error && (
          <p className="danger" role="alert">
            {action.error.message}
          </p>
        )}
        <div className="form-actions">
          <Button variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" disabled={action.isPending}>
            {action.isPending ? "Đang lưu…" : "Xác nhận & lưu"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
