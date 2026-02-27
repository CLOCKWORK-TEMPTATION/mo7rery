import { jsPDF } from "jspdf";
import { type ExportRequest, sanitizeExportFileBaseName } from "./shared";

export const exportAsPdf = async (request: ExportRequest): Promise<void> => {
  const fileBase = sanitizeExportFileBaseName(request.fileNameBase);
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-10000px";
  container.style.top = "0";
  container.style.width = "794px";
  container.style.background = "#fff";
  container.style.direction = "rtl";
  container.style.padding = "24px";
  container.innerHTML = request.html;
  document.body.appendChild(container);

  try {
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "pt",
      format: "a4",
      compress: true,
    });
    pdf.setR2L(true);

    await pdf.html(container, {
      x: 24,
      y: 24,
      margin: [24, 24, 24, 24],
      autoPaging: "text",
      width: 547,
      windowWidth: 794,
      html2canvas: {
        scale: 1.2,
      },
    });

    pdf.save(`${fileBase}.pdf`);
  } finally {
    container.remove();
  }
};
