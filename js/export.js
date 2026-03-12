/**
 * السبورة الذكية - التصدير والحفظ
 * Smart Whiteboard - Export & Save
 */

// -------------------- رسم نمط الخلفية على canvas مؤقت --------------------

/**
 * يُنشئ OffscreenCanvas يحتوي على خلفية الصفحة + رسوماتها مدموجتين معاً.
 * الخلفيات في التطبيق هي CSS فقط ولا تُصدَّر بـ toDataURL،
 * لذا نرسمها يدوياً هنا قبل التصدير.
 *
 * @param {HTMLCanvasElement} srcCanvas  - canvas الصفحة الأصلي
 * @param {string}            bgPattern - 'dots' | 'lines' | 'grid' | 'plain'
 * @param {boolean}           isDark    - هل الوضع الداكن مفعّل؟
 * @returns {HTMLCanvasElement}          - canvas مؤقت جاهز للتصدير
 */
function _buildExportCanvas(srcCanvas, bgPattern, isDark) {
    const w   = srcCanvas.width;
    const h   = srcCanvas.height;

    // canvas مؤقت بنفس الأبعاد
    const tmp = document.createElement('canvas');
    tmp.width  = w;
    tmp.height = h;
    const ctx  = tmp.getContext('2d');

    // 1) خلفية بيضاء صلبة دائماً (بديل لـ CSS background-color)
    ctx.fillStyle = isDark ? '#1e1e2e' : '#ffffff';
    ctx.fillRect(0, 0, w, h);

    // 2) رسم نمط الخلفية
    if (bgPattern && bgPattern !== 'plain') {
        _drawBgPattern(ctx, w, h, bgPattern, isDark);
    }

    // 3) رسم محتوى الصفحة الأصلي فوق الخلفية
    ctx.drawImage(srcCanvas, 0, 0);

    return tmp;
}

/**
 * يرسم نمط النقاط أو الخطوط أو الشبكة داخل ctx
 */
function _drawBgPattern(ctx, w, h, pattern, isDark) {
    const step       = 20;
    const dotColor   = isDark ? 'rgba(255,255,255,0.18)' : '#b0b0b0';
    const lineColor  = isDark ? 'rgba(255,255,255,0.15)' : '#e0e0e0';

    ctx.save();

    if (pattern === 'dots') {
        // نقاط بنصف قطر 1px كل 20px
        ctx.fillStyle = dotColor;
        for (let x = 0; x <= w; x += step) {
            for (let y = 0; y <= h; y += step) {
                ctx.beginPath();
                ctx.arc(x, y, 1, 0, Math.PI * 2);
                ctx.fill();
            }
        }

    } else if (pattern === 'lines') {
        // خطوط أفقية كل 20px
        ctx.strokeStyle = lineColor;
        ctx.lineWidth   = 1;
        for (let y = step; y < h; y += step) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }

    } else if (pattern === 'grid') {
        // شبكة أفقية وعمودية كل 20px
        ctx.strokeStyle = lineColor;
        ctx.lineWidth   = 1;
        for (let y = step; y < h; y += step) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }
        for (let x = step; x < w; x += step) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
        }
    }

    ctx.restore();
}

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
        alert('حدث خطأ: لا يمكن العثور على بيانات الصفحة لإنشاء PDF.');
        return;
    }

    // دمج أي صور معلقة في جميع الصفحات قبل التصدير
    if (typeof flattenAllPagesBeforeExport === 'function') {
        flattenAllPagesBeforeExport();
    }

    // قراءة نمط الخلفية الحالي والوضع الداكن
    const bgPattern = bgTypeSelect ? bgTypeSelect.value : 'plain';
    const isDark    = document.body.classList.contains('dark-mode');

    const { jsPDF } = jspdf;
    const pdf = new jsPDF({
        orientation: 'p',
        unit:        'px',
        format:      [pages[0].canvas.width, pages[0].canvas.height]
    });

    const pdfFileNameInput = document.getElementById('file-name');
    const pdfFileName = (pdfFileNameInput ? pdfFileNameInput.value.trim() : '') || 'السبورة الذكية';

    try {
        for (let i = 0; i < pages.length; i++) {
            const pageData = pages[i];
            if (!pageData || !pageData.canvas) {
                console.error(`بيانات الصفحة ${i + 1} غير موجودة، تخطّي.`);
                continue;
            }

            // بناء canvas مؤقت يدمج الخلفية + الرسومات
            const exportCanvas = _buildExportCanvas(pageData.canvas, bgPattern, isDark);
            const imgData      = exportCanvas.toDataURL('image/png');

            if (i > 0) pdf.addPage([pageData.canvas.width, pageData.canvas.height], 'p');

            pdf.addImage(imgData, 'PNG', 0, 0, pageData.canvas.width, pageData.canvas.height);
            console.log(`تمت إضافة الصفحة ${i + 1} إلى PDF`);

            await new Promise(resolve => setTimeout(resolve, 30));
        }

        pdf.save(`${pdfFileName}.pdf`);
        alert(`تم حفظ الملف "${pdfFileName}.pdf" بنجاح!`);

    } catch (error) {
        console.error('خطأ أثناء إنشاء PDF:', error);
        alert('حدث خطأ أثناء حفظ الملف كـ PDF.');
    }
}

