import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, Download, CheckCircle2, AlertCircle, Loader2, Table } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

interface ColumnDef {
  key: string;
  label: string;
  required?: boolean;
}

interface BulkCsvUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  columns: ColumnDef[];
  sampleData: Record<string, string>[];
  sampleFilename: string;
  uploadEndpoint: string;
  onSuccess: () => void;
  transformRows?: (rows: Record<string, string>[]) => Record<string, string>[];
}

export const BulkCsvUploadModal: React.FC<BulkCsvUploadModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  columns,
  sampleData,
  sampleFilename,
  uploadEndpoint,
  onSuccess,
  transformRows,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);
  const [uploading, setUploading] = useState(false);
  const [step, setStep] = useState<"upload" | "preview">("upload");

  const downloadSampleCsv = () => {
    const headers = columns.map((c) => c.key).join(",");
    const rows = sampleData.map((row) =>
      columns.map((c) => `"${(row[c.key] || "").replace(/"/g, '""')}"`).join(",")
    );
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", sampleFilename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Downloaded sample template ${sampleFilename}`);
  };

  const parseCsvMatrix = (text: string): string[][] => {
    const result: string[][] = [];
    let row: string[] = [];
    let field = "";
    let inQuotes = false;
    let i = 0;

    const firstLine = text.split(/\r\n|\n/)[0] || "";
    const delimiter = firstLine.includes("\t") && !firstLine.includes(",") ? "\t" : ",";

    while (i < text.length) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (inQuotes) {
        if (char === '"') {
          if (nextChar === '"') {
            field += '"';
            i += 2;
            continue;
          } else {
            inQuotes = false;
            i++;
            continue;
          }
        } else {
          field += char;
          i++;
          continue;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
          i++;
          continue;
        } else if (char === delimiter) {
          row.push(field.trim().replace(/^"|"$/g, ""));
          field = "";
          i++;
          continue;
        } else if (char === '\r') {
          if (nextChar === '\n') i++;
          row.push(field.trim().replace(/^"|"$/g, ""));
          if (row.some((c) => c.length > 0)) result.push(row);
          row = [];
          field = "";
          i++;
          continue;
        } else if (char === '\n') {
          row.push(field.trim().replace(/^"|"$/g, ""));
          if (row.some((c) => c.length > 0)) result.push(row);
          row = [];
          field = "";
          i++;
          continue;
        } else {
          field += char;
          i++;
          continue;
        }
      }
    }

    if (field || row.length > 0) {
      row.push(field.trim().replace(/^"|"$/g, ""));
      if (row.some((c) => c.length > 0)) result.push(row);
    }

    return result;
  };

  const parseCsvText = (text: string) => {
    const matrix = parseCsvMatrix(text);
    if (matrix.length < 2) {
      toast.error("CSV file must contain a header row and at least one data row.");
      return;
    }

    const headers = matrix[0].map((h) => h.toLowerCase().trim());
    const rows: Record<string, string>[] = [];

    for (let i = 1; i < matrix.length; i++) {
      const values = matrix[i];
      if (values.length === 0) continue;

      const rowObj: Record<string, string> = {};
      columns.forEach((col, colIdxDefault) => {
        const cleanKey = col.key.toLowerCase().trim();
        const cleanLabel = col.label.toLowerCase().trim();

        const colIdx = headers.findIndex(
          (h) =>
            h === cleanKey ||
            h === cleanLabel ||
            h.replace(/[^a-z0-9]/g, "") === cleanKey.replace(/[^a-z0-9]/g, "")
        );

        let val = "";
        if (colIdx >= 0 && values[colIdx] !== undefined) {
          val = values[colIdx];
        } else if (values[colIdxDefault] !== undefined) {
          val = values[colIdxDefault];
        }
        rowObj[col.key] = val;
      });

      headers.forEach((h, hIdx) => {
        const matchingCol = columns.find(
          (c) => c.key.toLowerCase() === h || c.label.toLowerCase() === h
        );
        if (!matchingCol && values[hIdx] !== undefined) {
          rowObj[h] = values[hIdx];
        }
      });

      rows.push(rowObj);
    }

    if (rows.length === 0) {
      toast.error("No valid data rows found in the CSV file.");
      return;
    }

    setParsedRows(rows);
    setStep("preview");
    toast.success(`Successfully parsed ${rows.length} records!`);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (!selected.name.endsWith(".csv") && !selected.name.endsWith(".txt") && !selected.name.endsWith(".tsv")) {
      toast.error("Please select a valid CSV, TSV or TXT file.");
      return;
    }

    setFile(selected);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) parseCsvText(content);
    };
    reader.readAsText(selected);
  };

  const handleUploadSubmit = async () => {
    if (parsedRows.length === 0) {
      toast.error("No valid rows to upload.");
      return;
    }

    setUploading(true);
    try {
      const finalItems = transformRows ? transformRows(parsedRows) : parsedRows;
      const res = await apiFetch(uploadEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: finalItems }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success !== false) {
        toast.success(data.message || `Successfully imported ${finalItems.length} records!`);
        onSuccess();
        handleClose();
      } else {
        toast.error(data.message || data.error || "Failed to upload records");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred during bulk import.");
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setParsedRows([]);
    setStep("upload");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl rounded-none border-border p-6">
        <DialogHeader className="space-y-2">
          <DialogTitle className="text-2xl font-black uppercase tracking-tight flex items-center gap-3">
            <FileSpreadsheet className="w-6 h-6 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground font-medium">
            {description}
          </DialogDescription>
        </DialogHeader>

        {step === "upload" ? (
          <div className="space-y-6 py-4">
            {/* Download Template Banner */}
            <div className="p-4 bg-primary/5 border border-primary/20 rounded-none flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-foreground">Need the correct CSV format?</p>
                <p className="text-[11px] text-muted-foreground">Download pre-formatted sample template with required column headers.</p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={downloadSampleCsv}
                className="h-10 px-4 rounded-none font-bold text-xs border-primary/30 text-primary hover:bg-primary/10 flex items-center gap-2"
              >
                <Download className="w-4 h-4" /> Download Sample CSV
              </Button>
            </div>

            {/* Drop Zone */}
            <div className="border-2 border-dashed border-border p-10 text-center hover:border-primary/50 transition-all bg-muted/20 relative">
              <input
                type="file"
                accept=".csv, .txt"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center justify-center gap-3">
                <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  <Upload className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">
                    {file ? file.name : "Click or Drag CSV file here to upload"}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Supports .CSV files up to 5000 rows
                  </p>
                </div>
              </div>
            </div>

            {/* Required Fields Info */}
            <div className="space-y-2">
              <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Expected Column Headers:</p>
              <div className="flex flex-wrap gap-2">
                {columns.map((c) => (
                  <span
                    key={c.key}
                    className={`text-[10px] font-bold px-2 py-1 uppercase tracking-wider ${
                      c.required ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {c.label} {c.required ? "*" : ""}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6 py-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-foreground flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Found <span className="font-black text-primary">{parsedRows.length}</span> records ready to import
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep("upload")}
                className="text-xs font-bold text-muted-foreground hover:text-foreground"
              >
                Change File
              </Button>
            </div>

            {/* Preview Table */}
            <div className="max-h-[300px] overflow-y-auto border border-border">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted sticky top-0 font-bold uppercase text-[10px] tracking-wider border-b border-border">
                  <tr>
                    <th className="p-3">#</th>
                    {columns.map((c) => (
                      <th key={c.key} className="p-3">{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {parsedRows.slice(0, 50).map((row, idx) => (
                    <tr key={idx} className="hover:bg-muted/30">
                      <td className="p-3 font-mono text-muted-foreground">{idx + 1}</td>
                      {columns.map((c) => (
                        <td key={c.key} className="p-3 font-medium text-foreground max-w-[200px] truncate">
                          {row[c.key] || <span className="text-muted-foreground italic">--</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedRows.length > 50 && (
                <div className="p-2 text-center text-[11px] font-bold text-muted-foreground bg-muted/30 border-t">
                  + {parsedRows.length - 50} more rows will be imported
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={uploading} className="rounded-none font-bold text-xs h-11">
            Cancel
          </Button>
          {step === "preview" && (
            <Button
              onClick={handleUploadSubmit}
              disabled={uploading || parsedRows.length === 0}
              className="rounded-none font-black text-xs h-11 px-8 uppercase tracking-wider"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importing...
                </>
              ) : (
                `Confirm & Import ${parsedRows.length} Items`
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
