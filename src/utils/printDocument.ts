/**
 * Utility to reliably print or export an official letter document on A4 standard paper.
 * Designed to work smoothly both inside Sandboxed iFrames (like Google AI Studio preview)
 * and in standard browser windows.
 */

export interface LetterDocumentData {
  elementId?: string;
  docTitle?: string;
  kopInstansiAtas?: string;
  kopTeksRT?: string;
  kopKelurahan?: string;
  kopKecamatan?: string;
  kopSekretariatText?: string;
  judulSurat?: string;
  nomorSurat?: string;
  kalimatPembuka?: string;
  namaPemohon?: string;
  tempatTglLahir?: string;
  jenisKelamin?: string;
  statusKawin?: string;
  agama?: string;
  nikPemohon?: string;
  pekerjaan?: string;
  telepon?: string;
  alamatBaris1?: string;
  alamatBaris2?: string;
  keperluan1?: string;
  keperluan2?: string;
  kalimatPenutup?: string;
  lokasiSurat?: string;
  tanggalSurat?: string;
  namaKetuaRT?: string;
  namaKetuaRW?: string;
  fontFamily?: string;
  bodyFontSizePt?: number;
  kopFontSizePt?: number;
  titleFontSizePt?: number;
  lineHeight?: number;
  rowSpacingPt?: number;
  sectionSpacingPt?: number;
  signatureSpacePt?: number;
}

/**
 * Builds the standalone, high-fidelity A4 HTML string with inline CSS and responsive print toolbar.
 */
export const buildPrintableHtml = (elementHtml: string, docTitle: string = 'Surat_Pengantar_A4'): string => {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${docTitle}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 1.2cm 1.6cm 1.2cm 1.6cm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      background-color: #f1f5f9;
      color: #000000;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 12.5px;
      line-height: 1.45;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    
    /* On-Screen Print Action Bar */
    .print-toolbar {
      position: sticky;
      top: 0;
      left: 0;
      right: 0;
      background: #0f172a;
      color: #ffffff;
      padding: 10px 16px;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 9999;
    }
    .print-toolbar-title {
      font-weight: 700;
      font-size: 13.5px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .print-toolbar-badge {
      background: #10b981;
      color: #ffffff;
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 9999px;
      font-weight: 600;
    }
    .print-toolbar-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .btn-print {
      background: #16a34a;
      color: #ffffff;
      border: none;
      border-radius: 6px;
      padding: 7px 15px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: background 0.2s;
    }
    .btn-print:hover {
      background: #15803d;
    }
    .btn-secondary {
      background: #334155;
      color: #ffffff;
      border: none;
      border-radius: 6px;
      padding: 7px 12px;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }
    .btn-secondary:hover {
      background: #475569;
    }

    .paper-canvas {
      width: 210mm;
      min-height: 297mm;
      margin: 15px auto 30px auto;
      background: #ffffff;
      padding: 1.4cm 1.8cm;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
      box-sizing: border-box;
    }

    /* Print Sheet Styling */
    .grid { display: grid; }
    .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .grid-cols-\\[145px_14px_1fr\\] { grid-template-columns: 145px 14px 1fr; }
    .grid-cols-\\[170px_16px_1fr\\] { grid-template-columns: 145px 14px 1fr; }
    .grid-cols-\\[16px_1fr\\] { grid-template-columns: 14px 1fr; }
    .items-start { align-items: flex-start; }
    .items-center { align-items: center; }
    .justify-between { justify-content: space-between; }
    .justify-center { justify-content: center; }
    .text-center { text-align: center; }
    .text-left { text-align: left; }
    .text-right { text-align: right; }
    .text-justify { text-align: justify; }
    .font-bold { font-weight: 700; }
    .font-semibold { font-weight: 600; }
    .font-normal { font-weight: 400; }
    .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .underline { text-decoration: underline; }
    .uppercase { text-transform: uppercase; }
    .border-b-2 { border-bottom: 2px solid #000000; }
    .border-black { border-color: #000000; }
    .tracking-wide { letter-spacing: 0.025em; }
    .tracking-wider { letter-spacing: 0.05em; }
    .space-y-1 > * + * { margin-top: 0.2rem; }
    .flex { display: flex; }
    .flex-1 { flex: 1 1 0%; }
    .gap-2 { gap: 0.5rem; }
    .gap-4 { gap: 1rem; }
    .shrink-0 { flex-shrink: 0; }
    .no-print { display: none !important; }
    .w-full { width: 100%; }
    .h-full { height: 100%; }
    .h-16 { height: 4rem; }
    .h-20 { height: 5rem; }
    .h-24 { height: 5rem; }
    .h-28 { height: 5rem; }
    .px-1 { padding-left: 0.25rem; padding-right: 0.25rem; }
    .px-2 { padding-left: 0.5rem; padding-right: 0.5rem; }
    .px-4 { padding-left: 1rem; padding-right: 1rem; }
    .pt-2 { padding-top: 0.5rem; }
    .pb-1\\.5 { padding-bottom: 0.375rem; }
    .mb-3 { margin-bottom: 0.75rem; }
    .mb-4 { margin-bottom: 1rem; }
    .mb-6 { margin-bottom: 1.5rem; }
    .mt-0\\.5 { margin-top: 0.125rem; }
    .mt-1 { margin-top: 0.25rem; }
    .leading-tight { line-height: 1.2; }
    .leading-normal { line-height: 1.45; }
    .leading-relaxed { line-height: 1.5; }
    .text-\\[10\\.5px\\] { font-size: 10.5px; }
    .text-\\[11px\\] { font-size: 11px; }
    .text-\\[12\\.5px\\] { font-size: 12.5px; }
    .text-\\[13px\\] { font-size: 12.5px; }
    .text-\\[13\\.5px\\] { font-size: 13.5px; }
    .text-\\[15px\\] { font-size: 15px; }
    .text-\\[16px\\] { font-size: 16px; }
    .text-\\[17px\\] { font-size: 15px; }
    .text-\\[18px\\] { font-size: 16px; }
    .text-black { color: #000000 !important; }
    img { max-width: 100%; height: auto; display: block; }
    svg { max-width: 100%; height: auto; display: block; }

    @media print {
      body {
        background-color: #ffffff !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      .print-toolbar {
        display: none !important;
      }
      .paper-canvas {
        margin: 0 !important;
        padding: 0 !important;
        width: 100% !important;
        max-width: 100% !important;
        min-height: auto !important;
        box-shadow: none !important;
        border: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="print-toolbar">
    <div class="print-toolbar-title">
      <span>📄 ${docTitle}</span>
      <span class="print-toolbar-badge">Standar A4 Siap Cetak</span>
    </div>
    <div class="print-toolbar-actions">
      <button class="btn-print" onclick="window.print()">
        🖨️ Cetak Dokumen / Simpan PDF
      </button>
      <button class="btn-secondary" onclick="window.close()">
        Tutup
      </button>
    </div>
  </div>

  <div class="paper-canvas">
    ${elementHtml}
  </div>

  <script>
    // Trigger print dialog automatically when loaded
    window.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => {
        try {
          window.focus();
          window.print();
        } catch(e) {
          console.warn('Auto print triggered error', e);
        }
      }, 350);
    });
  </script>
</body>
</html>`;
};

/**
 * Executes A4 document printing via multiple fallback mechanisms:
 * 1. Open dedicated print popup/tab with auto-print and print toolbar
 * 2. Fallback to hidden iframe print
 * 3. Fallback to direct window.print()
 */
export const printOfficialLetter = (elementId: string = 'official-letter-sheet', docTitle: string = 'Surat_Pengantar_RT004_RW007'): boolean => {
  const element = document.getElementById(elementId);
  const elementHtml = element
    ? `<div style="${element.getAttribute('style') || ''}">${element.innerHTML}</div>`
    : '';

  if (!elementHtml) {
    window.print();
    return false;
  }

  const fullHtml = buildPrintableHtml(elementHtml, docTitle);

  // Strategy 1: Open dedicated print window (Most reliable across all browsers & iframe restrictions)
  try {
    const printWindow = window.open('', '_blank', 'width=900,height=1000,scrollbars=yes,status=no,location=no');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(fullHtml);
      printWindow.document.close();
      return true;
    }
  } catch (err) {
    console.warn('window.open blocked, trying hidden iframe...', err);
  }

  // Strategy 2: Hidden iframe printing
  try {
    const existingFrame = document.getElementById('print-isolation-frame');
    if (existingFrame && existingFrame.parentNode) {
      existingFrame.parentNode.removeChild(existingFrame);
    }

    const printFrame = document.createElement('iframe');
    printFrame.id = 'print-isolation-frame';
    printFrame.name = 'print_isolation_frame';
    printFrame.style.position = 'fixed';
    printFrame.style.top = '-9999px';
    printFrame.style.left = '-9999px';
    printFrame.style.width = '210mm';
    printFrame.style.height = '297mm';
    printFrame.style.border = '0';
    document.body.appendChild(printFrame);

    const frameDoc = printFrame.contentWindow?.document;
    if (frameDoc) {
      frameDoc.open();
      frameDoc.write(fullHtml);
      frameDoc.close();

      setTimeout(() => {
        try {
          printFrame.contentWindow?.focus();
          printFrame.contentWindow?.print();
        } catch (e) {
          window.print();
        }
      }, 400);
      return true;
    }
  } catch (err) {
    console.warn('Iframe print error, falling back to direct window.print()', err);
  }

  // Strategy 3: Standard window.print()
  window.print();
  return true;
};

/**
 * Exports the letter as a Microsoft Word compatible (.doc) file
 * Can be opened in MS Word, WordPad, or LibreOffice and printed directly.
 */
export const exportLetterToWord = (data: LetterDocumentData, filename: string = 'Surat_Pengantar_RT004.doc') => {
  const fontFamily = data.fontFamily || 'Arial';
  const bodyFontSize = data.bodyFontSizePt || 10;
  const kopFontSize = data.kopFontSizePt || 12;
  const titleFontSize = data.titleFontSizePt || 12;
  const lineHeight = data.lineHeight || 1.35;
  const rowSpacing = data.rowSpacingPt ?? 2;
  const sectionSpacing = data.sectionSpacingPt || 12;
  const signatureSpace = data.signatureSpacePt || 60;
  const content = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset="utf-8">
      <title>${data.judulSurat || 'Surat Pengantar'}</title>
      <style>
        @page Section1 {
          size: 595.3pt 841.9pt; /* A4 size */
          margin: 42.5pt 56.7pt 42.5pt 56.7pt; /* 1.5cm top/bottom, 2cm left/right */
          mso-header-margin: 35.4pt;
          mso-footer-margin: 35.4pt;
          mso-paper-source: 0;
        }
        div.Section1 { page: Section1; }
        body {
          font-family: "${fontFamily}", Arial, Helvetica, sans-serif;
          font-size: ${bodyFontSize}pt;
          line-height: ${lineHeight};
          color: #000000;
        }
        .header-title {
          text-align: center;
          font-weight: bold;
          font-size: ${kopFontSize}pt;
          margin: 0;
          padding: 0;
          text-transform: uppercase;
        }
        .header-sub {
          text-align: center;
          font-size: ${Math.max(8, kopFontSize - 2)}pt;
          margin: 0;
          padding: 0;
        }
        .line-divider {
          border-bottom: 2px solid #000000;
          margin-top: 6pt;
          margin-bottom: ${sectionSpacing}pt;
        }
        .letter-title {
          text-align: center;
          font-weight: bold;
          font-size: ${titleFontSize}pt;
          text-decoration: underline;
          margin-bottom: 2pt;
        }
        .letter-no {
          text-align: center;
          font-size: ${bodyFontSize}pt;
          margin-bottom: ${sectionSpacing}pt;
        }
        .field-table {
          width: 100%;
          border-collapse: collapse;
          margin-left: 20pt;
          margin-bottom: ${sectionSpacing}pt;
        }
        .field-table td {
          vertical-align: top;
          padding: ${rowSpacing / 2}pt 0;
          font-size: ${bodyFontSize}pt;
        }
        .col-label { width: 140pt; }
        .col-sep { width: 15pt; text-align: center; }
        .col-val { width: auto; font-weight: normal; }
        .ttd-table {
          width: 100%;
          margin-top: ${sectionSpacing}pt;
          border-collapse: collapse;
        }
        .ttd-table td {
          vertical-align: top;
          text-align: center;
          font-size: ${bodyFontSize}pt;
        }
      </style>
    </head>
    <body>
      <div class="Section1">
        <!-- HEADER KOP -->
        <p class="header-title">${data.kopInstansiAtas || 'PEMERINTAHAN KABUPATEN BEKASI'}</p>
        <p class="header-title" style="font-size: ${kopFontSize + 1}pt;">${data.kopTeksRT || 'RT 004 RW 007'}</p>
        <p class="header-title" style="font-size: ${Math.max(8, kopFontSize - 1)}pt;">${data.kopKelurahan || 'KELURAHAN JATIMULYA'}</p>
        <p class="header-title" style="font-size: ${Math.max(8, kopFontSize - 1)}pt;">${data.kopKecamatan || 'KECAMATAN TAMBUN SELATAN'}</p>
        <p class="header-sub">${data.kopSekretariatText || 'Sekretariat : jl jampang no 111 jatimulya tlp 0896-7720-3444'}</p>
        
        <div class="line-divider"></div>

        <!-- JUDUL SURAT -->
        <p class="letter-title">${data.judulSurat || 'SURAT PENGANTAR'}</p>
        <p class="letter-no">NO : ${data.nomorSurat || '185 / RT 004 RW 007 / SP / 2026'}</p>

        <!-- KALIMAT PEMBUKA -->
        <p style="text-align: justify; margin-bottom: ${sectionSpacing}pt;">
          ${data.kalimatPembuka || 'Yang Bertanda Tangan Dibawah Ini Ketua Rt 004 Rw 007 Kelurahan Jatimulya, Menerangkan Bahwa :'}
        </p>

        <!-- DATA WARGA / PEMOHON -->
        <table class="field-table">
          <tr>
            <td class="col-label">Nama</td>
            <td class="col-sep">:</td>
            <td class="col-val"><b>${data.namaPemohon || '-'}</b></td>
          </tr>
          <tr>
            <td class="col-label">Tempat Tgl Lahir</td>
            <td class="col-sep">:</td>
            <td class="col-val">${data.tempatTglLahir || '-'}</td>
          </tr>
          <tr>
            <td class="col-label">Jenis Kelamin</td>
            <td class="col-sep">:</td>
            <td class="col-val">${data.jenisKelamin || '-'}</td>
          </tr>
          <tr>
            <td class="col-label">Status Perkawinan</td>
            <td class="col-sep">:</td>
            <td class="col-val">${data.statusKawin || '-'}</td>
          </tr>
          <tr>
            <td class="col-label">Agama</td>
            <td class="col-sep">:</td>
            <td class="col-val">${data.agama || '-'}</td>
          </tr>
          <tr>
            <td class="col-label">No Ktp / No Nik</td>
            <td class="col-sep">:</td>
            <td class="col-val">${data.nikPemohon || '-'}</td>
          </tr>
          <tr>
            <td class="col-label">Pekerjaan</td>
            <td class="col-sep">:</td>
            <td class="col-val">${data.pekerjaan || '-'}</td>
          </tr>
          <tr>
            <td class="col-label">Telepon / Hp</td>
            <td class="col-sep">:</td>
            <td class="col-val">${data.telepon || '-'}</td>
          </tr>
          <tr>
            <td class="col-label">Alamat Lengkap</td>
            <td class="col-sep">:</td>
            <td class="col-val">${data.alamatBaris1 || '-'}</td>
          </tr>
          ${data.alamatBaris2 ? `
          <tr>
            <td class="col-label"></td>
            <td class="col-sep">:</td>
            <td class="col-val">${data.alamatBaris2}</td>
          </tr>
          ` : ''}
          <tr>
            <td class="col-label">Keperluan</td>
            <td class="col-sep">:</td>
            <td class="col-val">${data.keperluan1 || '-'}</td>
          </tr>
          ${data.keperluan2 ? `
          <tr>
            <td class="col-label"></td>
            <td class="col-sep">:</td>
            <td class="col-val">${data.keperluan2}</td>
          </tr>
          ` : ''}
        </table>

        <!-- KALIMAT PENUTUP -->
        <p style="text-align: justify; margin-bottom: ${sectionSpacing}pt;">
          ${data.kalimatPenutup || 'Benar Bahwa Yang Bersangkutan Adalah Warga Kami , Demikian Surat- Pengantar Ini dibuat untuk dapat dipergunakan sebagaimana mestinya.'}
        </p>

        <!-- TANDA TANGAN -->
        <table class="ttd-table">
          <tr>
            <td style="width: 50%;">
              <p style="margin-bottom: 2pt;">${data.lokasiSurat || 'Jatimulya'} ${data.tanggalSurat || ''}</p>
              <p style="font-weight: bold; margin-bottom: ${signatureSpace}pt;">Ketua Rt 004 Rw 007</p>
              <p style="font-weight: bold; text-decoration: underline;">${data.namaKetuaRT || 'Yanto'}</p>
            </td>
            <td style="width: 50%;">
              <p style="margin-bottom: 2pt;">Mengetahui</p>
              <p style="font-weight: bold; margin-bottom: ${signatureSpace}pt;">Ketua Rw 007</p>
              <p style="font-weight: bold; text-decoration: underline;">${data.namaKetuaRW || 'Imron Rosadi'}</p>
            </td>
          </tr>
        </table>
      </div>
    </body>
    </html>
  `;

  const blob = new Blob(['\ufeff', content], {
    type: 'application/msword;charset=utf-8'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Downloads a standalone, self-printing HTML file that can be opened in any browser
 */
export const downloadLetterHtml = (elementId: string = 'official-letter-sheet', filename: string = 'Surat_Pengantar_A4.html') => {
  const element = document.getElementById(elementId);
  if (!element) return;

  const elementHtml = `<div style="${element.getAttribute('style') || ''}">${element.innerHTML}</div>`;
  const fullHtml = buildPrintableHtml(elementHtml, filename.replace('.html', ''));
  const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
