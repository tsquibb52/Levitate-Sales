import Papa from "papaparse";
import { createDemo, listDemos, possibleDuplicate, transaction, validate } from "../../../lib/db";
import { checkOrigin, failure } from "../../../lib/http";
import type { DemoInput } from "../../../lib/fields";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      const form = await request.formData(), file = form.get("file");
      if (!(file instanceof File)) throw new Error("Choose a CSV or XLSX file.");
      if (file.size > 10 * 1024 * 1024) throw new Error("Use a file smaller than 10 MB.");
      let rows: Record<string, string>[] = [];
      if (file.name.toLowerCase().endsWith(".csv")) {
        const result = Papa.parse<Record<string, string>>(await file.text(), { header: true, skipEmptyLines: "greedy", transformHeader: h => h.trim() });
        const fatal = result.errors.find(e => e.code !== "TooFewFields");
        if (fatal) throw new Error(fatal.message);
        rows = result.data;
      } else if (file.name.toLowerCase().endsWith(".xlsx")) {
        const { default: ExcelJS } = await import("exceljs");
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(await file.arrayBuffer());
        const sheet = workbook.worksheets[0];
        if (!sheet) throw new Error("This workbook has no sheets.");
        const headers: string[] = [];
        sheet.getRow(1).eachCell((cell, col) => { headers[col] = cell.text.trim(); });
        if (new Set(headers.filter(Boolean)).size !== headers.filter(Boolean).length) throw new Error("Column headers must be unique.");
        sheet.eachRow((row, number) => {
          if (number === 1) return;
          const item: Record<string, string> = {};
          headers.forEach((header, col) => { if (header) { const cell = row.getCell(col); item[header] = cell.value instanceof Date ? cell.value.toISOString().slice(0,10) : cell.text; } });
          rows.push(item);
        });
      } else throw new Error("Use CSV or .xlsx (Excel) format.");
      if (!rows.length) throw new Error("The file has no data rows.");
      if (rows.length > 5000) throw new Error("Import up to 5,000 rows at a time.");
      return Response.json({ headers: Object.keys(rows[0]), rows });
    }
    const body = await request.json();
    if (!Array.isArray(body.rows) || body.rows.length > 5000 || !body.rows.length) throw new Error("Provide 1–5,000 rows.");
    const rows: DemoInput[] = body.rows.map((row: unknown, index: number) => { try { return validate(row); } catch (e) { throw new Error(`Row ${index + 1}: ${(e as Error).message}`); } });
    if (!body.confirm) {
      const seen: DemoInput[] = [...listDemos()];
      const preview = rows.map(row => { const duplicate = possibleDuplicate(row, seen); seen.push(row); return { ...row, duplicate }; });
      return Response.json({ preview });
    }
    const result = transaction(() => {
      const seen: DemoInput[] = [...listDemos()];
      let imported = 0, skipped = 0;
      for (const row of rows) {
        if (possibleDuplicate(row, seen) && body.skipDuplicates !== false) { skipped++; continue; }
        createDemo(row, "Imported from spreadsheet"); seen.push(row); imported++;
      }
      return { imported, skipped };
    });
    return Response.json(result);
  } catch (e) { return failure(e); }
}
