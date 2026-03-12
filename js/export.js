/**
 * السبورة الذكية - التصدير والحفظ
 * Smart Whiteboard - Export & Save
 */

// -------------------- حفظ كـ PDF (Save as PDF) --------------------

async function saveAsPdf() {
    if (typeof html2canvas === 'undefined' || typeof jspdf === 'undefined') {
        alert('خطأ: مكتبات PDF غير محملة.');
        console.error('html2canvas or jspdf not loaded');
        return;
    }
    if (pages.length === 0) {
        alert('لا يوجد صفحات للحفظ.');
        return;
    }
    if (!pages[0] || !pages[0].canvas) {
        console.error("First page or its canvas not found. Cannot create PDF.");
        alert('حدث خطأ: لا يمكن العثور على بيانات الصفحة لإنشاء PDF.');
        return;
    }

    const { jsPDF } = jspdf;
    const pdf = new jsPDF({
        orientation: 'p',
        unit: 'px',
        format: [pages[0].canvas.width, pages[0].canvas.height]
    });

    const pdfFileNameInput = document.getElementById('file-name');
    const pdfFileName = (pdfFileNameInput ? pdfFileNameInput.value : '') || 'السبورة الذكية';

    // دمج أي صور معلقة في جميع الصفحات قبل التصدير
    if (typeof flattenAllPagesBeforeExport === 'function') {
        flattenAllPagesBeforeExport();
    }

    try {
        for (let i = 0; i < pages.length; i++) {
            const pageData = pages[i];
            if (!pageData || !pageData.canvas) {
                console.error(`Page data or canvas not found for page index ${i}. Skipping.`);
                continue;
            }

            const imgData = pageData.canvas.toDataURL('image/png');

            if (i > 0) pdf.addPage([pageData.canvas.width, pageData.canvas.height], 'p');

            pdf.addImage(imgData, 'PNG', 0, 0, pageData.canvas.width, pageData.canvas.height);
            console.log(`تمت إضافة الصفحة ${i + 1} إلى PDF`);

            await new Promise(resolve => setTimeout(resolve, 50));
        }

        pdf.save(`${pdfFileName}.pdf`);
        console.log(`تم حفظ الملف ${pdfFileName}.pdf`);
        alert(`تم حفظ الملف ${pdfFileName}.pdf بنجاح!`);

    } catch (error) {
        console.error('حدث خطأ أثناء إنشاء ملف PDF:', error);
        alert('حدث خطأ أثناء حفظ الملف كـ PDF.');
    }
}
