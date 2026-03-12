/**
 * السبورة الذكية - قفل Viewport ومنع تدخل المتصفح
 * Smart Whiteboard - Viewport Lock & Browser Interference Prevention
 *
 * يحل المشاكل التالية:
 * ① Pinch-to-zoom للمتصفح  → ممنوع كلياً، الـ pinch يعمل فقط على الورقة
 * ② Pull-to-refresh         → ممنوع تماماً
 * ③ Ctrl+= / Ctrl+-         → يُكبّر/يُصغّر الورقة فقط
 * ④ Ctrl+0                  → يُعيد zoom الورقة إلى 100%
 * ⑤ wheel + Ctrl            → zoom الورقة حول موقع المؤشر
 * ⑥ أداة Pan (اليد)         → scroll داخل .canvas-area بشكل طبيعي
 */

(function () {
    'use strict';

    // =========================================================
    // ① منع Pinch-to-zoom في المتصفح على مستوى document
    // =========================================================

    document.addEventListener('touchstart', function (e) {
        if (e.touches.length > 1) e.preventDefault();
    }, { passive: false });

    document.addEventListener('touchmove', function (e) {
        if (e.touches.length > 1) e.preventDefault();
    }, { passive: false });

    // Safari gesture events
    document.addEventListener('gesturestart',  function (e) { e.preventDefault(); }, { passive: false });
    document.addEventListener('gesturechange', function (e) { e.preventDefault(); }, { passive: false });
    document.addEventListener('gestureend',    function (e) { e.preventDefault(); }, { passive: false });

    // =========================================================
    // ② منع Pull-to-refresh
    // =========================================================

    let _pullStartY = 0;

    document.addEventListener('touchstart', function (e) {
        if (e.touches.length === 1) _pullStartY = e.touches[0].clientY;
    }, { passive: true });

    document.addEventListener('touchmove', function (e) {
        if (e.touches.length !== 1) return;
        const dy = e.touches[0].clientY - _pullStartY;
        // إذا كنا في أعلى الصفحة والإصبع يتحرك للأسفل → pull-to-refresh محتمل
        if (document.documentElement.scrollTop === 0 && dy > 0) {
            e.preventDefault();
        }
    }, { passive: false });

    // =========================================================
    // ③ + ④ Ctrl+= / Ctrl+- / Ctrl+0 → تكبير/تصغير الورقة فقط
    // =========================================================

    document.addEventListener('keydown', function (e) {
        const isCtrl = e.ctrlKey || e.metaKey;
        if (!isCtrl) return;

        switch (e.key) {
            case '=': case '+':
                e.preventDefault();
                if (typeof zoomIn === 'function') zoomIn();
                break;
            case '-': case '_':
                e.preventDefault();
                if (typeof zoomOut === 'function') zoomOut();
                break;
            case '0':
                e.preventDefault();
                _resetZoom();
                break;
        }
    });

    function _resetZoom() {
        if (typeof pages === 'undefined' || typeof currentPage === 'undefined') return;
        const page = pages[currentPage];
        if (!page) return;
        page.scale = 1;
        if (typeof applyTransform === 'function') applyTransform(page);
        // إعادة scroll للمنتصف
        const area = document.querySelector('.canvas-area');
        if (area) {
            area.scrollLeft = (area.scrollWidth  - area.clientWidth)  / 2;
            area.scrollTop  = 0;
        }
    }

    // =========================================================
    // ⑤ عجلة الماوس + Ctrl → zoom الورقة حول موقع المؤشر
    // =========================================================

    document.addEventListener('wheel', function (e) {
        if (!e.ctrlKey && !e.metaKey) return;
        e.preventDefault();

        if (typeof pages === 'undefined' || typeof currentPage === 'undefined') return;
        const page = pages[currentPage];
        if (!page) return;

        const area = document.querySelector('.canvas-area');
        if (!area) return;
        const rect = area.getBoundingClientRect();

        // موقع المؤشر نسبةً لحاوية الـ scroll
        const mouseX = e.clientX - rect.left + area.scrollLeft;
        const mouseY = e.clientY - rect.top  + area.scrollTop;

        const oldScale = page.scale;
        const factor   = e.deltaY < 0 ? 1.1 : 0.9;
        const newScale = Math.max(0.2, Math.min(oldScale * factor, 5));

        page.scale = newScale;
        if (typeof applyTransform === 'function') applyTransform(page);

        // اضبط scroll حتى يبقى المؤشر فوق نفس النقطة على الورقة
        const scaleRatio   = newScale / oldScale;
        area.scrollLeft    = mouseX * scaleRatio - (e.clientX - rect.left);
        area.scrollTop     = mouseY * scaleRatio - (e.clientY - rect.top);

    }, { passive: false });

    // =========================================================
    // ⑥ أداة Pan → scroll داخل .canvas-area (ماوس ولمس)
    // =========================================================

    window.addEventListener('load', function () {
        const area = document.querySelector('.canvas-area');
        if (!area) return;

        // تأكد من أن الحاوية scrollable
        area.style.overflowX       = 'auto';
        area.style.overflowY       = 'auto';
        area.style.overscrollBehavior = 'none';

        // --- Pan بالماوس ---
        let _mp = false, _mx = 0, _my = 0, _sx = 0, _sy = 0;

        area.addEventListener('mousedown', function (e) {
            const isPan   = typeof currentTool !== 'undefined' && currentTool === 'pan';
            const isMid   = e.button === 1;
            if (!isPan && !isMid) return;

            e.preventDefault();
            _mp = true;
            _mx = e.clientX; _my = e.clientY;
            _sx = area.scrollLeft; _sy = area.scrollTop;
            area.style.cursor = 'grabbing';
        });

        window.addEventListener('mousemove', function (e) {
            if (!_mp) return;
            area.scrollLeft = _sx - (e.clientX - _mx);
            area.scrollTop  = _sy - (e.clientY - _my);
        });

        window.addEventListener('mouseup', function () {
            if (!_mp) return;
            _mp = false;
            area.style.cursor = '';
        });

        // --- Pan باللمس (إصبع واحد في وضع Pan) ---
        let _tp = false, _tx = 0, _ty = 0, _tsx = 0, _tsy = 0;

        area.addEventListener('touchstart', function (e) {
            const isPan = typeof currentTool !== 'undefined' && currentTool === 'pan';
            if (!isPan || e.touches.length !== 1) return;

            e.preventDefault();
            _tp  = true;
            _tx  = e.touches[0].clientX; _ty  = e.touches[0].clientY;
            _tsx = area.scrollLeft;       _tsy = area.scrollTop;
        }, { passive: false });

        area.addEventListener('touchmove', function (e) {
            if (!_tp) return;
            e.preventDefault();
            area.scrollLeft = _tsx - (e.touches[0].clientX - _tx);
            area.scrollTop  = _tsy - (e.touches[0].clientY - _ty);
        }, { passive: false });

        area.addEventListener('touchend',    function () { _tp = false; });
        area.addEventListener('touchcancel', function () { _tp = false; });

        // Pinch-to-zoom داخل الحاوية (إصبعان)
        let _pinchActive = false;
        let _pinchDist   = 0;
        let _pinchScale  = 1;
        let _pinchCX     = 0, _pinchCY = 0;

        area.addEventListener('touchstart', function (e) {
            if (e.touches.length !== 2) return;
            e.preventDefault();
            _tp = false; // إلغاء Pan إذا كان شغالاً

            const t1 = e.touches[0], t2 = e.touches[1];
            _pinchActive = true;
            _pinchDist   = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
            _pinchScale  = (typeof pages !== 'undefined' && pages[currentPage]) ? pages[currentPage].scale : 1;
            _pinchCX     = (t1.clientX + t2.clientX) / 2;
            _pinchCY     = (t1.clientY + t2.clientY) / 2;
        }, { passive: false });

        area.addEventListener('touchmove', function (e) {
            if (!_pinchActive || e.touches.length !== 2) return;
            e.preventDefault();

            const page = (typeof pages !== 'undefined') ? pages[currentPage] : null;
            if (!page) return;

            const t1   = e.touches[0], t2 = e.touches[1];
            const dist  = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
            const factor = dist / _pinchDist;
            const rect   = area.getBoundingClientRect();

            const oldScale = page.scale;
            page.scale     = Math.max(0.2, Math.min(_pinchScale * factor, 5));

            if (typeof applyTransform === 'function') applyTransform(page);

            // اضبط scroll حتى يبقى مركز الـ pinch ثابتاً
            const scaleRatio = page.scale / oldScale;
            const cx = _pinchCX - rect.left + area.scrollLeft;
            const cy = _pinchCY - rect.top  + area.scrollTop;
            area.scrollLeft = cx * scaleRatio - (_pinchCX - rect.left);
            area.scrollTop  = cy * scaleRatio - (_pinchCY - rect.top);

        }, { passive: false });

        area.addEventListener('touchend', function (e) {
            if (e.touches.length < 2) _pinchActive = false;
        });
        area.addEventListener('touchcancel', function () { _pinchActive = false; });

        console.log('viewport-lock: جاهز');
    });

})();
