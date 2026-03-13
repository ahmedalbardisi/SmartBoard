/**
 * السبورة الذكية - إدارة الصفحات
 * Smart Whiteboard - Page Management
 *
 * الإصلاحات:
 * ✔ Bug 3: إعادة بناء قائمة الشريط الجانبي بالكامل بعد الحذف بدلاً من التعديل الجزئي
 * ✔ Bug 4: إعادة ضبط _listenedPages عند حذف صفحة لضمان عمل أحداث الصور في الصفحات الجديدة
 */

// -------------------- إنشاء صفحة جديدة (Create New Page) --------------------

function createNewPage() {
    const pageElement = document.createElement("div");
    pageElement.className = "page";

    const pageActions = document.createElement("div");
    pageActions.className = "page-actions";
    pageElement.appendChild(pageActions);

    const canvas = document.createElement("canvas");
    canvas.width  = 800;
    canvas.height = 1131;
    pageElement.appendChild(canvas);

    if (contPags) {
        contPags.appendChild(pageElement);
    } else {
        console.error("Container (.cont_pags) not found. Cannot append new page.");
        return null;
    }

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.lineCap  = "round";
    ctx.lineJoin = "round";

    if (bgTypeSelect) setCanvasBackground(canvas, bgTypeSelect.value);

    const pageData = {
        canvas,
        ctx,
        history:    [canvas.toDataURL()],
        redoStack:  [],
        translateX: 0,
        translateY: 0,
        scale:      1,
        element:    pageElement,
        images:     []
    };
    pages.push(pageData);

    setupCanvasEventListeners(canvas);
    _rebuildPagesSidebar();
    switchToPage(pages.length - 1);

    return pageData;
}

// -------------------- خلفية اللوحة (Canvas Background) --------------------

function setCanvasBackground(canvas, pattern) {
    if (!canvas) return;
    canvas.classList.remove("bg-dots", "bg-lines", "bg-grid");
    if (pattern !== "plain") canvas.classList.add(`bg-${pattern}`);
}

function setBgPatternForAllPages(pattern) {
    pages.forEach(page => {
        if (page && page.canvas) setCanvasBackground(page.canvas, pattern);
    });
    console.log(`تم تغيير نمط الخلفية لجميع الصفحات إلى: ${pattern}`);
}

// -------------------- بناء قائمة الصفحات من الصفر (Rebuild Sidebar) --------------------
// Bug 3 Fix: بدلاً من التعديل الجزئي الذي يُخطئ في الأرقام، نُعيد بناء القائمة كاملةً

function _rebuildPagesSidebar() {
    const pagesList = document.querySelector(".pages-list");
    if (!pagesList) {
        console.error("Pages list element not found.");
        return;
    }

    // احفظ زر الإضافة وأزل باقي العناصر
    const addPageButton = pagesList.querySelector(".add-page-button");
    pagesList.querySelectorAll(".page-item").forEach(el => el.remove());

    // أنشئ عنصر لكل صفحة
    pages.forEach((_, i) => {
        const pageItem = document.createElement("div");
        pageItem.className   = "page-item";
        pageItem.dataset.index = i;

        const label = document.createTextNode(`صفحة ${i + 1}`);
        pageItem.appendChild(label);

        pageItem.addEventListener("click", function () {
            switchToPage(parseInt(this.dataset.index));
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
        deleteBtn.className = 'page-action-btn delete-page-btn';
        deleteBtn.title     = 'حذف الصفحة';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deletePage(parseInt(pageItem.dataset.index));
        });
        pageItem.appendChild(deleteBtn);

        // أدرج قبل زر الإضافة إذا كان موجوداً، وإلا أضف في النهاية
        if (addPageButton) {
            pagesList.insertBefore(pageItem, addPageButton);
        } else {
            pagesList.appendChild(pageItem);
        }
    });

    // تأكد من وجود زر الإضافة في النهاية
    if (addPageButton && addPageButton.parentNode !== pagesList) {
        pagesList.appendChild(addPageButton);
    }

    console.log(`تم إعادة بناء قائمة الصفحات (${pages.length} صفحة)`);
}

// حُفظت للتوافق مع أي كود قديم يستدعيها
function addPageToSidebar() {
    _rebuildPagesSidebar();
}

// -------------------- حذف صفحة (Delete Page) --------------------

function deletePage(pageIndex) {
    if (pages.length <= 1) {
        alert("لا يمكن حذف الصفحة الوحيدة.");
        return;
    }
    if (pageIndex < 0 || pageIndex >= pages.length) {
        console.error(`Invalid page index ${pageIndex} for deletion.`);
        return;
    }

    if (!confirm(`هل أنت متأكد أنك تريد حذف الصفحة ${pageIndex + 1}؟`)) return;

    // دمج أي صور معلقة قبل الحذف
    if (typeof flattenImagesToCanvas === 'function') flattenImagesToCanvas(pageIndex);

    // إزالة عنصر الصفحة من DOM
    if (pages[pageIndex] && pages[pageIndex].element) {
        pages[pageIndex].element.remove();
    }

    pages.splice(pageIndex, 1);

    // Bug 4 Fix: إعادة ضبط _listenedPages بعد الحذف
    // الصفحات التي كانت بعد المحذوفة تغيّر أرقامها، يجب إزالتها وإعادة إضافتها
    if (typeof _listenedPages !== 'undefined') {
        const newSet = new Set();
        _listenedPages.forEach(idx => {
            if (idx < pageIndex) newSet.add(idx);
            // الصفحات بعد المحذوفة تُزال ليُعاد تسجيلها عند الحاجة
        });
        _listenedPages.clear();
        newSet.forEach(idx => _listenedPages.add(idx));
    }

    // إعادة بناء القائمة بالكامل (Bug 3 Fix)
    _rebuildPagesSidebar();

    // حساب الصفحة الهدف بعد الحذف
    const targetIndex = Math.min(Math.max(0, pageIndex - 1), pages.length - 1);

    currentPage = -1; // إعادة الضبط حتى تعمل switchToPage بشكل صحيح
    switchToPage(targetIndex);

    console.log(`تم حذف الصفحة ${pageIndex + 1}`);
}

// -------------------- التبديل بين الصفحات (Switch Page) --------------------

function switchToPage(pageIndex) {
    if (pageIndex < 0 || pageIndex >= pages.length || pageIndex === currentPage) return;

    pages.forEach(p => {
        if (p && p.element) p.element.style.display = 'none';
    });

    const targetPage = pages[pageIndex];
    if (!targetPage || !targetPage.element) {
        console.error(`Target page not found for index ${pageIndex}.`);
        return;
    }

    targetPage.element.style.display = 'block';
    currentPage = pageIndex;

    updatePageIndicator();
    updateUndoRedoButtons();
    updateZoomPercentageDisplay();

    document.querySelectorAll(".page-item").forEach(item => {
        item.classList.toggle("active", parseInt(item.dataset.index) === pageIndex);
    });

    applyTransform(targetPage);
    setCanvasCursor(currentTool);

    console.log(`تم الانتقال إلى الصفحة ${pageIndex + 1}`);
}

// -------------------- مؤشر الصفحة (Page Indicator) --------------------

function updatePageIndicator() {
    if (pageIndicator) pageIndicator.textContent = `${currentPage + 1} / ${pages.length}`;
}
