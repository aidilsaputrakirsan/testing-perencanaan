// Konfigurasi
const CONFIG = {
    // Ganti dengan URL Google Apps Script Anda setelah deployment
    GAS_URL: 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec',
    LOCAL_STORAGE_KEY: 'sop_data'
};

// State Management
let sopData = {
    persiapan: null,
    sakti: null,
    monitoring: null,
    status: {
        step1: 'pending',
        step2: 'pending', 
        step3: 'pending',
        step4: 'pending'
    }
};

// DOM Elements
const sections = document.querySelectorAll('.section');
const navButtons = document.querySelectorAll('.nav-btn');
const forms = document.querySelectorAll('form');
const loadingOverlay = document.getElementById('loading');
const notification = document.getElementById('notification');

// Initialize App
document.addEventListener('DOMContentLoaded', function() {
    loadStoredData();
    setupEventListeners();
    updateDashboard();
    updateProgressSteps();
});

// Event Listeners Setup
function setupEventListeners() {
    // Navigation
    navButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const targetSection = this.dataset.section;
            showSection(targetSection);
            setActiveNav(this);
        });
    });

    // Forms
    setupFormListeners();
    
    // RKAOL Status Change
    const rkaolStatus = document.getElementById('rkaol-status');
    if (rkaolStatus) {
        rkaolStatus.addEventListener('change', toggleRevisiField);
    }
}

// Form Listeners
function setupFormListeners() {
    // Form Persiapan
    const formPersiapan = document.getElementById('form-persiapan');
    if (formPersiapan) {
        formPersiapan.addEventListener('submit', handlePersiapanSubmit);
    }

    // Form SAKTI
    const formSakti = document.getElementById('form-sakti');
    if (formSakti) {
        formSakti.addEventListener('submit', handleSaktiSubmit);
    }

    // Form Monitoring
    const formMonitoring = document.getElementById('form-monitoring');
    if (formMonitoring) {
        formMonitoring.addEventListener('submit', handleMonitoringSubmit);
    }
}

// Navigation Functions
function showSection(sectionId) {
    sections.forEach(section => {
        section.classList.remove('active');
    });
    
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.add('active');
    }
}

function setActiveNav(activeBtn) {
    navButtons.forEach(btn => {
        btn.classList.remove('active');
    });
    activeBtn.classList.add('active');
}

// Form Handlers
async function handlePersiapanSubmit(e) {
    e.preventDefault();
    showLoading(true);

    const formData = new FormData(e.target);
    const data = {
        action: 'persiapan',
        targetUKT: formData.get('targetUKT'),
        targetNonUKT: formData.get('targetNonUKT'),
        periode: formData.get('periode'),
        catatan: formData.get('catatan'),
        timestamp: new Date().toISOString()
    };

    try {
        const result = await submitToGAS(data);
        if (result.success) {
            sopData.persiapan = data;
            sopData.status.step1 = 'completed';
            saveToLocalStorage();
            updateDashboard();
            updateProgressSteps();
            showNotification('Data persiapan berhasil disimpan!', 'success');
            showSection('sakti');
            setActiveNav(document.querySelector('[data-section="sakti"]'));
        } else {
            throw new Error(result.message || 'Gagal menyimpan data');
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('Gagal menyimpan data: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function handleSaktiSubmit(e) {
    e.preventDefault();
    showLoading(true);

    const formData = new FormData(e.target);
    const data = {
        action: 'sakti',
        namaKegiatan: formData.get('namaKegiatan'),
        totalAnggaran: formData.get('totalAnggaran'),
        statusRKAOL: formData.get('statusRKAOL'),
        alasanRevisi: formData.get('alasanRevisi'),
        timestamp: new Date().toISOString()
    };

    try {
        const result = await submitToGAS(data);
        if (result.success) {
            sopData.sakti = data;
            
            // Update status berdasarkan status RKAOL
            if (data.statusRKAOL === 'approved') {
                sopData.status.step2 = 'completed';
            } else if (data.statusRKAOL === 'revision') {
                sopData.status.step2 = 'revision';
            } else {
                sopData.status.step2 = 'active';
            }

            saveToLocalStorage();
            updateDashboard();
            updateProgressSteps();
            
            if (data.statusRKAOL === 'approved') {
                showNotification('RKAOL disetujui! Lanjut ke monitoring.', 'success');
                showSection('monitoring');
                setActiveNav(document.querySelector('[data-section="monitoring"]'));
            } else {
                showNotification('Data RKAOL berhasil disimpan!', 'success');
            }
        } else {
            throw new Error(result.message || 'Gagal menyimpan data');
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('Gagal menyimpan data: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function handleMonitoringSubmit(e) {
    e.preventDefault();
    showLoading(true);

    const formData = new FormData(e.target);
    const data = {
        action: 'monitoring',
        indikatorKinerja: formData.get('indikatorKinerja'),
        realisasi: formData.get('realisasi'),
        evaluasi: formData.get('evaluasi'),
        laporan: formData.get('laporan'),
        timestamp: new Date().toISOString()
    };

    try {
        const result = await submitToGAS(data);
        if (result.success) {
            sopData.monitoring = data;
            sopData.status.step3 = 'completed';
            sopData.status.step4 = 'completed';
            saveToLocalStorage();
            updateDashboard();
            updateProgressSteps();
            showNotification('Proses SOP berhasil diselesaikan!', 'success');
            showSection('dashboard');
            setActiveNav(document.querySelector('[data-section="dashboard"]'));
        } else {
            throw new Error(result.message || 'Gagal menyimpan data');
        }
    } catch (error) {
        console.error('Error:', error);
        showNotification('Gagal menyimpan data: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// GAS Integration
async function submitToGAS(data) {
    try {
        const response = await fetch(CONFIG.GAS_URL, {
            method: 'POST',
            mode: 'no-cors', // Untuk menghindari CORS error
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });

        // Karena mode no-cors, kita tidak bisa membaca response
        // Jadi kita assume success jika tidak ada error
        return { success: true };
        
    } catch (error) {
        console.error('GAS Error:', error);
        // Fallback ke local storage jika GAS gagal
        return { success: true, message: 'Data disimpan secara lokal' };
    }
}

// Alternative method untuk GAS dengan JSONP (jika diperlukan)
async function submitToGASJsonp(data) {
    return new Promise((resolve, reject) => {
        const callbackName = 'gasCallback' + Date.now();
        const script = document.createElement('script');
        
        // Set callback function
        window[callbackName] = function(response) {
            document.head.removeChild(script);
            delete window[callbackName];
            resolve(response);
        };

        // Create script URL with JSONP callback
        const url = `${CONFIG.GAS_URL}?callback=${callbackName}&data=${encodeURIComponent(JSON.stringify(data))}`;
        script.src = url;
        script.onerror = () => {
            document.head.removeChild(script);
            delete window[callbackName];
            reject(new Error('JSONP request failed'));
        };

        document.head.appendChild(script);
    });
}

// UI Helper Functions
function toggleRevisiField() {
    const status = document.getElementById('rkaol-status').value;
    const revisiGroup = document.getElementById('revisi-group');
    
    if (status === 'revision') {
        revisiGroup.style.display = 'block';
        document.getElementById('alasan-revisi').required = true;
    } else {
        revisiGroup.style.display = 'none';
        document.getElementById('alasan-revisi').required = false;
    }
}

function showLoading(show) {
    loadingOverlay.style.display = show ? 'flex' : 'none';
}

function showNotification(message, type = 'success') {
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.style.display = 'block';
    
    setTimeout(() => {
        notification.style.display = 'none';
    }, 5000);
}

// Dashboard Updates
function updateDashboard() {
    updateSummaryCards();
    populateForms();
}

function updateSummaryCards() {
    const totalAktif = Object.values(sopData.status).filter(status => 
        status === 'active' || status === 'revision'
    ).length;
    
    const totalSelesai = Object.values(sopData.status).filter(status => 
        status === 'completed'
    ).length;
    
    const totalRevisi = Object.values(sopData.status).filter(status => 
        status === 'revision'
    ).length;

    document.getElementById('total-aktif').textContent = totalAktif;
    document.getElementById('total-selesai').textContent = totalSelesai;
    document.getElementById('total-revisi').textContent = totalRevisi;
}

function updateProgressSteps() {
    const statusMapping = {
        'pending': 'pending',
        'active': 'active', 
        'completed': 'completed',
        'revision': 'pending'
    };

    Object.keys(sopData.status).forEach((step, index) => {
        const stepElement = document.querySelector(`[data-step="${index + 1}"]`);
        const statusElement = document.getElementById(`status-${index + 1}`);
        
        if (stepElement && statusElement) {
            const status = sopData.status[step];
            const mappedStatus = statusMapping[status];
            
            // Reset classes
            stepElement.className = 'progress-step';
            statusElement.className = 'step-status';
            
            // Add new classes
            stepElement.classList.add(mappedStatus);
            statusElement.classList.add(mappedStatus);
            
            // Update text
            statusElement.textContent = getStatusText(status);
        }
    });
}

function getStatusText(status) {
    const statusTexts = {
        'pending': 'Pending',
        'active': 'Sedang Berjalan',
        'completed': 'Selesai',
        'revision': 'Perlu Revisi'
    };
    return statusTexts[status] || 'Pending';
}

function populateForms() {
    // Populate Persiapan Form
    if (sopData.persiapan) {
        const form = document.getElementById('form-persiapan');
        if (form) {
            form.elements['targetUKT'].value = sopData.persiapan.targetUKT || '';
            form.elements['targetNonUKT'].value = sopData.persiapan.targetNonUKT || '';
            form.elements['periode'].value = sopData.persiapan.periode || '';
            form.elements['catatan'].value = sopData.persiapan.catatan || '';
        }
    }

    // Populate SAKTI Form
    if (sopData.sakti) {
        const form = document.getElementById('form-sakti');
        if (form) {
            form.elements['namaKegiatan'].value = sopData.sakti.namaKegiatan || '';
            form.elements['totalAnggaran'].value = sopData.sakti.totalAnggaran || '';
            form.elements['statusRKAOL'].value = sopData.sakti.statusRKAOL || '';
            form.elements['alasanRevisi'].value = sopData.sakti.alasanRevisi || '';
            toggleRevisiField();
        }
    }

    // Populate Monitoring Form
    if (sopData.monitoring) {
        const form = document.getElementById('form-monitoring');
        if (form) {
            form.elements['indikatorKinerja'].value = sopData.monitoring.indikatorKinerja || '';
            form.elements['realisasi'].value = sopData.monitoring.realisasi || '';
            form.elements['evaluasi'].value = sopData.monitoring.evaluasi || '';
            form.elements['laporan'].value = sopData.monitoring.laporan || '';
        }
    }
}

// Local Storage Functions
function saveToLocalStorage() {
    try {
        localStorage.setItem(CONFIG.LOCAL_STORAGE_KEY, JSON.stringify(sopData));
    } catch (error) {
        console.error('Failed to save to localStorage:', error);
    }
}

function loadStoredData() {
    try {
        const stored = localStorage.getItem(CONFIG.LOCAL_STORAGE_KEY);
        if (stored) {
            sopData = { ...sopData, ...JSON.parse(stored) };
        }
    } catch (error) {
        console.error('Failed to load from localStorage:', error);
    }
}

// Utility Functions
function formatCurrency(amount) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR'
    }).format(amount);
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Export/Import Functions (optional)
function exportData() {
    const dataStr = JSON.stringify(sopData, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `sop_data_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
}

function importData(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            sopData = { ...sopData, ...importedData };
            saveToLocalStorage();
            updateDashboard();
            updateProgressSteps();
            showNotification('Data berhasil diimpor!', 'success');
        } catch (error) {
            showNotification('File tidak valid!', 'error');
        }
    };
    reader.readAsText(file);
}

// Debug Functions (untuk development)
function resetData() {
    if (confirm('Apakah Anda yakin ingin mereset semua data?')) {
        sopData = {
            persiapan: null,
            sakti: null,
            monitoring: null,
            status: {
                step1: 'pending',
                step2: 'pending',
                step3: 'pending',
                step4: 'pending'
            }
        };
        saveToLocalStorage();
        updateDashboard();
        updateProgressSteps();
        showNotification('Data berhasil direset!', 'warning');
    }
}

// Expose functions to global scope for debugging
window.sopSystem = {
    resetData,
    exportData,
    importData,
    sopData
};