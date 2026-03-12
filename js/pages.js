/**
 * السبورة الذكية - إدارة الصفحات
 * Smart Whiteboard - Page Management
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
        images:     []   // مصفوفة الصور الخاصة بهذه الصفحة
    };
    pages.push(pageData);

    setupCanvasEventListeners(canvas, pages.length - 1);
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

    pages.splice(pageIndex, 1);

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

            // تحديث زر الحذف إن لزم
            let delBtn = item.querySelector('.delete-page-btn');
            if (!delBtn) {
                delBtn = document.createElement('button');
                delBtn.innerHTML = '<i class="fas fa-trash"></i>';
                delBtn.className = 'page-action-btn delete-page-btn';
                delBtn.title     = 'حذف الصفحة';
                item.appendChild(delBtn);
            }
            // استخدام dataset لتجنب تكرار المستمعين
            delBtn.onclick = (e) => {
                e.stopPropagation();
                deletePage(parseInt(item.dataset.index));
            };
        }
    }

    // الانتقال إلى صفحة مجاورة
    if (currentPage === pageIndex) {
        switchToPage(Math.max(0, pageIndex - 1));
    } else if (currentPage > pageIndex) {
        currentPage--;
        updatePageIndicator();
    } else {
        updatePageIndicator();
    }

    updateUndoRedoButtons();
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
