// API Configuration
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? '' 
    : 'https://eco-sort-svvs.onrender.com';

let currentUser = null;
let isManagement = false;
let selectedFile = null;
let selectedBagFile = null;
let selectedBagType = 'green';
let currentBagAnalysis = null;
let stagedBags = [];

const BIN_CONFIG = {
    recycling: { icon: '♻️', name: 'Recycling', color: '#2D9CDB' },
    compost: { icon: '🌱', name: 'Compost', color: '#22C55E' },
    landfill: { icon: '🗑️', name: 'Waste', color: '#6B7280' },
    'e-waste': { icon: '🔌', name: 'E-Waste', color: '#E4572E' }
};

const PICKUP_COLORS = {
    green: { color: '#22C55E', label: 'Compost' },
    blue: { color: '#2D9CDB', label: 'Recycling' },
    white: { color: '#94A3B8', label: 'Waste' }
};

const BAG_TYPE_META = {
    green: { label: 'Green', name: 'Compost' },
    blue: { label: 'Blue', name: 'Recycling' },
    white: { label: 'White', name: 'Waste' }
};

const FEEDBACK_BAG_ORDER = ['green', 'blue', 'white'];

const managementBagCache = new Map();
const householdBagTypes = new Map();
let selectedFeedbackBagType = 'green';

const FEEDBACK_REASONS = {
    green: [
        'Waste in compost',
        'Recycling in compost',
        'Plastic bags in compost',
        'Glass or metal in compost',
        'Liquids in compost'
    ],
    blue: [
        'Waste in recycling',
        'Food residue in recycling',
        'Plastic film in recycling',
        'Electronics in recycling',
        'Liquids in recycling'
    ],
    white: [
        'Recycling in waste',
        'Compost in waste',
        'Batteries in waste',
        'Hazardous items in waste',
        'E-waste in waste'
    ]
};

function showView(viewId) {
    ['landingView', 'userLoginView', 'mgmtLoginView', 'userDashboard', 'mgmtDashboard'].forEach(id => {
        document.getElementById(id).style.display = 'none';
    });
    document.getElementById(viewId).style.display = 'block';
}

function resetUserSession() {
    selectedFile = null;
    selectedBagFile = null;
    selectedBagType = 'green';
    currentBagAnalysis = null;
    stagedBags = [];
    
    document.getElementById('imagePreview').src = '';
    document.getElementById('previewContainer').style.display = 'none';
    document.getElementById('dropZone').querySelector('.upload-content').style.display = 'flex';
    document.getElementById('classifyBtn').disabled = true;
    document.getElementById('fileInput').value = '';
    
    document.getElementById('bagImagePreview').src = '';
    document.getElementById('bagPreviewContainer').style.display = 'none';
    document.getElementById('bagUploadContent').style.display = 'flex';
    document.getElementById('checkBagBtn').disabled = true;
    document.getElementById('bagFileInput').value = '';
    
    document.getElementById('resultsSection').style.display = 'none';
    document.getElementById('bagResultsSection').style.display = 'none';
    document.getElementById('bagQueueSection').style.display = 'none';
    
    document.getElementById('itemScannerSection').style.display = 'block';
    document.getElementById('bagCheckerSection').style.display = 'none';
    
    document.getElementById('itemScannerSteps').style.display = 'flex';
    document.getElementById('bagCheckerSteps').style.display = 'none';
    
    document.querySelectorAll('.user-tabs .tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.user-tabs .tab-btn[data-tab="item-scanner"]').classList.add('active');
    
    document.querySelectorAll('.bag-checker-section .bag-option').forEach(b => b.classList.remove('active'));
    document.querySelector('.bag-checker-section .bag-option[data-bag="green"]').classList.add('active');

    renderBagQueue();
    
    document.getElementById('userName').value = '';
    document.getElementById('houseNumber').value = '';
}

document.getElementById('userAccessBtn').addEventListener('click', () => showView('userLoginView'));
document.getElementById('mgmtAccessBtn').addEventListener('click', () => showView('mgmtLoginView'));
document.getElementById('userCardBtn').addEventListener('click', () => showView('userLoginView'));
document.getElementById('mgmtCardBtn').addEventListener('click', () => showView('mgmtLoginView'));
document.getElementById('userBackBtn').addEventListener('click', () => showView('landingView'));
document.getElementById('mgmtBackBtn').addEventListener('click', () => showView('landingView'));

document.getElementById('userLoginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('userName').value.trim();
    const houseNumber = document.getElementById('houseNumber').value.trim();
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/user/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, house_number: houseNumber })
        });
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        
        currentUser = data.user;
        isManagement = false;
        resetUserSession();
        showView('userDashboard');
        updateUserDashboard();
    } catch (error) {
        alert('Registration failed: ' + error.message);
    }
});

document.getElementById('mgmtLoginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('mgmtId').value.trim();
    const key = document.getElementById('mgmtKey').value.trim();
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/management/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, key })
        });
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        
        isManagement = true;
        showView('mgmtDashboard');
        updateManagementDashboard();
    } catch (error) {
        alert('Login failed: ' + error.message);
    }
});

document.getElementById('userLogout').addEventListener('click', () => {
    currentUser = null;
    resetUserSession();
    showView('landingView');
});

document.getElementById('mgmtLogout').addEventListener('click', () => {
    isManagement = false;
    showView('landingView');
});

async function updateUserDashboard() {
    if (!currentUser) return;
    
    document.getElementById('userDisplayName').textContent = currentUser.name;
    document.getElementById('userDisplayHouse').textContent = currentUser.house_number;
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/user/${currentUser.house_number}/stats`);
        const stats = await response.json();
        
        document.getElementById('userPoints').textContent = stats.total_points || 0;
        updateRedeemState(stats.total_points || 0);
        updatePointsImpact(stats.total_points || 0, stats.redemption_summary);
        document.getElementById('weeklyBags').textContent = stats.weekly_bags || 0;
        document.getElementById('weeklyScore').textContent = stats.weekly_avg_score ? stats.weekly_avg_score.toFixed(0) : '--';
        
        const scheduleDisplay = document.getElementById('scheduleDisplay');
        scheduleDisplay.innerHTML = '';
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        days.forEach(day => {
            const bagType = stats.pickup_schedule[day];
            if (bagType) {
                const config = PICKUP_COLORS[bagType];
                const dayEl = document.createElement('div');
                dayEl.className = 'schedule-day';
                dayEl.innerHTML = `<span class="day-name">${day.substring(0, 3)}</span>
                    <span class="day-bag" style="background: ${config.color}">${config.label}</span>`;
                scheduleDisplay.appendChild(dayEl);
            }
        });
        
        const feedbackSection = document.getElementById('feedbackSection');
        const feedbackList = document.getElementById('feedbackList');
        if (stats.management_feedback && stats.management_feedback.length > 0) {
            feedbackSection.style.display = 'block';
            feedbackList.innerHTML = '';
            stats.management_feedback.forEach(fb => {
                const fbEl = document.createElement('div');
                fbEl.className = 'feedback-item';
                const pointClass = fb.point_adjustment > 0 ? 'positive' : fb.point_adjustment < 0 ? 'negative' : '';
                const message = fb.feedback || 'Sorting issue noted.';
                const tags = [];
                if (fb.bag_type) {
                    const bagMeta = BAG_TYPE_META[fb.bag_type] || { label: fb.bag_type };
                    tags.push(`<span class="feedback-tag type-${fb.bag_type}">${bagMeta.label} Bag</span>`);
                }
                if (Array.isArray(fb.reasons) && fb.reasons.length > 0) {
                    fb.reasons.forEach(reason => tags.push(`<span class="feedback-tag">${reason}</span>`));
                }
                if (fb.points_override !== undefined && fb.points_override !== null) {
                    tags.push(`<span class="feedback-tag points">Points set to ${fb.points_override}</span>`);
                }
                const tagsHtml = tags.length > 0 ? `<div class="feedback-tags">${tags.join('')}</div>` : '';
                const pointsHtml = fb.point_adjustment !== 0
                    ? `<span class="point-change ${pointClass}">${fb.point_adjustment > 0 ? '+' : ''}${fb.point_adjustment} points</span>`
                    : '';
                fbEl.innerHTML = `<p>${message}</p>${tagsHtml}${pointsHtml}`;
                feedbackList.appendChild(fbEl);
            });
        } else {
            feedbackSection.style.display = 'none';
        }
    } catch (error) {
        console.error('Failed to load user stats:', error);
    }
}

function formatBagSubmittedAt(isoString) {
    if (!isoString) return '--';
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return '--';
    return date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function buildBagThumbs(household) {
    const bags = household.recent_bags || [];
    if (bags.length === 0) {
        return `<div class="bag-thumbs bag-thumbs-empty"><span>No bag photos yet</span></div>`;
    }

    const thumbsMarkup = bags.map((bag, index) => {
        const bagKey = bag.id !== undefined && bag.id !== null
            ? String(bag.id)
            : `${household.house_number}-${bag.submitted_at || index}`;
        const bagType = bag.bag_type || 'unknown';
        const bagMeta = BAG_TYPE_META[bagType] || { label: 'Unknown', name: 'Bag' };
        const scoreValue = Number.isFinite(bag.score) ? Math.round(bag.score) : '--';
        const scoreLabel = scoreValue === '--' ? '--' : `${scoreValue}%`;
        const imageMarkup = bag.image_data
            ? `<img src="${bag.image_data}" alt="${bagMeta.label} bag preview">`
            : `<div class="bag-thumb-placeholder">${bagMeta.label}</div>`;

        managementBagCache.set(bagKey, {
            ...bag,
            id: bagKey,
            house_number: household.house_number,
            resident_name: household.name
        });

        return `<button class="bag-thumb type-${bagType}" data-bag-id="${bagKey}" aria-label="${bagMeta.label} bag score ${scoreLabel}">
            ${imageMarkup}
            <span class="bag-thumb-score">${scoreLabel}</span>
        </button>`;
    }).join('');

    return `<div class="bag-thumbs">${thumbsMarkup}</div>`;
}

async function updateManagementDashboard() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/management/households`);
        const households = await response.json();

        managementBagCache.clear();
        householdBagTypes.clear();
        households.forEach(h => {
            const types = Array.isArray(h.bag_types_submitted) ? h.bag_types_submitted : [];
            const cleanTypes = types.filter(type => typeof type === 'string');
            householdBagTypes.set(String(h.house_number), new Set(cleanTypes));
        });
        
        document.getElementById('totalHouseholds').textContent = households.length;
        
        const totalBags = households.reduce((sum, h) => sum + h.bags_submitted, 0);
        document.getElementById('totalBagsSubmitted').textContent = totalBags;
        
        const householdsWithBags = households.filter(h => h.bags_submitted > 0);
        const avgScore = householdsWithBags.length > 0 
            ? householdsWithBags.reduce((sum, h) => sum + h.avg_score, 0) / householdsWithBags.length 
            : 0;
        document.getElementById('avgOverallScore').textContent = avgScore > 0 ? avgScore.toFixed(0) : '--';
        
        const grid = document.getElementById('householdGrid');
        const noDataMsg = document.getElementById('noHouseholdsMsg');
        
        if (households.length === 0) {
            grid.innerHTML = '';
            noDataMsg.style.display = 'block';
        } else {
            noDataMsg.style.display = 'none';
            grid.innerHTML = households.map(h => {
                const statusClass = h.status === 'ok' ? 'status-ok' : h.status === 'review' ? 'status-review' : h.status === 'needs_attention' ? 'status-attention' : 'status-nodata';
                const statusText = h.status === 'ok' ? 'OK' : h.status === 'review' ? 'Review' : h.status === 'needs_attention' ? 'Attention' : 'No Data';
                const bagThumbs = buildBagThumbs(h);
                return `<div class="household-card ${statusClass}">
                    <div class="household-card-header">
                        <span class="house-number">#${h.house_number}</span>
                        <span class="status-badge ${statusClass}">${statusText}</span>
                    </div>
                    <div class="household-icon">🏠</div>
                    <div class="household-name">${h.name || 'Resident'}</div>
                    <div class="household-metrics">
                        <div class="metric">
                            <span class="metric-label">Bags</span>
                            <span class="metric-value">${h.bags_submitted}</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Avg</span>
                            <span class="metric-value">${h.avg_score > 0 ? h.avg_score.toFixed(0) : '--'}</span>
                        </div>
                    </div>
                    ${bagThumbs}
                    <button class="feedback-btn" data-house="${h.house_number}">Feedback</button>
                </div>`;
            }).join('');
            
            document.querySelectorAll('.feedback-btn').forEach(btn => {
                btn.addEventListener('click', () => openFeedbackModal(btn.dataset.house));
            });

            document.querySelectorAll('.bag-thumb').forEach(btn => {
                btn.addEventListener('click', () => openBagDetail(btn.dataset.bagId));
            });
        }
    } catch (error) {
        console.error('Failed to load households:', error);
    }
}

let currentFeedbackHouse = null;
const feedbackReasonList = document.getElementById('feedbackReasonList');
const feedbackBagButtons = document.querySelectorAll('.feedback-bag-options .bag-option');
const feedbackConfirmationModal = document.getElementById('feedbackConfirmationModal');
const feedbackConfirmationHouse = document.getElementById('feedbackConfirmationHouse');
const feedbackConfirmationClose = document.getElementById('feedbackConfirmationClose');

function renderFeedbackReasons(bagType) {
    if (!feedbackReasonList) return;
    if (!bagType) {
        feedbackReasonList.innerHTML = '<p class="reason-empty">No bag submissions yet.</p>';
        return;
    }
    const reasons = FEEDBACK_REASONS[bagType] || [];
    feedbackReasonList.innerHTML = reasons.map(reason => `
        <label class="reason-item">
            <input type="checkbox" value="${reason}">
            <span>${reason}</span>
        </label>
    `).join('');
}

function setFeedbackBagType(bagType) {
    if (!bagType) {
        selectedFeedbackBagType = null;
        feedbackBagButtons.forEach(btn => btn.classList.remove('active'));
        renderFeedbackReasons(null);
        return;
    }
    const targetButton = Array.from(feedbackBagButtons)
        .find(btn => btn.dataset.bag === bagType);
    if (targetButton && targetButton.disabled) return;
    selectedFeedbackBagType = bagType;
    feedbackBagButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.bag === bagType);
    });
    renderFeedbackReasons(bagType);
}

function applyFeedbackBagAvailability(availableTypes) {
    const hasAvailable = availableTypes && availableTypes.size > 0;
    feedbackBagButtons.forEach(btn => {
        const bagType = btn.dataset.bag;
        const isAvailable = hasAvailable && availableTypes.has(bagType);
        btn.disabled = !isAvailable;
        btn.classList.toggle('disabled', !isAvailable);
        if (!isAvailable) {
            btn.classList.remove('active');
        }
    });
    if (!hasAvailable) {
        setFeedbackBagType(null);
        return;
    }
    const preferred = (selectedFeedbackBagType && availableTypes.has(selectedFeedbackBagType))
        ? selectedFeedbackBagType
        : FEEDBACK_BAG_ORDER.find(type => availableTypes.has(type));
    setFeedbackBagType(preferred || null);
}

function openFeedbackModal(houseNumber) {
    currentFeedbackHouse = houseNumber;
    document.getElementById('feedbackHouseNum').textContent = houseNumber;
    document.getElementById('feedbackText').value = '';
    document.getElementById('pointsOverride').value = '';
    const availableTypes = householdBagTypes.get(String(houseNumber)) || new Set();
    applyFeedbackBagAvailability(availableTypes);
    document.getElementById('feedbackModal').style.display = 'flex';
}

feedbackBagButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        if (btn.disabled) return;
        setFeedbackBagType(btn.dataset.bag);
    });
});

document.getElementById('cancelFeedback').addEventListener('click', () => {
    document.getElementById('feedbackModal').style.display = 'none';
});

document.getElementById('feedbackForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const feedback = document.getElementById('feedbackText').value.trim();
    const pointsOverrideInput = document.getElementById('pointsOverride').value.trim();
    let pointsOverride = null;
    if (pointsOverrideInput !== '') {
        pointsOverride = parseInt(pointsOverrideInput, 10);
        if (!Number.isFinite(pointsOverride) || pointsOverride < 0) {
            alert('Override points must be a non-negative number.');
            return;
        }
    }
    const reasons = Array.from(document.querySelectorAll('#feedbackReasonList input[type="checkbox"]:checked'))
        .map(input => input.value);
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/management/feedback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                house_number: currentFeedbackHouse,
                feedback: feedback,
                points_override: pointsOverride,
                bag_type: selectedFeedbackBagType,
                reasons: reasons
            })
        });
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        
        document.getElementById('feedbackModal').style.display = 'none';
        updateManagementDashboard();
        if (feedbackConfirmationHouse) {
            feedbackConfirmationHouse.textContent = currentFeedbackHouse || '';
        }
        if (feedbackConfirmationModal) {
            feedbackConfirmationModal.style.display = 'flex';
        }
    } catch (error) {
        alert('Failed to send feedback: ' + error.message);
    }
});

function closeFeedbackConfirmation() {
    if (feedbackConfirmationModal) {
        feedbackConfirmationModal.style.display = 'none';
    }
}

if (feedbackConfirmationClose) {
    feedbackConfirmationClose.addEventListener('click', closeFeedbackConfirmation);
}

if (feedbackConfirmationModal) {
    feedbackConfirmationModal.addEventListener('click', (e) => {
        if (e.target.id === 'feedbackConfirmationModal') {
            closeFeedbackConfirmation();
        }
    });
}

const redeemModal = document.getElementById('redeemModal');
const redeemOptions = document.querySelectorAll('.redeem-option');

function updateRedeemState(points) {
    const redeemPoints = document.getElementById('redeemPoints');
    if (!redeemPoints) return;
    const safePoints = Number.isFinite(points) ? points : 0;
    redeemPoints.textContent = safePoints;
    redeemOptions.forEach(option => {
        const cost = parseInt(option.dataset.cost, 10);
        const disabled = !Number.isFinite(cost) || safePoints < cost;
        option.classList.toggle('disabled', disabled);
        option.disabled = disabled;
    });
}

function updatePointsImpact(points, redemptionSummary) {
    const safePoints = Number.isFinite(points) ? points : 0;
    const summary = redemptionSummary || {};
    const treeCredits = Number.isFinite(summary.trees_planted) ? summary.trees_planted : 0;
    const farmCredits = Number.isFinite(summary.local_credits) ? summary.local_credits : 0;
    const co2Credits = Math.max(0, Math.round(safePoints * 0.2));
    document.getElementById('treeCredits').textContent = treeCredits;
    document.getElementById('farmCredits').textContent = farmCredits;
    document.getElementById('co2Credits').textContent = co2Credits;
}

function openRedeemModal() {
    if (!currentUser) return;
    const currentPoints = parseInt(document.getElementById('userPoints').textContent, 10);
    updateRedeemState(Number.isFinite(currentPoints) ? currentPoints : 0);
    redeemModal.style.display = 'flex';
}

function closeRedeemModal() {
    redeemModal.style.display = 'none';
}

document.getElementById('redeemBtn').addEventListener('click', openRedeemModal);
document.getElementById('redeemClose').addEventListener('click', closeRedeemModal);
redeemModal.addEventListener('click', (e) => {
    if (e.target.id === 'redeemModal') {
        closeRedeemModal();
    }
});

redeemOptions.forEach(option => {
    option.addEventListener('click', async () => {
        if (option.classList.contains('disabled') || !currentUser) return;
        const rewardId = option.dataset.rewardId;
        const cost = parseInt(option.dataset.cost, 10);
        const title = option.querySelector('.redeem-title')?.textContent || 'this reward';
        const confirmed = window.confirm(`Redeem ${cost} points for ${title}?`);
        if (!confirmed) return;

        try {
            const response = await fetch(`${API_BASE_URL}/api/user/redeem`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    house_number: currentUser.house_number,
                    reward_id: rewardId
                })
            });
            const data = await response.json();
            if (data.error) throw new Error(data.error);
            currentUser.total_points = data.total_points;
            document.getElementById('userPoints').textContent = data.total_points;
            updateRedeemState(data.total_points);
            updatePointsImpact(data.total_points, data.redemption_summary);
            closeRedeemModal();
            alert('Redemption request submitted!');
        } catch (error) {
            alert('Redemption failed: ' + error.message);
        }
    });
});

function openBagDetail(bagId) {
    const bag = managementBagCache.get(String(bagId));
    if (!bag) return;

    const bagType = bag.bag_type || 'unknown';
    const bagMeta = BAG_TYPE_META[bagType] || { label: 'Unknown', name: 'Bag' };

    document.getElementById('bagDetailHouse').textContent = bag.house_number || '--';
    document.getElementById('bagDetailDate').textContent = formatBagSubmittedAt(bag.submitted_at);

    const bagTypePill = document.getElementById('bagDetailType');
    bagTypePill.textContent = `${bagMeta.label} Bag`;
    bagTypePill.className = `bag-type-pill type-${bagType}`;

    const imageEl = document.getElementById('bagDetailImage');
    const placeholderEl = document.getElementById('bagDetailPlaceholder');
    if (bag.image_data) {
        imageEl.src = bag.image_data;
        imageEl.style.display = 'block';
        placeholderEl.style.display = 'none';
    } else {
        imageEl.removeAttribute('src');
        imageEl.style.display = 'none';
        placeholderEl.style.display = 'flex';
    }

    const scoreCard = document.getElementById('mgmtScoreCard');
    const grade = (bag.grade || 'C').toString().toLowerCase();
    scoreCard.className = `score-card grade-${grade}`;
    document.getElementById('mgmtScoreValue').textContent = Number.isFinite(bag.score) ? Math.round(bag.score) : '--';
    document.getElementById('mgmtGradeBadge').textContent = (bag.grade || '--').toString().toUpperCase();

    const isSorted = bag.is_properly_sorted ?? (Number.isFinite(bag.score) ? bag.score >= 75 : false);
    const verdict = document.getElementById('mgmtVerdict');
    if (isSorted) {
        verdict.className = 'verdict pass';
        document.getElementById('mgmtVerdictIcon').innerHTML = '&#10004;';
        document.getElementById('mgmtVerdictText').textContent = 'Properly Sorted';
    } else {
        verdict.className = 'verdict fail';
        document.getElementById('mgmtVerdictIcon').innerHTML = '&#10008;';
        document.getElementById('mgmtVerdictText').textContent = 'Needs Improvement';
    }

    const itemsDetected = document.getElementById('mgmtItemsDetected');
    const items = bag.items_detected || [];
    itemsDetected.innerHTML = items.length > 0
        ? items.map(item => `<span class="item-tag">${item}</span>`).join('')
        : '<span class="item-tag muted">No items detected</span>';

    const issuesCard = document.getElementById('mgmtIssuesCard');
    const issuesList = document.getElementById('mgmtIssuesList');
    if (bag.contamination_issues && bag.contamination_issues.length > 0) {
        issuesCard.style.display = 'block';
        issuesList.innerHTML = bag.contamination_issues.map(issue => `<li>${issue}</li>`).join('');
    } else {
        issuesCard.style.display = 'none';
    }

    document.getElementById('mgmtExplanation').textContent = bag.explanation || 'No additional analysis provided.';

    const suggestionsList = document.getElementById('mgmtSuggestionsList');
    const suggestions = bag.suggestions || [];
    suggestionsList.innerHTML = suggestions.length > 0
        ? suggestions.map(suggestion => `<li>${suggestion}</li>`).join('')
        : '<li>No suggestions provided.</li>';

    const confidenceNotice = document.getElementById('mgmtConfidenceNotice');
    if (bag.confidence === 'low' || bag.confidence === 'medium') {
        confidenceNotice.style.display = 'flex';
        document.getElementById('mgmtConfidenceText').textContent = bag.confidence === 'low'
            ? 'Low Confidence - Image may be unclear'
            : 'Medium Confidence - Some items may not be visible';
    } else {
        confidenceNotice.style.display = 'none';
    }

    document.getElementById('bagDetailModal').style.display = 'flex';
}

function closeBagDetail() {
    document.getElementById('bagDetailModal').style.display = 'none';
}

document.getElementById('bagDetailClose').addEventListener('click', closeBagDetail);
document.getElementById('bagDetailModal').addEventListener('click', (e) => {
    if (e.target.id === 'bagDetailModal') {
        closeBagDetail();
    }
});

document.querySelectorAll('.user-tabs .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.user-tabs .tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        const tab = btn.dataset.tab;
        
        document.getElementById('itemScannerSection').style.display = tab === 'item-scanner' ? 'block' : 'none';
        document.getElementById('resultsSection').style.display = 'none';
        document.getElementById('bagCheckerSection').style.display = tab === 'bag-checker' ? 'block' : 'none';
        document.getElementById('bagResultsSection').style.display = 'none';
        document.getElementById('bagQueueSection').style.display = tab === 'bag-checker' ? 'block' : 'none';
        
        document.getElementById('itemScannerSteps').style.display = tab === 'item-scanner' ? 'flex' : 'none';
        document.getElementById('bagCheckerSteps').style.display = tab === 'bag-checker' ? 'flex' : 'none';
        if (tab === 'bag-checker') {
            renderBagQueue();
        }
    });
});

const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const previewContainer = document.getElementById('previewContainer');
const imagePreview = document.getElementById('imagePreview');
const removeBtn = document.getElementById('removeBtn');
const classifyBtn = document.getElementById('classifyBtn');
const loading = document.getElementById('loading');
const resultsSection = document.getElementById('resultsSection');

dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => { dropZone.classList.remove('dragover'); });
dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0 && e.dataTransfer.files[0].type.startsWith('image/')) {
        handleFile(e.dataTransfer.files[0]);
    }
});
dropZone.addEventListener('click', (e) => {
    if (e.target.closest('.file-label')) return;
    if (e.target !== removeBtn && !removeBtn.contains(e.target) && !selectedFile) {
        fileInput.click();
    }
});
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) handleFile(e.target.files[0]);
});

function handleFile(file) {
    selectedFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
        imagePreview.src = e.target.result;
        dropZone.querySelector('.upload-content').style.display = 'none';
        previewContainer.style.display = 'block';
        classifyBtn.disabled = false;
    };
    reader.readAsDataURL(file);
}

removeBtn.addEventListener('click', (e) => { e.stopPropagation(); clearPreview(); });

function clearPreview() {
    selectedFile = null;
    imagePreview.src = '';
    previewContainer.style.display = 'none';
    dropZone.querySelector('.upload-content').style.display = 'flex';
    classifyBtn.disabled = true;
    fileInput.value = '';
}

classifyBtn.addEventListener('click', async () => {
    if (!selectedFile) return;
    loading.classList.add('active');
    classifyBtn.style.display = 'none';
    
    const formData = new FormData();
    formData.append('image', selectedFile);
    
    try {
        const response = await fetch(`${API_BASE_URL}/classify-image`, { method: 'POST', body: formData });
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        displayResults(data);
    } catch (error) {
        alert('Failed to classify image: ' + error.message);
    } finally {
        loading.classList.remove('active');
        classifyBtn.style.display = 'block';
    }
});

function displayResults(data) {
    const binType = data.bin;
    const binConfig = BIN_CONFIG[binType] || BIN_CONFIG.landfill;
    
    document.getElementById('resultCard').className = 'result-card ' + binType;
    document.getElementById('binIcon').textContent = binConfig.icon;
    document.getElementById('itemName').textContent = data.item;
    
    const binName = document.getElementById('binName');
    binName.textContent = binType === 'landfill' ? 'Waste' : binConfig.name;
    binName.className = 'bin-name ' + binType;
    
    document.getElementById('confidenceLabel').textContent = 'Confidence: ' + (data.confidence || 'Medium').charAt(0).toUpperCase() + (data.confidence || 'medium').slice(1);
    document.getElementById('wasteSaved').textContent = formatWeight(data.waste_saved_grams);
    document.getElementById('co2Saved').textContent = formatWeight(data.co2_saved_grams);
    document.getElementById('moneySaved').textContent = formatMoney(data.money_saved_cents);
    
    resultsSection.style.display = 'block';
    resultsSection.scrollIntoView({ behavior: 'smooth' });
}

document.getElementById('newScanBtn').addEventListener('click', () => {
    clearPreview();
    resultsSection.style.display = 'none';
});

const bagDropZone = document.getElementById('bagDropZone');
const bagFileInput = document.getElementById('bagFileInput');
const bagPreviewContainer = document.getElementById('bagPreviewContainer');
const bagImagePreview = document.getElementById('bagImagePreview');
const bagRemoveBtn = document.getElementById('bagRemoveBtn');
const checkBagBtn = document.getElementById('checkBagBtn');
const bagLoading = document.getElementById('bagLoading');
const bagResultsSection = document.getElementById('bagResultsSection');

document.querySelectorAll('.bag-checker-section .bag-option').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.bag-checker-section .bag-option').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedBagType = btn.dataset.bag;
    });
});

bagDropZone.addEventListener('dragover', (e) => { e.preventDefault(); bagDropZone.classList.add('dragover'); });
bagDropZone.addEventListener('dragleave', () => { bagDropZone.classList.remove('dragover'); });
bagDropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    bagDropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0 && e.dataTransfer.files[0].type.startsWith('image/')) {
        handleBagFile(e.dataTransfer.files[0]);
    }
});
bagDropZone.addEventListener('click', (e) => {
    if (e.target.closest('.file-label')) return;
    if (e.target !== bagRemoveBtn && !bagRemoveBtn.contains(e.target) && !selectedBagFile) {
        bagFileInput.click();
    }
});
bagFileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) handleBagFile(e.target.files[0]);
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

bagRemoveBtn.addEventListener('click', (e) => { e.stopPropagation(); clearBagPreview(); });

function clearBagPreview() {
    selectedBagFile = null;
    bagImagePreview.src = '';
    bagPreviewContainer.style.display = 'none';
    document.getElementById('bagUploadContent').style.display = 'flex';
    checkBagBtn.disabled = true;
    bagFileInput.value = '';
    currentBagAnalysis = null;
}

checkBagBtn.addEventListener('click', async () => {
    if (!selectedBagFile) return;
    bagLoading.classList.add('active');
    checkBagBtn.style.display = 'none';
    
    const formData = new FormData();
    formData.append('image', selectedBagFile);
    formData.append('bag_type', selectedBagType);
    
    try {
        const response = await fetch(`${API_BASE_URL}/check-bag`, { method: 'POST', body: formData });
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        displayBagResults(data);
    } catch (error) {
        alert('Failed to analyze bag: ' + error.message);
    } finally {
        bagLoading.classList.remove('active');
        checkBagBtn.style.display = 'block';
    }
});

function displayBagResults(data) {
    currentBagAnalysis = {
        ...data,
        bag_type: selectedBagType,
        image_data: bagImagePreview.src || ''
    };
    document.getElementById('scoreCard').className = 'score-card grade-' + data.grade.toLowerCase();
    document.getElementById('scoreValue').textContent = data.score;
    document.getElementById('gradeBadge').textContent = data.grade;
    
    const verdict = document.getElementById('verdict');
    if (data.is_properly_sorted) {
        verdict.className = 'verdict pass';
        document.getElementById('verdictIcon').innerHTML = '&#10004;';
        document.getElementById('verdictText').textContent = 'Properly Sorted';
    } else {
        verdict.className = 'verdict fail';
        document.getElementById('verdictIcon').innerHTML = '&#10008;';
        document.getElementById('verdictText').textContent = 'Needs Improvement';
    }
    
    const itemsContainer = document.getElementById('itemsDetected');
    itemsContainer.innerHTML = (data.items_detected || []).map(item => `<span class="item-tag">${item}</span>`).join('');
    
    const issuesCard = document.getElementById('issuesCard');
    const issuesList = document.getElementById('issuesList');
    if (data.contamination_issues && data.contamination_issues.length > 0) {
        issuesCard.style.display = 'block';
        issuesList.innerHTML = data.contamination_issues.map(i => `<li>${i}</li>`).join('');
    } else {
        issuesCard.style.display = 'none';
    }
    
    document.getElementById('explanationText').textContent = data.explanation;
    document.getElementById('suggestionsList').innerHTML = (data.suggestions || []).map(s => `<li>${s}</li>`).join('');
    
    const confidenceNotice = document.getElementById('confidenceNotice');
    if (data.confidence === 'low' || data.confidence === 'medium') {
        confidenceNotice.style.display = 'flex';
        document.getElementById('confidenceText').textContent = data.confidence === 'low' ? 'Low Confidence - Image may be unclear' : 'Medium Confidence - Some items may not be visible';
    } else {
        confidenceNotice.style.display = 'none';
    }
    
    bagResultsSection.style.display = 'block';
    bagResultsSection.scrollIntoView({ behavior: 'smooth' });
}

document.getElementById('newBagCheckBtn').addEventListener('click', () => {
    if (currentBagAnalysis) {
        const bagId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        stagedBags.push({
            id: bagId,
            bag_type: currentBagAnalysis.bag_type,
            score: currentBagAnalysis.score,
            grade: currentBagAnalysis.grade,
            is_properly_sorted: currentBagAnalysis.is_properly_sorted,
            items_detected: currentBagAnalysis.items_detected || [],
            contamination_issues: currentBagAnalysis.contamination_issues || [],
            explanation: currentBagAnalysis.explanation || '',
            suggestions: currentBagAnalysis.suggestions || [],
            confidence: currentBagAnalysis.confidence || 'low',
            image_data: currentBagAnalysis.image_data || ''
        });
        renderBagQueue();
    }
    clearBagPreview();
    bagResultsSection.style.display = 'none';
});

const bagQueueList = document.getElementById('bagQueueList');
const submitBatchBtn = document.getElementById('submitBatchBtn');
const celebrationModal = document.getElementById('celebrationModal');
const celebrationList = document.getElementById('celebrationList');
const celebrationTotal = document.getElementById('celebrationTotal');
const celebrationDismiss = document.getElementById('celebrationDismiss');
const confetti = document.getElementById('confetti');

function renderBagQueue() {
    if (!bagQueueList || !submitBatchBtn) return;
    if (stagedBags.length === 0) {
        bagQueueList.innerHTML = '<p class="bag-queue-empty">No bags added yet.</p>';
        submitBatchBtn.disabled = true;
        submitBatchBtn.textContent = 'Submit Bags (0)';
        return;
    }

    bagQueueList.innerHTML = stagedBags.map(bag => {
        const bagMeta = BAG_TYPE_META[bag.bag_type] || { label: 'Unknown', name: 'Bag' };
        const scoreValue = Number.isFinite(bag.score) ? Math.round(bag.score) : '--';
        const imageMarkup = bag.image_data
            ? `<img src="${bag.image_data}" alt="${bagMeta.label} bag">`
            : `<div class="bag-queue-placeholder">${bagMeta.label} Bag</div>`;
        return `<div class="bag-queue-card" data-bag-id="${bag.id}">
            <div class="bag-queue-thumb">${imageMarkup}</div>
            <div class="bag-queue-info">
                <div class="bag-queue-title">${bagMeta.label} Bag</div>
                <div class="bag-queue-score">Score ${scoreValue}</div>
            </div>
            <button class="bag-queue-remove" aria-label="Remove bag">&times;</button>
        </div>`;
    }).join('');

    submitBatchBtn.disabled = false;
    submitBatchBtn.textContent = `Submit Bags (${stagedBags.length})`;

    bagQueueList.querySelectorAll('.bag-queue-remove').forEach(btn => {
        btn.addEventListener('click', (event) => {
            const card = event.target.closest('.bag-queue-card');
            if (!card) return;
            const bagId = card.dataset.bagId;
            stagedBags = stagedBags.filter(bag => bag.id !== bagId);
            renderBagQueue();
        });
    });
}

submitBatchBtn.addEventListener('click', async () => {
    if (!currentUser || stagedBags.length === 0) return;
    submitBatchBtn.disabled = true;
    submitBatchBtn.textContent = 'Submitting...';

    try {
        const response = await fetch(`${API_BASE_URL}/api/bag/submit-batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                house_number: currentUser.house_number,
                bags: stagedBags
            })
        });
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        showCelebrationModal(data.submissions || []);
        stagedBags = [];
        renderBagQueue();
        updateUserDashboard();
    } catch (error) {
        alert('Failed to submit bags: ' + error.message);
    } finally {
        if (stagedBags.length === 0) {
            submitBatchBtn.textContent = 'Submit Bags (0)';
        } else {
            submitBatchBtn.textContent = `Submit Bags (${stagedBags.length})`;
            submitBatchBtn.disabled = false;
        }
    }
});

function showCelebrationModal(submissions) {
    if (!celebrationModal || !celebrationList || !celebrationTotal) return;
    const totalPoints = submissions.reduce((sum, bag) => sum + (bag.points_earned || 0), 0);
    celebrationTotal.textContent = totalPoints;
    celebrationList.innerHTML = submissions.map(bag => {
        const bagMeta = BAG_TYPE_META[bag.bag_type] || { label: 'Unknown', name: 'Bag' };
        const scoreValue = Number.isFinite(bag.score) ? Math.round(bag.score) : '--';
        const pointsValue = bag.points_earned ?? 0;
        return `<div class="celebration-item">
            <div class="celebration-bag">${bagMeta.label} Bag</div>
            <div class="celebration-meta">Score ${scoreValue}</div>
            <div class="celebration-points">+${pointsValue} pts</div>
        </div>`;
    }).join('');
    buildConfetti();
    celebrationModal.style.display = 'flex';
}

function closeCelebrationModal() {
    if (!celebrationModal) return;
    celebrationModal.style.display = 'none';
    if (confetti) confetti.innerHTML = '';
}

function buildConfetti() {
    if (!confetti) return;
    const colors = ['#22C55E', '#2D9CDB', '#FACC15', '#F97316', '#A855F7'];
    confetti.innerHTML = '';
    for (let i = 0; i < 28; i++) {
        const span = document.createElement('span');
        const size = 6 + Math.random() * 6;
        const left = Math.random() * 100;
        const delay = Math.random() * 0.8;
        const duration = 2.4 + Math.random() * 1.6;
        span.style.width = `${size}px`;
        span.style.height = `${size * 0.6}px`;
        span.style.left = `${left}%`;
        span.style.background = colors[i % colors.length];
        span.style.animationDelay = `${delay}s`;
        span.style.animationDuration = `${duration}s`;
        span.style.transform = `rotate(${Math.random() * 180}deg)`;
        confetti.appendChild(span);
    }
}

if (celebrationDismiss) {
    celebrationDismiss.addEventListener('click', closeCelebrationModal);
}
if (celebrationModal) {
    celebrationModal.addEventListener('click', (e) => {
        if (e.target.id === 'celebrationModal') {
            closeCelebrationModal();
        }
    });
}

function formatWeight(grams) {
    return grams >= 1000 ? (grams / 1000).toFixed(1) + 'kg' : grams + 'g';
}

function formatMoney(cents) {
    return '$' + (cents / 100).toFixed(2);
}

showView('landingView');

function initParticleBackground() {
    const canvas = document.getElementById('bgCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const particles = [];
    const maxDistance = 150;
    const baseGreen = [34, 197, 94];

    const resize = () => {
        const ratio = window.devicePixelRatio || 1;
        canvas.width = Math.floor(window.innerWidth * ratio);
        canvas.height = Math.floor(window.innerHeight * ratio);
        canvas.style.width = `${window.innerWidth}px`;
        canvas.style.height = `${window.innerHeight}px`;
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const createParticles = () => {
        particles.length = 0;
        const count = Math.min(120, Math.floor((window.innerWidth * window.innerHeight) / 12000));
        for (let i = 0; i < count; i++) {
            const radius = 2 + Math.random() * 2;
            particles.push({
                x: Math.random() * window.innerWidth,
                y: Math.random() * window.innerHeight,
                vx: (Math.random() - 0.5) * 0.35,
                vy: (Math.random() - 0.5) * 0.35,
                radius,
                alpha: 0.3 + Math.random() * 0.4,
                tint: Math.random() * 25
            });
        }
    };

    const draw = () => {
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;

            if (p.x < -20) p.x = window.innerWidth + 20;
            if (p.x > window.innerWidth + 20) p.x = -20;
            if (p.y < -20) p.y = window.innerHeight + 20;
            if (p.y > window.innerHeight + 20) p.y = -20;

            const green = baseGreen[1] + p.tint;
            ctx.fillStyle = `rgba(${baseGreen[0]}, ${green}, ${baseGreen[2]}, ${p.alpha})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fill();
        }

        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const p1 = particles[i];
                const p2 = particles[j];
                const dx = p1.x - p2.x;
                const dy = p1.y - p2.y;
                const dist = Math.hypot(dx, dy);
                if (dist < maxDistance) {
                    const alpha = (1 - dist / maxDistance) * 0.25;
                    ctx.strokeStyle = `rgba(34, 197, 94, ${alpha})`;
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(p1.x, p1.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.stroke();
                }
            }
        }

        requestAnimationFrame(draw);
    };

    resize();
    createParticles();
    window.addEventListener('resize', () => {
        resize();
        createParticles();
    });
    draw();
}

initParticleBackground();
