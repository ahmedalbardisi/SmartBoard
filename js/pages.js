/**
 * السبورة الذكية - إدارة الصفحات
 * Smart Whiteboard - Page Management
 */

// -------------------- إنشاء صفحة جديدة (Create New Page) --------------------

function createNewPage() {
    const pageElement = document.createElement("div");
    pageElement.className = "page";
    // سيُحدَّث لاحقاً في addPageToSidebar لكن نُعيّنه مبدئياً هنا
    pageElement.dataset.pageLabel = `صفحة ${pages.length + 1}`;

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
        images:     []   // مصفوفة الصور الخاصة بهذه الصفحة
    };
    pages.push(pageData);

    setupCanvasEventListeners(canvas);
    addPageToSidebar();
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

// -------------------- إضافة صفحة إلى الشريط الجانبي (Add to Sidebar) --------------------

function addPageToSidebar() {
    const pagesList = document.querySelector(".pages-list");
    if (!pagesList) {
        console.error("Pages list element not found.");
        return;
    }

    const addPageButton = pagesList.querySelector(".add-page-button");
    if (addPageButton) pagesList.removeChild(addPageButton);

    const pageIndex = pages.length;

    // تحديث data-page-label على عنصر الصفحة (يُستخدم في CSS ::before لعرض الرقم)
    if (pages[pageIndex - 1] && pages[pageIndex - 1].element) {
        pages[pageIndex - 1].element.dataset.pageLabel = `صفحة ${pageIndex}`;
    }

    const pageItem = document.createElement("div");
    pageItem.className   = "page-item";
    pageItem.textContent = `صفحة ${pageIndex}`;
    pageItem.dataset.index = pageIndex - 1;

    pageItem.addEventListener("click", function () {
        switchToPage(parseInt(this.dataset.index));
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.innerHTML  = '<i class="fas fa-trash"></i>';
    deleteBtn.className  = 'page-action-btn delete-page-btn';
    deleteBtn.title      = 'حذف الصفحة';
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deletePage(parseInt(pageItem.dataset.index));
    });
    pageItem.appendChild(deleteBtn);

    pagesList.appendChild(pageItem);
    if (addPageButton) pagesList.appendChild(addPageButton);

    console.log(`تمت إضافة الصفحة ${pageIndex} إلى الشريط الجانبي`);
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

    // احفظ ما إذا كانت الصفحة المحذوفة هي الحالية
    const wasCurrentPage = (currentPage === pageIndex);

    pages.splice(pageIndex, 1);

    // إعادة ترقيم data-page-label على الصفحات المتبقية
    pages.forEach((p, i) => {
        if (p && p.element) p.element.dataset.pageLabel = `صفحة ${i + 1}`;
    });

    // إزالة العنصر من الشريط الجانبي
    const pageItems = document.querySelectorAll(".page-item");
    if (pageIndex < pageItems.length) {
        pageItems[pageIndex].remove();
    }

    // تحديث أرقام الصفحات المتبقية في الشريط الجانبي
    for (let i = pageIndex; i < pages.length; i++) {
        const item = document.querySelector(`.page-item[data-index="${i + 1}"]`);
        if (item) {
            item.dataset.index = i;
            item.childNodes[0].textContent = `صفحة ${i + 1}`;
            let delBtn = item.querySelector('.delete-page-btn');
            if (!delBtn) {
                delBtn = document.createElement('button');
                delBtn.innerHTML = '<i class="fas fa-trash"></i>';
                delBtn.className = 'page-action-btn delete-page-btn';
                delBtn.title     = 'حذف الصفحة';
                item.appendChild(delBtn);
            }
            delBtn.onclick = (e) => {
                e.stopPropagation();
                deletePage(parseInt(item.dataset.index));
            };
        }
    }

    // حساب الصفحة الهدف بعد الحذف
    const targetIndex = Math.min(Math.max(0, pageIndex - 1), pages.length - 1);

    // إعادة ضبط currentPage إلى -1 حتى لا تحجب switchToPage
    // (switchToPage تتحقق: إذا pageIndex === currentPage → لا تفعل شيئاً)
    currentPage = -1;
    switchToPage(targetIndex);

    console.log(`تم حذف الصفحة ${pageIndex + 1}`);
}

// -------------------- التبديل بين الصفحات (Switch Page) --------------------

function switchToPage(pageIndex) {
    if (pageIndex < 0 || pageIndex >= pages.length || pageIndex === currentPage) return;

    const targetPage = pages[pageIndex];
    if (!targetPage || !targetPage.element) {
        console.error(`Target page not found for index ${pageIndex}.`);
        return;
    }

    // جميع الصفحات ظاهرة دائماً — فقط نغيّر الـ active-page للتمييز البصري
    pages.forEach(p => {
        if (p && p.element) p.element.classList.remove('active-page');
    });
    targetPage.element.classList.add('active-page');

    currentPage = pageIndex;

    // تمرير تلقائي إلى الصفحة المحددة
    targetPage.element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

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
