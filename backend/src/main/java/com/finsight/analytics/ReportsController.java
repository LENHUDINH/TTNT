package com.finsight.analytics;

import com.finsight.auth.AuthController;
import com.finsight.model.Entities.*;
import com.finsight.transaction.*;
import com.lowagie.text.*;
import com.lowagie.text.pdf.*;
import java.io.*;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import org.apache.commons.csv.*;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.http.*;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/reports")
public class ReportsController {
  private final FinanceService f;
  private final AuthController auth;
  private final jakarta.validation.Validator validator;

  public ReportsController(FinanceService f, AuthController a, jakarta.validation.Validator v) {
    this.f = f;
    auth = a;
    validator = v;
  }

  @GetMapping("/export")
  ResponseEntity<byte[]> export(
      Authentication a,
      @RequestParam(defaultValue = "xlsx") String format,
      @RequestParam(required = false) String month)
      throws Exception {
    long u = auth.current(a).id;
    var ts =
        f.list(Transaction.class, u).stream()
            .filter(t -> month == null || YearMonth.from(t.occurredAt).toString().equals(month))
            .sorted(Comparator.comparing(t -> t.occurredAt))
            .toList();
    var categories = new HashMap<Long, String>();
    f.list(Category.class, u).forEach(c -> categories.put(c.id, c.name));
    byte[] bytes;
    String mime, ext;
    var out = new ByteArrayOutputStream();
    String[] headers = {"Ngày", "Mô tả", "Loại", "Danh mục", "Số tiền VND"};
    if (format.equals("xlsx")) {
      try (var workbook = new XSSFWorkbook()) {
        var sheet = workbook.createSheet("FinSight");
        var style = workbook.createCellStyle();
        style.setDataFormat(workbook.createDataFormat().getFormat("#,##0.00"));
        var header = sheet.createRow(0);
        for (int i = 0; i < 5; i++) header.createCell(i).setCellValue(headers[i]);
        int row = 1;
        for (var t : ts) {
          var r = sheet.createRow(row++);
          r.createCell(0).setCellValue(t.occurredAt.toString());
          r.createCell(1).setCellValue(t.description);
          r.createCell(2).setCellValue(t.type);
          r.createCell(3).setCellValue(categories.get(t.categoryId));
          r.createCell(4).setCellValue(t.amount.doubleValue());
          r.getCell(4).setCellStyle(style);
        }
        for (int i = 0; i < 5; i++) sheet.autoSizeColumn(i);
        workbook.write(out);
      }
      mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      ext = "xlsx";
    } else if (format.equals("pdf")) {
      var doc = new Document(PageSize.A4.rotate());
      PdfWriter.getInstance(doc, out);
      doc.open();
      var stream = getClass().getResourceAsStream("/fonts/DejaVuSans.ttf");
      if (stream == null) throw new IllegalStateException("Missing PDF font");
      BaseFont bf =
          BaseFont.createFont(
              "DejaVuSans.ttf",
              BaseFont.IDENTITY_H,
              BaseFont.EMBEDDED,
              true,
              stream.readAllBytes(),
              null);
      var font = new com.lowagie.text.Font(bf, 9);
      doc.add(new Paragraph("FinSight AI — Báo cáo thu chi", new com.lowagie.text.Font(bf, 16)));
      doc.add(new Paragraph("Chuyển ví và đóng góp tiết kiệm không được tính là thu/chi.", font));
      var table = new PdfPTable(5);
      table.setWidthPercentage(100);
      table.setWidths(new float[] {2, 4, 1.5f, 2, 2});
      for (String h : headers) table.addCell(new Phrase(h, font));
      for (var t : ts) {
        for (String v :
            java.util.List.of(
                t.occurredAt.toString(),
                t.description,
                t.type,
                categories.get(t.categoryId),
                t.amount.toPlainString())) table.addCell(new Phrase(v, font));
      }
      doc.add(table);
      doc.close();
      mime = "application/pdf";
      ext = "pdf";
    } else throw FinanceService.bad("Định dạng cần là xlsx hoặc pdf");
    bytes = out.toByteArray();
    return ResponseEntity.ok()
        .contentType(MediaType.parseMediaType(mime))
        .header("Content-Disposition", "attachment; filename=finsight-report." + ext)
        .body(bytes);
  }

  @PostMapping("/import-csv")
  @Transactional(
      isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED,
      rollbackFor = Exception.class)
  Object csv(
      Authentication a,
      @RequestParam MultipartFile file,
      @RequestHeader("Idempotency-Key") String batch)
      throws Exception {
    long u = auth.current(a).id;
    f.lockUser(u);
    if (file.getSize() > 2_000_000) throw FinanceService.bad("CSV tối đa 2 MB");
    int count = 0;
    try (var reader = new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8);
        var parser =
            CSVFormat.DEFAULT.builder().setHeader().setSkipHeaderRecord(true).get().parse(reader)) {
      for (var row : parser) {
        if (count >= 1000) throw FinanceService.bad("CSV tối đa 1000 dòng");
        try {
          var p =
              new FinanceRequests.TransactionInput(
                  Long.valueOf(row.get("walletId")),
                  Long.valueOf(row.get("categoryId")),
                  row.get("type"),
                  new BigDecimal(row.get("amount")),
                  row.get("description"),
                  LocalDateTime.parse(row.get("occurredAt")));
          if (!validator.validate(p).isEmpty())
            throw FinanceService.bad("CSV không hợp lệ ở dòng " + (count + 2));
          f.addTransaction(u, p, batch + ":" + count);
          count++;
        } catch (IllegalArgumentException e) {
          throw FinanceService.bad("CSV sai định dạng ở dòng " + (count + 2));
        }
      }
    }
    return Map.of("imported", count, "atomic", true);
  }
}
