/**
 * السبورة الذكية - التكبير والتصغير
 * Smart Whiteboard - Zoom & Transform
 *
 * الفلسفة الجديدة:
 * - applyTransform تضبط CSS transform للـ page.element بناءً على scale فقط
 *   (translateX/Y أُلغيا — التنقل يتم الآن عبر scrollLeft/scrollTop في .canvas-area)
 * - transform-origin = "top center" حتى يتمدد الـ scale من المركز العلوي
 * - نحدّث أيضاً الحاوية المرئية (.cont_pags) لتحتوي المساحة الصحيحة بعد الـ scale
 */

// -------------------- تطبيق التحويل (Apply Transform) --------------------

function applyTransform(page) {
    if (!page || !page.element) return;

    // نستخدم scale فقط — translateX/Y انتقلا إلى scrollLeft/scrollTop
    page.element.style.transformOrigin = 'top center';
    page.element.style.transform       = `scale(${page.scale})`;

    // نحدّث margin-bottom وهمي حتى تحسب الحاوية الارتفاع الصحيح بعد التكبير
    // (CSS transform لا يؤثر على layout، لذا نعوّض يدوياً)
    const baseH  = page.canvas ? page.canvas.height : 1131;
    const scaledH = baseH * page.scale;
    const extra   = scaledH - baseH; // الزيادة أو النقصان عن الارتفاع الأصلي
    page.element.style.marginBottom = `${Math.max(0, extra)}px`;

    updateZoomPercentageDisplay();
}

// -------------------- تكبير (Zoom In) --------------------

function zoomIn() {
    const page = pages[currentPage];
    if (!page) return;
    page.scale = Math.min(page.scale * 1.2, 5);
    applyTransform(page);
}

// -------------------- تصغير (Zoom Out) --------------------

function zoomOut() {
    const page = pages[currentPage];
    if (!page) return;
    page.scale = Math.max(page.scale / 1.2, 0.2);
    applyTransform(page);
}

// -------------------- تحديث عرض النسبة (Update Display) --------------------

function updateZoomPercentageDisplay() {
    const page = pages[currentPage];
    if (page && zoomPercentageSpan) {
        zoomPercentageSpan.textContent = `${Math.round(page.scale * 100)}%`;
    }
}
