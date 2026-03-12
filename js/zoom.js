/**
 * السبورة الذكية - التكبير والتصغير
 * Smart Whiteboard - Zoom & Transform
 */

function applyTransform(page) {
    if (!page || !page.element) return;

    page.element.style.transformOrigin = 'top center';
    page.element.style.transform       = `scale(${page.scale})`;

    // تعويض الارتفاع: CSS transform لا يؤثر على layout
    const baseH   = page.canvas ? page.canvas.height : 1131;
    const scaledH = baseH * page.scale;
    page.element.style.marginBottom = `${Math.max(0, scaledH - baseH)}px`;

    // تعويض العرض أفقياً: نضيف padding على .cont_pags بحيث يمكن الـ scroll لليسار
    const baseW   = page.canvas ? page.canvas.width : 800;
    const scaledW = baseW * page.scale;
    const area    = document.querySelector('.canvas-area');
    if (area) {
        const contPags = area.querySelector('.cont_pags');
        if (contPags) {
            // نحسب كم يحتاج المحتوى من padding جانبي حتى يكون قابلاً للـ scroll الكامل
            const sidePad = Math.max(30, (scaledW - baseW) / 2 + 30);
            contPags.style.paddingLeft  = `${sidePad}px`;
            contPags.style.paddingRight = `${sidePad}px`;
        }
    }

    updateZoomPercentageDisplay();
}

function zoomIn() {
    const page = pages[currentPage];
    if (!page) return;
    page.scale = Math.min(page.scale * 1.2, 5);
    applyTransform(page);
}

function zoomOut() {
    const page = pages[currentPage];
    if (!page) return;
    page.scale = Math.max(page.scale / 1.2, 0.2);
    applyTransform(page);
}

function updateZoomPercentageDisplay() {
    const page = pages[currentPage];
    if (page && zoomPercentageSpan) {
        zoomPercentageSpan.textContent = `${Math.round(page.scale * 100)}%`;
    }
}
