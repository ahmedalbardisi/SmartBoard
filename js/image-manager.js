/**
 * السبورة الذكية - إدارة الصور (مع دعم كامل للمس)
 * Smart Whiteboard - Image Manager (Full Touch Support)
 *
 * الميزات:
 * ✔ إدراج صورة من الجهاز          (file upload)
 * ✔ لصق صورة من الحافظة           (Ctrl+V / paste)
 * ✔ سحب وإفلات صورة               (drag & drop)
 * ✔ تحريك الصورة  - ماوس ولمس     (drag to move)
 * ✔ تغيير الحجم   - ماوس ولمس     (resize handles)
 * ✔ تكبير/تصغير بإصبعين            (pinch-to-zoom)
 * ✔ حذف الصورة                     (زر X / مفتاح Delete)
 * ✔ دمج الصورة في اللوحة           (flatten on deselect/tool-change)
 */

// ===================================================================
// 1. الحالة العامة
// ===================================================================

let activeImage    = null;
let imgDragState   = null;
let imgResizeState = null;
let imgPinchState  = null;

const HANDLE_SIZE   = 22;
const HANDLE_HIT    = 30;
const DELETE_RADIUS = 16;
const MIN_IMG_SIZE  = 40;

const _listenedPages = new Set();

// ===================================================================
// 2. طبقة الصور
// ===================================================================

function getImageLayer(page) {
    if (page.imageCanvas) return page.imageCanvas;

    const overlay      = document.createElement('canvas');
    overlay.width      = page.canvas.width;
    overlay.height     = page.canvas.height;
    overlay.className  = 'image-overlay-canvas';
    overlay.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:5;touch-action:none;';

    page.element.appendChild(overlay);
    page.imageCanvas = overlay;
    page.imageCtx    = overlay.getContext('2d');
    page.images      = page.images || [];
    return overlay;
}

// ===================================================================
// 3. الرسم
// ===================================================================

function redrawImageLayer(pageIndex) {
    const page = pages[pageIndex];
    if (!page) return;
    getImageLayer(page);

    const ctx = page.imageCtx;
    ctx.clearRect(0, 0, page.imageCanvas.width, page.imageCanvas.height);

    (page.images || []).forEach((imgObj, idx) => {
        ctx.drawImage(imgObj.img, imgObj.x, imgObj.y, imgObj.w, imgObj.h);
        if (activeImage &&
            activeImage.pageIndex  === pageIndex &&
            activeImage.imageIndex === idx) {
            _drawHandles(ctx, imgObj);
        }
    });
}

function _drawHandles(ctx, imgObj) {
    const { x, y, w, h } = imgObj;
    const hs = HANDLE_SIZE;

    ctx.save();

    ctx.strokeStyle = '#2563EB';
    ctx.lineWidth   = 2;
    ctx.setLineDash([6, 3]);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);

    _getHandleRects(imgObj).forEach(function(hr) {
        ctx.shadowColor = 'rgba(0,0,0,0.2)';
        ctx.shadowBlur  = 4;
        ctx.fillStyle   = '#FFFFFF';
        ctx.fillRect(hr.x, hr.y, hs, hs);
        ctx.shadowBlur  = 0;
        ctx.strokeStyle = '#2563EB';
        ctx.lineWidth   = 2;
        ctx.strokeRect(hr.x, hr.y, hs, hs);
    });

    // زر الحذف - الزاوية العلوية اليمنى
    var bx = x + w;
    var by = y;
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur  = 6;
    ctx.fillStyle   = '#EF4444';
    ctx.beginPath();
    ctx.arc(bx, by, DELETE_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur     = 0;
    ctx.fillStyle      = '#FFFFFF';
    ctx.font           = 'bold 16px Arial';
    ctx.textAlign      = 'center';
    ctx.textBaseline   = 'middle';
    ctx.fillText('x', bx, by);

    ctx.restore();
}

function _getHandleRects(imgObj) {
    var x = imgObj.x, y = imgObj.y, w = imgObj.w, h = imgObj.h;
    var hs = HANDLE_SIZE, half = hs / 2;
    return [
        { id:'TL', x: x - half,       y: y - half       },
        { id:'TC', x: x+w/2 - half,   y: y - half       },
        { id:'TR', x: x+w - half,     y: y - half       },
        { id:'ML', x: x - half,       y: y+h/2 - half   },
        { id:'MR', x: x+w - half,     y: y+h/2 - half   },
        { id:'BL', x: x - half,       y: y+h - half     },
        { id:'BC', x: x+w/2 - half,   y: y+h - half     },
        { id:'BR', x: x+w - half,     y: y+h - half     }
    ];
}

// ===================================================================
// 4. Hit Testing
// ===================================================================

function _hitHandle(imgObj, mx, my) {
    var half = HANDLE_HIT / 2;
    var rects = _getHandleRects(imgObj);
    for (var i = 0; i < rects.length; i++) {
        var hr = rects[i];
        var cx = hr.x + HANDLE_SIZE / 2;
        var cy = hr.y + HANDLE_SIZE / 2;
        if (Math.abs(mx - cx) <= half && Math.abs(my - cy) <= half) return hr.id;
    }
    return null;
}

function _hitImage(imgObj, mx, my) {
    return mx >= imgObj.x && mx <= imgObj.x + imgObj.w &&
           my >= imgObj.y && my <= imgObj.y + imgObj.h;
}

function _hitDelete(imgObj, mx, my) {
    return Math.hypot(mx - (imgObj.x + imgObj.w), my - imgObj.y) <= DELETE_RADIUS + 6;
}

// ===================================================================
// 5. إضافة صورة
// ===================================================================

function addImageToPage(source, pageIndex) {
    var page = pages[pageIndex];
    if (!page) return;
    getImageLayer(page);

    function doAdd(img) {
        var maxW = page.canvas.width  * 0.55;
        var maxH = page.canvas.height * 0.55;
        var w = img.naturalWidth  || img.width  || 200;
        var h = img.naturalHeight || img.height || 200;

        if (w > maxW) { var r = maxW / w; w = maxW; h = h * r; }
        if (h > maxH) { var r2 = maxH / h; h = maxH; w = w * r2; }

        var x = (page.canvas.width  - w) / 2;
        var y = (page.canvas.height - h) / 2;

        var imgObj = { img: img, x: x, y: y, w: w, h: h, id: Date.now() };
        page.images.push(imgObj);

        activeImage = { pageIndex: pageIndex, imageIndex: page.images.length - 1 };
        _enableLayerEvents(page, pageIndex);
        redrawImageLayer(pageIndex);
        console.log('تمت اضافة صورة للصفحة', pageIndex + 1);
    }

    if (typeof source === 'string') {
        var img2 = new Image();
        img2.crossOrigin = 'anonymous';
        img2.onload  = function() { doAdd(img2); };
        img2.onerror = function() { console.error('فشل تحميل الصورة'); };
        img2.src = source;
    } else if (source instanceof HTMLImageElement) {
        if (source.complete) doAdd(source);
        else source.onload = function() { doAdd(source); };
    }
}

// ===================================================================
// 6. تفعيل المستمعات
// ===================================================================

function _enableLayerEvents(page, pageIndex) {
    if (_listenedPages.has(pageIndex)) return;
    _listenedPages.add(pageIndex);

    var cv = page.imageCanvas;
    cv.style.pointerEvents = 'auto';

    // ماوس
    cv.addEventListener('mousedown',  function(e) { _onMouseDown(e, pageIndex); });
    cv.addEventListener('mousemove',  function(e) { _onMouseMove(e, pageIndex); });
    cv.addEventListener('mouseup',    function(e) { _onMouseUp(e, pageIndex); });
    cv.addEventListener('mouseleave', function()  { _onMouseLeave(pageIndex); });
    cv.addEventListener('dblclick',   function(e) { _onDblClick(e, pageIndex); });

    // لمس
    cv.addEventListener('touchstart',  function(e) { _onTouchStart(e, pageIndex); },  { passive: false });
    cv.addEventListener('touchmove',   function(e) { _onTouchMove(e, pageIndex); },   { passive: false });
    cv.addEventListener('touchend',    function(e) { _onTouchEnd(e, pageIndex); },    { passive: false });
    cv.addEventListener('touchcancel', function(e) { _onTouchCancel(e, pageIndex); }, { passive: false });
}

// ===================================================================
// 7. تحويل الإحداثيات
// ===================================================================

function _posFromEvent(e, page) {
    var rect = page.imageCanvas.getBoundingClientRect();
    return {
        x: (e.clientX - rect.left) / page.scale,
        y: (e.clientY - rect.top)  / page.scale
    };
}

function _posFromTouch(touch, page) {
    var rect = page.imageCanvas.getBoundingClientRect();
    return {
        x: (touch.clientX - rect.left) / page.scale,
        y: (touch.clientY - rect.top)  / page.scale
    };
}

// ===================================================================
// 8. منطق مشترك للمؤشر
// ===================================================================

function _handlePointerDown(pos, pageIndex, e) {
    if (currentTool !== 'image-select') return;

    var page = pages[pageIndex];
    var imgs = page.images || [];

    for (var i = imgs.length - 1; i >= 0; i--) {
        var imgObj = imgs[i];

        if (activeImage && activeImage.imageIndex === i && _hitDelete(imgObj, pos.x, pos.y)) {
            _deleteActive();
            if (e) e.stopPropagation();
            return;
        }

        if (activeImage && activeImage.imageIndex === i) {
            var handle = _hitHandle(imgObj, pos.x, pos.y);
            if (handle) {
                imgResizeState = {
                    handle: handle,
                    startX: pos.x,    startY: pos.y,
                    origX:  imgObj.x, origY:  imgObj.y,
                    origW:  imgObj.w, origH:  imgObj.h,
                    ar:     imgObj.w / imgObj.h
                };
                if (e) e.stopPropagation();
                return;
            }
        }

        if (_hitImage(imgObj, pos.x, pos.y)) {
            activeImage  = { pageIndex: pageIndex, imageIndex: i };
            imgDragState = {
                startX: pos.x,    startY: pos.y,
                origX:  imgObj.x, origY:  imgObj.y
            };
            redrawImageLayer(pageIndex);
            if (e) e.stopPropagation();
            return;
        }
    }

    if (activeImage && activeImage.pageIndex === pageIndex) {
        flattenImagesToCanvas(pageIndex);
    }
}

function _handlePointerMove(pos, pageIndex) {
    if (currentTool !== 'image-select') return;
    var page = pages[pageIndex];
    var imgs = page.images || [];

    if (imgDragState && activeImage && activeImage.pageIndex === pageIndex) {
        var imgObj = imgs[activeImage.imageIndex];
        if (!imgObj) return;
        imgObj.x = imgDragState.origX + (pos.x - imgDragState.startX);
        imgObj.y = imgDragState.origY + (pos.y - imgDragState.startY);
        redrawImageLayer(pageIndex);
        return;
    }

    if (imgResizeState && activeImage && activeImage.pageIndex === pageIndex) {
        var imgObj2 = imgs[activeImage.imageIndex];
        if (!imgObj2) return;
        _applyResize(imgObj2, imgResizeState, pos);
        redrawImageLayer(pageIndex);
    }
}

function _handlePointerUp(pageIndex) {
    if (imgDragState || imgResizeState) saveToHistory(pageIndex);
    imgDragState   = null;
    imgResizeState = null;
}

// ===================================================================
// 9. معالجات الماوس
// ===================================================================

function _onMouseDown(e, pageIndex) {
    if (currentTool !== 'image-select') return;
    var pos = _posFromEvent(e, pages[pageIndex]);
    _handlePointerDown(pos, pageIndex, e);
    _updateCursor(pageIndex, pos);
}

function _onMouseMove(e, pageIndex) {
    if (currentTool !== 'image-select') return;
    var pos = _posFromEvent(e, pages[pageIndex]);
    _handlePointerMove(pos, pageIndex);
    _updateCursor(pageIndex, pos);
}

function _onMouseUp(e, pageIndex) {
    _handlePointerUp(pageIndex);
}

function _onMouseLeave(pageIndex) {
    if (imgDragState || imgResizeState) saveToHistory(pageIndex);
    imgDragState   = null;
    imgResizeState = null;
}

function _onDblClick(e, pageIndex) {
    if (currentTool !== 'image-select') return;
    var pos  = _posFromEvent(e, pages[pageIndex]);
    var imgs = pages[pageIndex].images || [];
    for (var i = imgs.length - 1; i >= 0; i--) {
        if (_hitImage(imgs[i], pos.x, pos.y)) {
            flattenImagesToCanvas(pageIndex);
            return;
        }
    }
}

// ===================================================================
// 10. معالجات اللمس
// ===================================================================

function _onTouchStart(e, pageIndex) {
    if (currentTool !== 'image-select') return;
    e.preventDefault();

    var page    = pages[pageIndex];
    var touches = e.touches;

    // لمستان → Pinch-to-zoom
    if (touches.length === 2) {
        imgDragState   = null;
        imgResizeState = null;

        if (activeImage && activeImage.pageIndex === pageIndex) {
            var imgObj = (page.images || [])[activeImage.imageIndex];
            if (imgObj) {
                var t1 = _posFromTouch(touches[0], page);
                var t2 = _posFromTouch(touches[1], page);
                imgPinchState = {
                    startDist: Math.hypot(t2.x - t1.x, t2.y - t1.y),
                    origW:  imgObj.w,
                    origH:  imgObj.h,
                    origX:  imgObj.x,
                    origY:  imgObj.y,
                    centerX: (t1.x + t2.x) / 2,
                    centerY: (t1.y + t2.y) / 2,
                    ar: imgObj.w / imgObj.h
                };
            }
        }
        return;
    }

    // لمسة واحدة
    if (touches.length === 1) {
        imgPinchState = null;
        var pos = _posFromTouch(touches[0], page);
        _handlePointerDown(pos, pageIndex, e);
    }
}

function _onTouchMove(e, pageIndex) {
    if (currentTool !== 'image-select') return;
    e.preventDefault();

    var page    = pages[pageIndex];
    var touches = e.touches;

    // Pinch-to-zoom بإصبعين
    if (touches.length === 2 && imgPinchState && activeImage && activeImage.pageIndex === pageIndex) {
        var imgs   = page.images || [];
        var imgObj = imgs[activeImage.imageIndex];
        if (!imgObj) return;

        var t1   = _posFromTouch(touches[0], page);
        var t2   = _posFromTouch(touches[1], page);
        var dist = Math.hypot(t2.x - t1.x, t2.y - t1.y);

        if (imgPinchState.startDist > 0) {
            var scale = dist / imgPinchState.startDist;
            var newW  = Math.max(MIN_IMG_SIZE, imgPinchState.origW * scale);
            var newH  = newW / imgPinchState.ar;

            var cx   = imgPinchState.centerX;
            var cy   = imgPinchState.centerY;
            var ratX = (cx - imgPinchState.origX) / imgPinchState.origW;
            var ratY = (cy - imgPinchState.origY) / imgPinchState.origH;

            imgObj.w = newW;
            imgObj.h = newH;
            imgObj.x = cx - ratX * newW;
            imgObj.y = cy - ratY * newH;

            redrawImageLayer(pageIndex);
        }
        return;
    }

    // لمسة واحدة
    if (touches.length === 1) {
        var pos = _posFromTouch(touches[0], page);
        _handlePointerMove(pos, pageIndex);
    }
}

function _onTouchEnd(e, pageIndex) {
    if (currentTool !== 'image-select') return;
    e.preventDefault();

    var remaining = e.touches.length;

    if (remaining === 0) {
        if (imgPinchState) {
            saveToHistory(pageIndex);
            imgPinchState = null;
        } else {
            _handlePointerUp(pageIndex);
        }
    } else if (remaining === 1 && imgPinchState) {
        imgPinchState = null;
        saveToHistory(pageIndex);
    }
}

function _onTouchCancel(e, pageIndex) {
    if (currentTool !== 'image-select') return;
    e.preventDefault();
    imgDragState   = null;
    imgResizeState = null;
    imgPinchState  = null;
    redrawImageLayer(pageIndex);
}

// ===================================================================
// 11. تغيير الحجم بالمقابض
// ===================================================================

function _applyResize(imgObj, state, pos) {
    var dx = pos.x - state.startX;
    var dy = pos.y - state.startY;
    var h  = state.handle;

    var newX = state.origX, newY = state.origY;
    var newW = state.origW, newH = state.origH;

    if (h.indexOf('R') !== -1) newW = Math.max(MIN_IMG_SIZE, state.origW + dx);
    if (h.indexOf('L') !== -1) { newW = Math.max(MIN_IMG_SIZE, state.origW - dx); newX = state.origX + (state.origW - newW); }
    if (h.indexOf('B') !== -1) newH = Math.max(MIN_IMG_SIZE, state.origH + dy);
    if (h.indexOf('T') !== -1) { newH = Math.max(MIN_IMG_SIZE, state.origH - dy); newY = state.origY + (state.origH - newH); }

    // زوايا: الحفاظ على النسبة
    if (h === 'TL' || h === 'TR' || h === 'BL' || h === 'BR') {
        if (Math.abs(dx) >= Math.abs(dy)) {
            newH = newW / state.ar;
            if (h.indexOf('T') !== -1) newY = state.origY + (state.origH - newH);
        } else {
            newW = newH * state.ar;
            if (h.indexOf('L') !== -1) newX = state.origX + (state.origW - newW);
        }
    }

    imgObj.x = newX;
    imgObj.y = newY;
    imgObj.w = Math.max(MIN_IMG_SIZE, newW);
    imgObj.h = Math.max(MIN_IMG_SIZE, newH);
}

// ===================================================================
// 12. مؤشر الماوس
// ===================================================================

function _updateCursor(pageIndex, pos) {
    var page   = pages[pageIndex];
    var imgs   = page.images || [];
    var canvas = page.imageCanvas;

    if (activeImage && activeImage.pageIndex === pageIndex) {
        var imgObj = imgs[activeImage.imageIndex];
        if (imgObj) {
            if (_hitDelete(imgObj, pos.x, pos.y)) { canvas.style.cursor = 'pointer'; return; }
            var hid = _hitHandle(imgObj, pos.x, pos.y);
            if (hid) {
                var map = { TL:'nwse-resize', TR:'nesw-resize', BL:'nesw-resize', BR:'nwse-resize',
                            TC:'ns-resize',   BC:'ns-resize',   ML:'ew-resize',   MR:'ew-resize' };
                canvas.style.cursor = map[hid] || 'crosshair'; return;
            }
            if (_hitImage(imgObj, pos.x, pos.y)) { canvas.style.cursor = 'move'; return; }
        }
    }
    for (var i = imgs.length - 1; i >= 0; i--) {
        if (_hitImage(imgs[i], pos.x, pos.y)) { canvas.style.cursor = 'move'; return; }
    }
    canvas.style.cursor = 'default';
}

// ===================================================================
// 13. حذف الصورة
// ===================================================================

function _deleteActive() {
    if (!activeImage) return;
    var pIdx = activeImage.pageIndex;
    var page = pages[pIdx];
    if (!page || !page.images) return;

    page.images.splice(activeImage.imageIndex, 1);

    if (page.images.length > 0) {
        activeImage = { pageIndex: pIdx, imageIndex: page.images.length - 1 };
    } else {
        activeImage = null;
    }

    redrawImageLayer(pIdx);
    saveToHistory(pIdx);
}

function deleteActiveImage() { _deleteActive(); }

// ===================================================================
// 14. دمج الصور في اللوحة
// ===================================================================

function flattenImagesToCanvas(pageIndex) {
    var page = pages[pageIndex];
    if (!page) return;

    (page.images || []).forEach(function(imgObj) {
        page.ctx.globalAlpha              = 1.0;
        page.ctx.globalCompositeOperation = 'source-over';
        page.ctx.drawImage(imgObj.img, imgObj.x, imgObj.y, imgObj.w, imgObj.h);
    });

    page.images   = [];
    activeImage   = null;
    imgPinchState = null;

    if (page.imageCtx) {
        page.imageCtx.clearRect(0, 0, page.imageCanvas.width, page.imageCanvas.height);
    }

    saveToHistory(pageIndex);
    console.log('تم دمج الصور في اللوحة - صفحة', pageIndex + 1);
}

function flattenAllPagesBeforeExport() {
    pages.forEach(function(_, i) { flattenImagesToCanvas(i); });
}

// ===================================================================
// 15. رفع صورة من الجهاز
// ===================================================================

function setupImageUpload() {
    var fileInput = document.getElementById('image-file-input');
    if (!fileInput) return;

    fileInput.addEventListener('change', function() {
        var file = this.files[0];
        if (!file || !file.type.startsWith('image/')) return;
        var reader = new FileReader();
        reader.onload = function(ev) {
            addImageToPage(ev.target.result, currentPage);
            setActiveTool('image-select');
        };
        reader.readAsDataURL(file);
        this.value = '';
    });

    var imageBtn = document.getElementById('image-btn');
    if (imageBtn) {
        imageBtn.addEventListener('click', function() { fileInput.click(); });
    }
}

// ===================================================================
// 16. لصق من الحافظة
// ===================================================================

function setupClipboardPaste() {
    document.addEventListener('paste', function(e) {
        var items = e.clipboardData && e.clipboardData.items;
        if (!items) return;
        for (var i = 0; i < items.length; i++) {
            if (items[i].type.startsWith('image/')) {
                e.preventDefault();
                var reader = new FileReader();
                reader.onload = function(ev) {
                    addImageToPage(ev.target.result, currentPage);
                    setActiveTool('image-select');
                };
                reader.readAsDataURL(items[i].getAsFile());
                break;
            }
        }
    });
}

// ===================================================================
// 17. سحب وإفلات من خارج التطبيق
// ===================================================================

function setupDragAndDrop() {
    var workArea = document.querySelector('.canvas-area') || document.body;

    workArea.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        workArea.classList.add('drag-over');
    });

    workArea.addEventListener('dragleave', function() {
        workArea.classList.remove('drag-over');
    });

    workArea.addEventListener('drop', function(e) {
        e.preventDefault();
        workArea.classList.remove('drag-over');

        var files = e.dataTransfer.files;
        if (files && files.length > 0) {
            for (var i = 0; i < files.length; i++) {
                if (files[i].type.startsWith('image/')) {
                    (function(file) {
                        var reader = new FileReader();
                        reader.onload = function(ev) {
                            addImageToPage(ev.target.result, currentPage);
                            setActiveTool('image-select');
                        };
                        reader.readAsDataURL(file);
                    })(files[i]);
                    break;
                }
            }
            return;
        }

        var imgUrl = e.dataTransfer.getData('text/uri-list') ||
                     e.dataTransfer.getData('text/plain');
        if (imgUrl && /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(imgUrl)) {
            addImageToPage(imgUrl, currentPage);
            setActiveTool('image-select');
        }
    });
}

// ===================================================================
// 18. اختصارات لوحة المفاتيح
// ===================================================================

function setupImageKeyboardShortcuts() {
    window.addEventListener('keydown', function(e) {
        if (!activeImage) return;
        var tag = document.activeElement && document.activeElement.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;

        if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            _deleteActive();
        }
        if (e.key === 'Escape') {
            flattenImagesToCanvas(activeImage.pageIndex);
        }
    });
}

// ===================================================================
// 19. ربط مع نظام الأدوات
// ===================================================================

function onToolChange(newTool) {
    if (newTool !== 'image-select' && activeImage !== null) {
        flattenImagesToCanvas(activeImage.pageIndex);
    }
    pages.forEach(function(page) {
        if (page.imageCanvas) {
            page.imageCanvas.style.pointerEvents =
                (newTool === 'image-select') ? 'auto' : 'none';
        }
    });
}

// ===================================================================
// 20. التهيئة
// ===================================================================

function initImageManager() {
    setupImageUpload();
    setupClipboardPaste();
    setupDragAndDrop();
    setupImageKeyboardShortcuts();
    console.log('تم تهيئة مدير الصور (مع دعم اللمس الكامل)');
}
