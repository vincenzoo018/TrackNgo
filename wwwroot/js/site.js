/* ============================================================
   TrackNGo Mati — Global JavaScript
   Navigation, Modals, Toasts, Signature Pad, Export Logic
   ============================================================ */

// --- Modal Management ---
function openModal(id) {
    const overlay = document.getElementById(id);
    if (overlay) {
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(id) {
    const overlay = document.getElementById(id);
    if (overlay) {
        overlay.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// Close modal on overlay click
document.addEventListener('click', function (e) {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.remove('active');
        document.body.style.overflow = '';
    }
});

// Close modal on Escape key
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.active').forEach(function (m) {
            m.classList.remove('active');
            document.body.style.overflow = '';
        });
    }
});


// --- Toast Notifications ---
function showToast(message, type) {
    type = type || 'success';
    var container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    var iconSvg = type === 'success'
        ? '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>'
        : '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';

    var toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.innerHTML = iconSvg +
        '<span>' + message + '</span>' +
        '<button class="toast-close" onclick="this.parentElement.remove()">&times;</button>';

    container.appendChild(toast);

    setTimeout(function () {
        if (toast.parentElement) toast.remove();
    }, 4000);
}


// --- Password-Gated Export ---
function handleExportPassword(inputId, modalId) {
    var input = document.getElementById(inputId);
    var password = input ? input.value : '';

    if (password === 'TrackNGo2026') {
        closeModal(modalId);
        showToast('Export authorized. Generating file...', 'success');
        if (input) input.value = '';
        // Trigger CSV generation
        setTimeout(function () {
            generateCSVExport();
        }, 500);
    } else {
        showToast('Incorrect password. Access denied.', 'error');
        if (input) { input.value = ''; input.focus(); }
    }
}

function generateCSVExport() {
    // Get all visible table rows for export
    var table = document.querySelector('.table-wrapper table');
    if (!table) {
        showToast('No data available to export.', 'error');
        return;
    }

    var csv = [];
    var rows = table.querySelectorAll('tr');
    rows.forEach(function (row) {
        var cols = row.querySelectorAll('th, td');
        var rowData = [];
        cols.forEach(function (col) {
            var text = col.innerText.replace(/"/g, '""');
            rowData.push('"' + text + '"');
        });
        csv.push(rowData.join(','));
    });

    var csvContent = csv.join('\n');
    var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'trackngo_export_' + new Date().toISOString().slice(0, 10) + '.csv';
    link.click();

    showToast('CSV exported successfully.', 'success');
}


// --- Signature Pad ---
var signaturePad = {
    canvas: null,
    ctx: null,
    drawing: false,

    init: function (canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        this.ctx.strokeStyle = '#0F172A';
        this.ctx.lineWidth = 2;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        var self = this;
        this.canvas.addEventListener('mousedown', function (e) { self.startDraw(e); });
        this.canvas.addEventListener('mousemove', function (e) { self.draw(e); });
        this.canvas.addEventListener('mouseup', function () { self.stopDraw(); });
        this.canvas.addEventListener('mouseleave', function () { self.stopDraw(); });

        // Touch support
        this.canvas.addEventListener('touchstart', function (e) {
            e.preventDefault();
            self.startDraw(e.touches[0]);
        });
        this.canvas.addEventListener('touchmove', function (e) {
            e.preventDefault();
            self.draw(e.touches[0]);
        });
        this.canvas.addEventListener('touchend', function () { self.stopDraw(); });
    },

    startDraw: function (e) {
        this.drawing = true;
        this.ctx.beginPath();
        var rect = this.canvas.getBoundingClientRect();
        this.ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    },

    draw: function (e) {
        if (!this.drawing) return;
        var rect = this.canvas.getBoundingClientRect();
        this.ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
        this.ctx.stroke();
    },

    stopDraw: function () {
        this.drawing = false;
    },

    clear: function () {
        if (this.ctx && this.canvas) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
    },

    toBase64: function () {
        return this.canvas ? this.canvas.toDataURL('image/png') : '';
    },

    isEmpty: function () {
        if (!this.canvas) return true;
        var blank = document.createElement('canvas');
        blank.width = this.canvas.width;
        blank.height = this.canvas.height;
        return this.canvas.toDataURL() === blank.toDataURL();
    }
};


// --- Sidebar Role Switching (demo) ---
function switchRole(role) {
    // Update URL with role parameter for demo purposes
    var url = new URL(window.location);
    url.searchParams.set('role', role);
    window.location.href = url.toString();
}

function getCurrentRole() {
    var params = new URLSearchParams(window.location.search);
    return params.get('role') || 'System Administrator';
}


// --- Sidebar Active State ---
function setActiveNav() {
    var path = window.location.pathname.toLowerCase();
    document.querySelectorAll('.sidebar-nav-item').forEach(function (item) {
        var href = item.getAttribute('href');
        if (href) {
            var itemPath = href.toLowerCase();
            if (path === itemPath || (itemPath !== '/' && path.startsWith(itemPath))) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        }
    });
}


// --- Filter Tables (client-side search) ---
function filterTable(inputId, tableSelector) {
    var input = document.getElementById(inputId);
    if (!input) return;

    input.addEventListener('input', function () {
        var filter = this.value.toLowerCase();
        var rows = document.querySelectorAll(tableSelector + ' tbody tr');
        rows.forEach(function (row) {
            var text = row.textContent.toLowerCase();
            row.style.display = text.includes(filter) ? '' : 'none';
        });
    });
}

function filterBySelect(selectId, tableSelector, colIndex) {
    var select = document.getElementById(selectId);
    if (!select) return;

    select.addEventListener('change', function () {
        var value = this.value.toLowerCase();
        var rows = document.querySelectorAll(tableSelector + ' tbody tr');
        rows.forEach(function (row) {
            if (!value) {
                row.style.display = '';
                return;
            }
            var cell = row.querySelectorAll('td')[colIndex];
            if (cell) {
                var cellText = cell.textContent.toLowerCase().trim();
                row.style.display = cellText.includes(value) ? '' : 'none';
            }
        });
    });
}


// --- Mobile Sidebar Toggle ---
function toggleSidebar() {
    var sidebar = document.querySelector('.sidebar');
    if (sidebar) {
        sidebar.classList.toggle('open');
    }
}


// --- Print ---
function printPage() {
    window.print();
}


// --- Confirm Delete ---
function confirmDelete(itemName, formId) {
    if (confirm('Are you sure you want to delete "' + itemName + '"? This action cannot be undone.')) {
        var form = document.getElementById(formId);
        if (form) form.submit();
        return true;
    }
    return false;
}


// --- Init on DOM Ready ---
document.addEventListener('DOMContentLoaded', function () {
    // Initialize Lucide icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    // Set active nav
    setActiveNav();

    // Initialize signature pad if present
    if (document.getElementById('signatureCanvas')) {
        signaturePad.init('signatureCanvas');
    }

    // Initialize table search if present
    if (document.getElementById('tableSearch')) {
        filterTable('tableSearch', '.table-wrapper table');
    }

    // Initialize role display
    var roleLabel = document.getElementById('current-role-label');
    if (roleLabel) {
        roleLabel.textContent = getCurrentRole();
    }
});
