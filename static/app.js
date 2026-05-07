const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const previewContainer = document.getElementById('previewContainer');
const imagePreview = document.getElementById('imagePreview');
const removeBtn = document.getElementById('removeBtn');
const classifyBtn = document.getElementById('classifyBtn');
const loading = document.getElementById('loading');
const resultsSection = document.getElementById('resultsSection');
const newScanBtn = document.getElementById('newScanBtn');
const resetBtn = document.getElementById('resetBtn');

const bagDropZone = document.getElementById('bagDropZone');
const bagFileInput = document.getElementById('bagFileInput');
const bagPreviewContainer = document.getElementById('bagPreviewContainer');
const bagImagePreview = document.getElementById('bagImagePreview');
const bagRemoveBtn = document.getElementById('bagRemoveBtn');
const checkBagBtn = document.getElementById('checkBagBtn');
const bagLoading = document.getElementById('bagLoading');
const bagResultsSection = document.getElementById('bagResultsSection');
const newBagCheckBtn = document.getElementById('newBagCheckBtn');
const bagCheckerSection = document.getElementById('bagCheckerSection');
const uploadSection = document.querySelector('.upload-section');

let selectedFile = null;
let selectedBagFile = null;
let selectedBagType = 'green';
const API_BASE_URL = "https://eco-sort-svvs.onrender.com";
const HAS_BACKEND = API_BASE_URL.trim() !== "";

const BIN_CONFIG = {
    recycling: {
        icon: '♻️',
        name: 'Recycling',
        color: '#2196F3'
    },
    compost: {
        icon: '🌱',
        name: 'Compost',
        color: '#4CAF50'
    },
    landfill: {
        icon: '🗑️',
        name: 'Landfill',
        color: '#757575'
    },
    'e-waste': {
        icon: '🔌',
        name: 'E-Waste',
        color: '#F44336'
    }
};

function initStats() {
    const stats = localStorage.getItem('ecosortStats');
    if (!stats) {
        localStorage.setItem('ecosortStats', JSON.stringify({
            itemsCount: 0,
            totalWaste: 0,
            totalCo2: 0,
            totalMoney: 0
        }));
    }
    updateTotalDisplay();
}

function updateStats(wasteSaved, co2Saved, moneySaved) {
    const stats = JSON.parse(localStorage.getItem('ecosortStats'));
    stats.itemsCount += 1;
    stats.totalWaste += wasteSaved;
    stats.totalCo2 += co2Saved;
    stats.totalMoney += moneySaved;
    localStorage.setItem('ecosortStats', JSON.stringify(stats));
    updateTotalDisplay();
}

function updateTotalDisplay() {
    const stats = JSON.parse(localStorage.getItem('ecosortStats'));
    document.getElementById('totalWaste').textContent = stats.itemsCount;
    document.getElementById('totalWasteDiverted').textContent = formatWeight(stats.totalWaste);
    document.getElementById('totalCo2').textContent = formatWeight(stats.totalCo2);
    document.getElementById('totalMoney').textContent = formatMoney(stats.totalMoney);
}

function formatWeight(grams) {
    if (grams >= 1000) {
        return (grams / 1000).toFixed(1) + 'kg';
    }
    return grams + 'g';
}

function formatMoney(cents) {
    return '$' + (cents / 100).toFixed(2);
}

function resetStats() {
    if (confirm('Are you sure you want to reset all your stats?')) {
        localStorage.setItem('ecosortStats', JSON.stringify({
            itemsCount: 0,
            totalWaste: 0,
            totalCo2: 0,
            totalMoney: 0
        }));
        updateTotalDisplay();
    }
}

function showBackendRequiredMessage(featureName) {
    alert(`${featureName} requires a deployed backend API. Set API_BASE_URL in static/app.js to enable this feature.`);
}

async function postToApi(path, formData) {
    if (!HAS_BACKEND) {
        return {
            ok: false,
            error: "Backend not configured. Set API_BASE_URL to your deployed Flask backend."
        };
    }

    const normalizedBase = API_BASE_URL.replace(/\/$/, '');
    const endpoint = `${normalizedBase}${path}`;

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            body: formData
        });

        let data = {};
        try {
            data = await response.json();
        } catch (_err) {
            data = {};
        }

        if (!response.ok || data.error) {
            return {
                ok: false,
                error: data.error || "Request failed. Please try again."
            };
        }

        return { ok: true, data };
    } catch (_error) {
        return {
            ok: false,
            error: "Unable to reach backend. Check API_BASE_URL and backend availability."
        };
    }
}

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type.startsWith('image/')) {
        handleFile(files[0]);
    }
});

dropZone.addEventListener('click', (e) => {
    if (e.target !== removeBtn && !removeBtn.contains(e.target)) {
        if (!selectedFile) {
            fileInput.click();
        }
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
    }
});

function handleFile(file) {
    selectedFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
        imagePreview.src = e.target.result;
        document.querySelector('.upload-content').style.display = 'none';
        previewContainer.style.display = 'block';
        classifyBtn.disabled = false;
    };
    reader.readAsDataURL(file);
}

removeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    clearPreview();
});

function clearPreview() {
    selectedFile = null;
    imagePreview.src = '';
    previewContainer.style.display = 'none';
    document.querySelector('.upload-content').style.display = 'flex';
    classifyBtn.disabled = true;
    fileInput.value = '';
}

classifyBtn.addEventListener('click', classifyImage);

async function classifyImage() {
    if (!selectedFile) return;
    if (!HAS_BACKEND) {
        showBackendRequiredMessage('AI item scanner');
        return;
    }
    
    loading.classList.add('active');
    classifyBtn.style.display = 'none';
    resultsSection.style.display = 'none';
    
    const formData = new FormData();
    formData.append('image', selectedFile);
    
    try {
        const result = await postToApi('/classify-image', formData);
        if (!result.ok) throw new Error(result.error);
        const data = result.data;
        
        displayResults(data);
        updateStats(data.waste_saved_grams, data.co2_saved_grams, data.money_saved_cents);
        
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to classify image: ' + error.message);
    } finally {
        loading.classList.remove('active');
        classifyBtn.style.display = 'block';
    }
}

function displayResults(data) {
    const binType = data.bin;
    const binConfig = BIN_CONFIG[binType] || BIN_CONFIG.landfill;
    
    const resultCard = document.getElementById('resultCard');
    resultCard.className = 'result-card ' + binType;
    
    document.getElementById('binIcon').textContent = binConfig.icon;
    document.getElementById('itemName').textContent = data.item;
    
    const binName = document.getElementById('binName');
    binName.textContent = binConfig.name;
    binName.className = 'bin-name ' + binType;
    
    document.getElementById('confidenceLabel').textContent = 
        'Confidence: ' + (data.confidence || 'Medium').charAt(0).toUpperCase() + 
        (data.confidence || 'medium').slice(1);
    
    document.getElementById('wasteSaved').textContent = formatWeight(data.waste_saved_grams);
    document.getElementById('co2Saved').textContent = formatWeight(data.co2_saved_grams);
    document.getElementById('moneySaved').textContent = formatMoney(data.money_saved_cents);
    
    resultsSection.style.display = 'block';
    resultsSection.scrollIntoView({ behavior: 'smooth' });
}

newScanBtn.addEventListener('click', () => {
    clearPreview();
    resultsSection.style.display = 'none';
    document.querySelector('.upload-section').scrollIntoView({ behavior: 'smooth' });
});

resetBtn.addEventListener('click', resetStats);

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        const tab = btn.dataset.tab;
        
        if (tab === 'item-scanner') {
            uploadSection.style.display = 'block';
            resultsSection.style.display = resultsSection.dataset.wasVisible === 'true' ? 'block' : 'none';
            bagCheckerSection.style.display = 'none';
            bagResultsSection.style.display = 'none';
            document.getElementById('itemScannerSteps').style.display = 'flex';
            document.getElementById('bagCheckerSteps').style.display = 'none';
        } else {
            resultsSection.dataset.wasVisible = resultsSection.style.display !== 'none';
            uploadSection.style.display = 'none';
            resultsSection.style.display = 'none';
            bagCheckerSection.style.display = 'block';
            bagResultsSection.style.display = bagResultsSection.dataset.wasVisible === 'true' ? 'block' : 'none';
            document.getElementById('itemScannerSteps').style.display = 'none';
            document.getElementById('bagCheckerSteps').style.display = 'flex';
        }
    });
});

document.querySelectorAll('.bag-option').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.bag-option').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedBagType = btn.dataset.bag;
    });
});

bagDropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    bagDropZone.classList.add('dragover');
});

bagDropZone.addEventListener('dragleave', () => {
    bagDropZone.classList.remove('dragover');
});

bagDropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    bagDropZone.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type.startsWith('image/')) {
        handleBagFile(files[0]);
    }
});

bagDropZone.addEventListener('click', (e) => {
    if (e.target !== bagRemoveBtn && !bagRemoveBtn.contains(e.target)) {
        if (!selectedBagFile) {
            bagFileInput.click();
        }
    }
});

bagFileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleBagFile(e.target.files[0]);
    }
});

function handleBagFile(file) {
    selectedBagFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
        bagImagePreview.src = e.target.result;
        document.getElementById('bagUploadContent').style.display = 'none';
        bagPreviewContainer.style.display = 'block';
        checkBagBtn.disabled = false;
    };
    reader.readAsDataURL(file);
}

bagRemoveBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    clearBagPreview();
});

function clearBagPreview() {
    selectedBagFile = null;
    bagImagePreview.src = '';
    bagPreviewContainer.style.display = 'none';
    document.getElementById('bagUploadContent').style.display = 'flex';
    checkBagBtn.disabled = true;
    bagFileInput.value = '';
}

checkBagBtn.addEventListener('click', checkBagQuality);

async function checkBagQuality() {
    if (!selectedBagFile) return;
    if (!HAS_BACKEND) {
        showBackendRequiredMessage('Bag quality checker');
        return;
    }
    
    bagLoading.classList.add('active');
    checkBagBtn.style.display = 'none';
    bagResultsSection.style.display = 'none';
    
    const formData = new FormData();
    formData.append('image', selectedBagFile);
    formData.append('bag_type', selectedBagType);
    
    try {
        const result = await postToApi('/check-bag', formData);
        if (!result.ok) throw new Error(result.error);
        const data = result.data;
        
        displayBagResults(data);
        
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to analyze bag: ' + error.message);
    } finally {
        bagLoading.classList.remove('active');
        checkBagBtn.style.display = 'block';
    }
}

function displayBagResults(data) {
    const scoreCard = document.getElementById('scoreCard');
    scoreCard.className = 'score-card grade-' + data.grade.toLowerCase();
    
    document.getElementById('scoreValue').textContent = data.score;
    document.getElementById('gradeBadge').textContent = data.grade;
    
    const verdict = document.getElementById('verdict');
    const verdictIcon = document.getElementById('verdictIcon');
    const verdictText = document.getElementById('verdictText');
    
    if (data.is_properly_sorted) {
        verdict.className = 'verdict pass';
        verdictIcon.innerHTML = '&#10004;';
        verdictText.textContent = 'Properly Sorted';
    } else {
        verdict.className = 'verdict fail';
        verdictIcon.innerHTML = '&#10008;';
        verdictText.textContent = 'Needs Improvement';
    }
    
    const itemsContainer = document.getElementById('itemsDetected');
    itemsContainer.innerHTML = '';
    (data.items_detected || []).forEach(item => {
        const tag = document.createElement('span');
        tag.className = 'item-tag';
        tag.textContent = item;
        itemsContainer.appendChild(tag);
    });
    
    const issuesCard = document.getElementById('issuesCard');
    const issuesList = document.getElementById('issuesList');
    issuesList.innerHTML = '';
    
    if (data.contamination_issues && data.contamination_issues.length > 0) {
        issuesCard.style.display = 'block';
        data.contamination_issues.forEach(issue => {
            const li = document.createElement('li');
            li.textContent = issue;
            issuesList.appendChild(li);
        });
    } else {
        issuesCard.style.display = 'none';
    }
    
    document.getElementById('explanationText').textContent = data.explanation;
    
    const suggestionsList = document.getElementById('suggestionsList');
    suggestionsList.innerHTML = '';
    (data.suggestions || []).forEach(suggestion => {
        const li = document.createElement('li');
        li.textContent = suggestion;
        suggestionsList.appendChild(li);
    });
    
    const confidenceNotice = document.getElementById('confidenceNotice');
    const confidenceText = document.getElementById('confidenceText');
    
    if (data.confidence === 'low') {
        confidenceNotice.style.display = 'flex';
        confidenceText.textContent = 'Low Confidence - Image may be unclear or items hard to identify';
    } else if (data.confidence === 'medium') {
        confidenceNotice.style.display = 'flex';
        confidenceText.textContent = 'Medium Confidence - Some items may not be clearly visible';
    } else {
        confidenceNotice.style.display = 'none';
    }
    
    bagResultsSection.style.display = 'block';
    bagResultsSection.dataset.wasVisible = 'true';
    bagResultsSection.scrollIntoView({ behavior: 'smooth' });
}

newBagCheckBtn.addEventListener('click', () => {
    clearBagPreview();
    bagResultsSection.style.display = 'none';
    bagResultsSection.dataset.wasVisible = 'false';
    bagCheckerSection.scrollIntoView({ behavior: 'smooth' });
});

initStats();
