export function toCSV(rows, headers) {
    const header = headers.join(",");
    const body = rows
      .map((r) =>
        headers
          .map((h) => {
            const v = r[h] ?? "";
            const s = String(v).replaceAll('"', '""');
            return `"${s}"`;
          })
          .join(",")
      )
      .join("\n");
    return `${header}\n${body}`;
  }
  
  export function downloadCSV(filename, csvString) {
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  