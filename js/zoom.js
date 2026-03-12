/**
 * السبورة الذكية - التكبير والتصغير
 * Smart Whiteboard - Zoom & Transform
 *
 * المبدأ:
 * - transform-origin: top left  (ثابت دائماً)
 * - scale يتمدد من الزاوية العلوية اليسرى
 * - التوسيط والتنقل عبر scrollLeft/scrollTop فقط
 * - marginBottom + marginRight يعوّضان غياب layout من CSS transform
 */

/**
 * تطبيق الـ scale على الورقة وتعويض الـ layout.
 * لا تُعدِّل scrollLeft/scrollTop — ذلك مسؤولية المُستدعي.
 */
function applyTransform(page) {
    if (!page || !page.element) return;

    page.element.style.transformOrigin = 'top left';
    page.element.style.transform       = `scale(${page.scale})`;

    const baseH = page.canvas ? page.canvas.height : 1131;
    const baseW = page.canvas ? page.canvas.width  : 800;

    // تعويض layout: CSS transform لا تؤثر على document flow
    page.element.style.marginBottom = `${Math.max(0, baseH * (page.scale - 1))}px`;
    page.element.style.marginRight  = `${Math.max(0, baseW * (page.scale - 1))}px`;

    updateZoomPercentageDisplay();
}

/**
 * تكبير حول مركز الحاوية
 */
function zoomIn() {
    const page = pages[currentPage];
    if (!page) return;
    if (typeof window._zoomAt === 'function') {
        window._zoomAt(page.scale * 1.2, null, null);
    } else {
        page.scale = Math.min(page.scale * 1.2, 5);
        applyTransform(page);
    }
}

/**
 * تصغير حول مركز الحاوية
 */
function zoomOut() {
    const page = pages[currentPage];
    if (!page) return;
    if (typeof window._zoomAt === 'function') {
        window._zoomAt(page.scale / 1.2, null, null);
    } else {
        page.scale = Math.max(page.scale / 1.2, 0.2);
        applyTransform(page);
    }
}

function updateZoomPercentageDisplay() {
    const page = pages[currentPage];
    if (page && zoomPercentageSpan) {
        zoomPercentageSpan.textContent = `${Math.round(page.scale * 100)}%`;
    }
}
