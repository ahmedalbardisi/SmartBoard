/**
 * السبورة الذكية - التكبير والتصغير
 * Smart Whiteboard - Zoom & Transform
 *
 * المبدأ:
 * - transform-origin: top left  (ثابت دائماً)
 * - الـ scale يتمدد من الزاوية العلوية اليسرى
 * - التوسيط يتم عبر scrollLeft فقط لا عبر transform
 * - كل دالة zoom تُعيد ضبط الـ scroll لتبقى نقطة التركيز ثابتة
 */

/**
 * تطبيق الـ scale على الورقة وتعويض الـ layout
 * لا تُغيّر scrollLeft/scrollTop — ذلك مسؤولية المُستدعي
 */
function applyTransform(page) {
    if (!page || !page.element) return;

    page.element.style.transformOrigin = 'top left';
    page.element.style.transform       = `scale(${page.scale})`;

    // تعويض الارتفاع (CSS transform لا يؤثر على layout)
    const baseH = page.canvas ? page.canvas.height : 1131;
    const baseW = page.canvas ? page.canvas.width  : 800;
    page.element.style.marginBottom = `${Math.max(0, baseH * (page.scale - 1))}px`;
    page.element.style.marginRight  = `${Math.max(0, baseW * (page.scale - 1))}px`;

    updateZoomPercentageDisplay();
}

/**
 * تكبير حول مركز منطقة العرض الحالية
 */
function zoomIn() {
    const page = pages[currentPage];
    if (!page) return;
    _zoomAround(page, page.scale * 1.2, null, null);
}

/**
 * تصغير حول مركز منطقة العرض الحالية
 */
function zoomOut() {
    const page = pages[currentPage];
    if (!page) return;
    _zoomAround(page, page.scale / 1.2, null, null);
}

/**
 * تكبير/تصغير حول نقطة بعينها (clientX, clientY)
 * إذا كانت null يستخدم مركز الحاوية
 *
 * @param {object} page
 * @param {number} newScale
 * @param {number|null} clientX  - موقع نقطة التركيز (إحداثيات المتصفح)
 * @param {number|null} clientY
 */
function _zoomAround(page, newScale, clientX, clientY) {
    newScale = Math.max(0.2, Math.min(newScale, 5));
    if (!page) return;

    const area = document.querySelector('.canvas-area');
    if (!area) {
        page.scale = newScale;
        applyTransform(page);
        return;
    }

    const rect     = area.getBoundingClientRect();
    const focusX   = (clientX !== null) ? clientX - rect.left : rect.width  / 2;
    const focusY   = (clientY !== null) ? clientY - rect.top  : rect.height / 2;

    // نقطة التركيز بإحداثيات المحتوى (قبل التكبير)
    const contentX = (area.scrollLeft + focusX) / page.scale;
    const contentY = (area.scrollTop  + focusY) / page.scale;

    const oldScale = page.scale;
    page.scale     = newScale;
    applyTransform(page);

    // اضبط scroll بعد applyTransform حتى تبقى نقطة التركيز في مكانها
    area.scrollLeft = contentX * newScale - focusX;
    area.scrollTop  = contentY * newScale - focusY;
}

/**
 * تصدير للاستخدام من viewport-lock.js
 */
window._zoomAround = _zoomAround;

function updateZoomPercentageDisplay() {
    const page = pages[currentPage];
    if (page && zoomPercentageSpan) {
        zoomPercentageSpan.textContent = `${Math.round(page.scale * 100)}%`;
    }
}
