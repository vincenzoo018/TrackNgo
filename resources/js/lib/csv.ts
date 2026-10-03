/** Download rows as a CSV file. Cells are written as given, so quote / escape them before passing them in. */
export function downloadCsv(filename: string, headers: string[], rows: string[][]): void {
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
