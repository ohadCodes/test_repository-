// ==============================================
// script.js - גרסה מתוקנת (ללא template literals)
// ==============================================

// משתנים גלובליים
let allEntries = [];
let entries = [];
let currentQuery = '';
let currentFilter = 'all';
let searchField = 'definition';
let entriesPage = 0;
let isOwner = false;
let gAccessToken = null;
let gUserEmail = null;
let selectedForDelete = new Set();
let feedbackType = 'bug';
let toastTimer = null;

const STORAGE_KEY = 'tashbetz_entries';
const OWNER_EMAIL = '012ohad@gmail.com';
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw3224vAzaAskrO4Rj6yj51uihV5-O6DTLLaPZJB7bWBdaHPd2yn3ERUqGRfagVcYVE/exec';
const GDRIVE_CLIENT_ID = '361524127527-b5cvvltaj5btoitfe07lcf7053hp7vhl.apps.googleusercontent.com';
const GDRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email';

// ==============================================
// פונקציות עזר בסיסיות
// ==============================================

function normalize(str) {
    if (typeof str !== 'string' || !str) return '';
    return str.replace(/"/g, '').replace(/'/g, '').replace(/\s+/g, ' ').replace(/[.,?!]/g, '').trim();
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function highlightText(text, query) {
    if (!query || !text) return escapeHtml(text);
    const escaped = escapeHtml(text);
    const escapedQ = escapeHtml(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return escaped.replace(new RegExp(escapedQ, 'gi'), function(m) { return '<mark>' + m + '</mark>'; });
}

function showToast(msg, type) {
    type = type || '';
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.className = 'toast ' + type + ' show';
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function() { t.classList.remove('show'); }, 2500);
}

function saveDataLocal(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    updateStats();
}

function updateStats() {
    var badge = document.getElementById('statsText');
    if (badge && entries) {
        badge.textContent = entries.length + ' הגדרות';
    }
}

function hebrewSort(a, b) {
    return (a.definition || '').localeCompare(b.definition || '', 'he');
}

// ==============================================
// טעינת נתונים מ-entries.json
// ==============================================

async function loadEntriesFromJSON() {
    try {
        var response = await fetch('entries.json');
        if (!response.ok) throw new Error('לא ניתן לטעון את קובץ ההגדרות');
        var data = await response.json();
        allEntries = data;
        entries = data.slice(); // העתק
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        console.log('✅ נטענו ' + data.length + ' הגדרות מ-entries.json');
        updateStats();
        var splash = document.getElementById('splash');
        if (splash) {
            splash.classList.add('hide');
            setTimeout(function() { splash.remove(); }, 500);
        }
        renderCardsPaged('');
        return data;
    } catch (error) {
        console.error('❌ שגיאה בטעינת הגדרות:', error);
        var savedData = localStorage.getItem(STORAGE_KEY);
        if (savedData) {
            entries = JSON.parse(savedData);
            console.log('⚠️ נטענו ' + entries.length + ' הגדרות מ-LocalStorage (גיבוי)');
            renderCardsPaged('');
            return entries;
        }
        return [];
    }
}

// ==============================================
// רינדור כרטיסים
// ==============================================

function renderCardsPaged(query) {
    var list = document.getElementById('cardsList');
    var empty = document.getElementById('emptyState');
    var info = document.getElementById('resultsInfo');
    if (!list) return;
    var q = normalize(query || currentQuery || '');
    var filtered = q ? entries.filter(function(e) { return normalize(e.definition || '').includes(q); }) : entries.slice();
    if (currentFilter === 'no-explanation') {
        filtered = filtered.filter(function(e) { return !e.explanation || !e.explanation.trim(); });
    } else if (currentFilter === 'no-solution') {
        filtered = filtered.filter(function(e) { return !e.solution || !e.solution.trim(); });
    }
    filtered = filtered.slice().sort(hebrewSort);
    if (entries.length === 0) {
        list.innerHTML = '';
        if (empty) empty.style.display = 'block';
        if (info) info.style.display = 'none';
        return;
    }
    if (empty) empty.style.display = 'none';
    var start = entriesPage * 50;
    var pageFiltered = filtered.slice(start, start + 50);
    if (info) {
        info.style.display = 'block';
        info.innerHTML = 'מוצגים <span class="highlight">' + pageFiltered.length + '</span> הגדרות מתוך: <span class="highlight">' + filtered.length + '</span>';
    }
    if (pageFiltered.length === 0) {
        list.innerHTML = '<div class="empty-state"><div class="icon">🔍</div><h3>לא נמצאו תוצאות</h3><p>נסה מילה אחרת או שנה סינון</p></div>';
        return;
    }
    var html = '';
    for (var i = 0; i < pageFiltered.length; i++) {
        var e = pageFiltered[i];
        html += '<div class="card" style="animation-delay:' + Math.min(i * 0.03, 0.3) + 's">';
        html += '<div class="card-header">';
        html += '<div class="card-definition">' + (searchField === 'definition' ? highlightText(e.definition || '', query) : escapeHtml(e.definition)) + '</div>';
        html += '<div class="card-meta">';
        if (e.letters) html += '<span class="tag tag-letters">' + escapeHtml(e.letters) + '</span>';
        if (e.type) html += '<span class="tag tag-type">' + escapeHtml(e.type) + '</span>';
        html += '</div></div>';
        html += '<div class="card-solution">◈ ' + (e.solution ? (searchField === 'solution' ? highlightText(e.solution, query) : escapeHtml(e.solution)) : '<span style="color:var(--danger);">ללא תשובה</span>') + '</div>';
        if (e.explanation) {
            html += '<div class="card-divider"></div>';
            html += '<div class="card-explanation">' + (searchField === 'explanation' ? highlightText(e.explanation, query) : escapeHtml(e.explanation)) + '</div>';
        }
        if (isOwner) {
            html += '<div class="card-actions"><button class="btn-icon" onclick="openEdit(\'' + e.id + '\')">✏️ עריכה</button></div>';
        }
        html += '</div>';
    }
    list.innerHTML = html;
    if (start + 50 < filtered.length) {
        list.innerHTML += '<div style="text-align:center;margin:20px 0;"><button class="btn" onclick="loadMoreEntries()">טען עוד (' + (filtered.length - (start + 50)) + ' נוספים)</button></div>';
    }
}

function loadMoreEntries() {
    entriesPage++;
    renderCardsPaged(currentQuery);
}

function onSearchFieldChange() {
    searchField = document.getElementById('searchField').value;
    var placeholders = { definition: 'חפש הגדרה...', solution: 'חפש פתרון...', explanation: 'חפש רמז...' };
    var input = document.getElementById('searchInput');
    if (input) input.placeholder = placeholders[searchField];
    currentQuery = input ? input.value.trim() : '';
    entriesPage = 0;
    renderCardsPaged(currentQuery);
}

function clearSearch() {
    var input = document.getElementById('searchInput');
    if (input) {
        input.value = '';
        currentQuery = '';
    }
    var clearBtn = document.getElementById('clearSearch');
    if (clearBtn) clearBtn.style.display = 'none';
    entriesPage = 0;
    renderCardsPaged('');
    if (input) input.focus();
}

function setFilter(filter) {
    currentFilter = filter;
    var btns = document.querySelectorAll('.filter-btn[id^="filter"]');
    for (var i = 0; i < btns.length; i++) btns[i].classList.remove('active');
    var activeBtn = document.getElementById('filter-' + filter);
    if (activeBtn) activeBtn.classList.add('active');
    entriesPage = 0;
    renderCardsPaged(currentQuery);
}

function switchTab(tabId) {
    var btns = document.querySelectorAll('.tab-btn');
    for (var i = 0; i < btns.length; i++) btns[i].classList.remove('active');
    var views = document.querySelectorAll('.view');
    for (var i = 0; i < views.length; i++) views[i].classList.remove('active');
    var selectedBtn = document.querySelector('.tab-btn[onclick*="' + tabId + '"]');
    if (selectedBtn) selectedBtn.classList.add('active');
    var selectedView = document.getElementById('view-' + tabId);
    if (selectedView) selectedView.classList.add('active');
    var searchWrap = document.getElementById('searchWrap');
    if (searchWrap) searchWrap.style.display = tabId === 'search' ? 'flex' : 'none';
    if (tabId === 'search') {
        entriesPage = 0;
        renderCardsPaged(currentQuery);
    }
    if (tabId === 'delete') renderDeleteList();
    if (tabId === 'feedback' && isOwner) renderFeedbackList();
    if (tabId === 'approvals' && isOwner) renderApprovalsList();
    if (tabId === 'similar' && isOwner) loadSimilar();
}

function addEntry() {
    var definition = document.getElementById('f-definition')?.value.trim();
    var solution = document.getElementById('f-solution')?.value.trim();
    var letters = document.getElementById('f-letters')?.value.trim();
    var type = document.getElementById('f-type')?.value.trim();
    var explanation = document.getElementById('f-explanation')?.value.trim();
    if (!definition) {
        showToast('נדרשת הגדרה', 'error');
        return;
    }
    if (!letters) {
        var m = definition.match(/\((\d[\d,]*)\)/);
        if (m) letters = m[1];
    }
    var entry = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2),
        definition: definition, solution: solution, letters: letters, type: type, explanation: explanation,
        createdAt: Date.now()
    };
    var fields = ['f-definition', 'f-solution', 'f-letters', 'f-type', 'f-explanation'];
    for (var i = 0; i < fields.length; i++) {
        var el = document.getElementById(fields[i]);
        if (el) el.value = '';
    }
    entries.unshift(entry);
    saveDataLocal(entries);
    showToast('✅ ההגדרה נוספה!', 'success');
    switchTab('search');
}

function openEdit(id) {
    var e = entries.find(function(x) { return x.id === id; });
    if (!e) return;
    document.getElementById('edit-id').value = id;
    document.getElementById('edit-definition').value = e.definition || '';
    document.getElementById('edit-letters').value = e.letters || '';
    document.getElementById('edit-type').value = e.type || '';
    document.getElementById('edit-solution').value = e.solution || '';
    document.getElementById('edit-explanation').value = e.explanation || '';
    var modal = document.getElementById('editModal');
    if (modal) modal.classList.add('open');
}

function saveEdit() {
    var id = document.getElementById('edit-id')?.value;
    var idx = entries.findIndex(function(x) { return x.id === id; });
    if (idx === -1) return;
    var definition = document.getElementById('edit-definition')?.value.trim();
    if (!definition) {
        showToast('נדרשת הגדרה', 'error');
        return;
    }
    entries[idx] = {
        ...entries[idx],
        definition: definition,
        letters: document.getElementById('edit-letters')?.value.trim() || '',
        type: document.getElementById('edit-type')?.value.trim() || '',
        solution: document.getElementById('edit-solution')?.value.trim() || '',
        explanation: document.getElementById('edit-explanation')?.value.trim() || ''
    };
    saveDataLocal(entries);
    closeModal();
    renderCardsPaged(currentQuery);
    showToast('✅ ההגדרה עודכנה', 'success');
}

function closeModal() {
    var modals = document.querySelectorAll('.modal-overlay');
    for (var i = 0; i < modals.length; i++) modals[i].classList.remove('open');
}

function renderDeleteList() {
    var query = document.getElementById('deleteSearchInput')?.value.trim().toLowerCase() || '';
    var list = document.getElementById('deleteList');
    var footer = document.getElementById('deleteFooter');
    if (!list) return;
    var filtered = query ? entries.filter(function(e) { return normalize(e.definition).includes(query); }) : entries.slice();
    if (filtered.length === 0) {
        list.innerHTML = '<div class="empty-state"><div class="icon">🔍</div><h3>לא נמצאו הגדרות</h3></div>';
        if (footer) footer.style.display = 'none';
        return;
    }
    var html = '';
    for (var i = 0; i < filtered.length; i++) {
        var e = filtered[i];
        var selectedClass = selectedForDelete.has(e.id) ? 'selected' : '';
        html += '<div class="delete-item ' + selectedClass + '" onclick="toggleDeleteSelect(\'' + e.id + '\', this)">';
        html += '<input type="checkbox"' + (selectedForDelete.has(e.id) ? ' checked' : '') + ' onclick="event.stopPropagation();toggleDeleteSelect(\'' + e.id + '\', this.closest(\'.delete-item\'))" />';
        html += '<div class="delete-item-text">';
        html += '<div class="delete-item-def">' + escapeHtml(e.definition) + '</div>';
        if (e.solution) html += '<div class="delete-item-sol">◈ ' + escapeHtml(e.solution) + '</div>';
        html += '</div></div>';
    }
    list.innerHTML = html;
    updateDeleteFooter();
}

function toggleDeleteSelect(id, el) {
    if (selectedForDelete.has(id)) {
        selectedForDelete.delete(id);
        if (el) el.classList.remove('selected');
    } else {
        selectedForDelete.add(id);
        if (el) el.classList.add('selected');
    }
    var checkbox = el ? el.querySelector('input') : null;
    if (checkbox) checkbox.checked = selectedForDelete.has(id);
    updateDeleteFooter();
}

function updateDeleteFooter() {
    var footer = document.getElementById('deleteFooter');
    var count = document.getElementById('deleteCount');
    if (footer && count) {
        footer.style.display = selectedForDelete.size > 0 ? 'block' : 'none';
        count.textContent = selectedForDelete.size;
    }
}

function selectAllDelete() {
    var query = document.getElementById('deleteSearchInput')?.value.trim().toLowerCase() || '';
    var filtered = query ? entries.filter(function(e) { return normalize(e.definition).includes(query); }) : entries.slice();
    for (var i = 0; i < filtered.length; i++) selectedForDelete.add(filtered[i].id);
    renderDeleteList();
}

function deselectAllDelete() {
    selectedForDelete.clear();
    renderDeleteList();
}

function confirmDeleteSelected() {
    if (selectedForDelete.size === 0) return;
    var count = selectedForDelete.size;
    entries = entries.filter(function(e) { return !selectedForDelete.has(e.id); });
    selectedForDelete.clear();
    saveDataLocal(entries);
    renderDeleteList();
    renderCardsPaged(currentQuery);
    showToast('🗑️ נמחקו ' + count + ' הגדרות', 'success');
}

function openDelete(id) {
    var e = entries.find(function(x) { return x.id === id; });
    if (!e) return;
    document.getElementById('delete-id').value = id;
    document.getElementById('delete-preview').textContent = e.definition + ' → ' + e.solution;
    var modal = document.getElementById('deleteModal');
    if (modal) modal.classList.add('open');
}

function confirmDelete() {
    var id = document.getElementById('delete-id')?.value;
    if (id) {
        entries = entries.filter(function(x) { return x.id !== id; });
        saveDataLocal(entries);
        closeModal();
        renderCardsPaged(currentQuery);
        showToast('🗑️ ההגדרה נמחקה', 'success');
    }
}

function exportEntries() {
    if (entries.length === 0) {
        showToast('אין הגדרות לייצוא', 'error');
        return;
    }
    var lines = [];
    for (var i = 0; i < entries.length; i++) {
        var e = entries[i];
        var def = 'ההגדרה: ' + e.definition;
        if (e.letters) def += ' (' + e.letters + ')';
        if (e.type) def += ' [' + e.type + ']';
        var parts = [def, 'הפתרון: ' + (e.solution || '')];
        if (e.explanation) parts.push('הסבר: ' + e.explanation);
        lines.push(parts.join(' | '));
    }
    var blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'definitions_' + new Date().toLocaleDateString('he-IL').replace(/\//g, '-') + '.txt';
    a.click();
    URL.revokeObjectURL(url);
    showToast('✅ יוצאו ' + entries.length + ' הגדרות', 'success');
}

function handleFileImport(event) {
    var file = event.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(e) { processImportText(e.target.result); };
    reader.readAsText(file, 'UTF-8');
}

function importFromPaste() {
    var text = document.getElementById('pasteArea')?.value;
    if (!text || !text.trim()) {
        showToast('אין טקסט לייבוא', 'error');
        return;
    }
    processImportText(text);
    var pasteArea = document.getElementById('pasteArea');
    if (pasteArea) pasteArea.value = '';
}

function parseEntryLine(line) {
    line = line.trim();
    if (!line) return null;
    var definition = '', solution = '', explanation = '', letters = '', type = '';
    var parts = line.split('|').map(function(p) { return p.trim(); });
    for (var i = 0; i < parts.length; i++) {
        var part = parts[i];
        if (part.startsWith('ההגדרה:') || part.startsWith('הגדרה:')) {
            var def = part.replace(/^(ה)?הגדרה:\s*/, '');
            var lettersMatch = def.match(/\((\d[\d,\s-]*)\)/);
            if (lettersMatch) letters = lettersMatch[1];
            var typeMatch = def.match(/\[([^\]]+)\]/);
            if (typeMatch) type = typeMatch[1];
            definition = def.replace(/\s*\(\d[\d,\s-]*\)\s*/g, '').replace(/\s*\[[^\]]+\]\s*/g, '').trim();
        } else if (part.startsWith('הפתרון:') || part.startsWith('פתרון:')) {
            solution = part.replace(/^(ה)?פתרון:\s*/, '').trim();
        } else if (part.startsWith('הסבר:') || part.startsWith('סבר:')) {
            explanation = part.replace(/^(ה)?סבר:\s*/, '').trim();
        }
    }
    if (!definition) return null;
    return {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2),
        definition: definition, solution: solution, letters: letters, type: type, explanation: explanation,
        createdAt: Date.now()
    };
}

function processImportText(text) {
    var lines = text.split('\n');
    var added = 0, updated = 0, skipped = 0, failed = 0;
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        if (!line.trim()) continue;
        var entry = parseEntryLine(line);
        if (!entry) {
            failed++;
            continue;
        }
        var normNew = normalize(entry.definition);
        var existingIdx = -1;
        for (var j = 0; j < entries.length; j++) {
            if (normalize(entries[j].definition) === normNew) {
                existingIdx = j;
                break;
            }
        }
        if (existingIdx !== -1) {
            var existing = entries[existingIdx];
            var changed = false;
            var updatedEntry = JSON.parse(JSON.stringify(existing));
            if (entry.solution && !existing.solution) {
                updatedEntry.solution = entry.solution;
                changed = true;
            }
            if (entry.explanation && !existing.explanation) {
                updatedEntry.explanation = entry.explanation;
                changed = true;
            }
            if (entry.letters && !existing.letters) {
                updatedEntry.letters = entry.letters;
                changed = true;
            }
            if (entry.type && !existing.type) {
                updatedEntry.type = entry.type;
                changed = true;
            }
            if (changed) {
                entries[existingIdx] = updatedEntry;
                updated++;
            } else {
                skipped++;
            }
        } else {
            entries.unshift(entry);
            added++;
        }
    }
    saveDataLocal(entries);
    var parts = [];
    if (added > 0) parts.push('נוספו ' + added + ' חדשות');
    if (updated > 0) parts.push('עודכנו ' + updated + ' פתרונות/הסברים');
    if (skipped > 0) parts.push(skipped + ' כפילויות דולגו');
    if (failed > 0) parts.push(failed + ' שורות לא זוהו');
    if (added > 0 || updated > 0) {
        showToast('✅ ' + parts.join(' · '), 'success');
        switchTab('search');
    } else if (skipped > 0) {
        showToast('⚠️ ' + parts.join(' · '), '');
    } else {
        showToast('לא זוהו הגדרות — בדוק את הפורמט', 'error');
    }
}

function exportUpdatedHTML() {
    var blob = new Blob([document.documentElement.outerHTML], { type: 'text/html;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'updated_riddles.html';
    a.click();
    URL.revokeObjectURL(blob);
    setTimeout(function() {
        var jsonBlob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json;charset=utf-8' });
        var jsonA = document.createElement('a');
        jsonA.href = URL.createObjectURL(jsonBlob);
        jsonA.download = 'entries.json';
        jsonA.click();
        URL.revokeObjectURL(jsonBlob);
        showToast('✅ הורדו HTML ו-entries.json', 'success');
    }, 500);
}

function checkDuplicates() {
    var seen = {};
    var groups = [];
    for (var i = 0; i < entries.length; i++) {
        var key = normalize(entries[i].definition);
        if (!seen[key]) seen[key] = [];
        seen[key].push(entries[i]);
    }
    for (var key in seen) {
        if (seen[key].length > 1) groups.push(seen[key]);
    }
    var container = document.getElementById('dupesResult');
    if (!container) return;
    if (groups.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="icon">✅</div><h3>אין כפילויות!</h3><p>כל ' + entries.length + ' ההגדרות ייחודיות</p></div>';
        return;
    }
    var html = '<div class="results-info">נמצאו <span class="highlight">' + groups.length + '</span> קבוצות כפילויות' +
        '<button class="btn-icon danger" onclick="deleteAllDupes()">🗑️ מחק כפילויות אוטומטית</button></div>';
    for (var g = 0; g < groups.length; g++) {
        var group = groups[g];
        html += '<div class="card" style="border-color:var(--danger);margin-bottom:14px;">' +
            '<div style="font-size:0.75rem;color:var(--danger);font-weight:700;margin-bottom:10px;">⚠️ ' + group.length + ' כניסות זהות</div>';
        for (var idx = 0; idx < group.length; idx++) {
            var e = group[idx];
            html += '<div style="background:var(--surface2);border-radius:10px;padding:12px;margin-bottom:8px;">' +
                '<div style="font-size:0.85rem;font-weight:600;margin-bottom:4px;">' + escapeHtml(e.definition) + '</div>' +
                '<div style="font-size:0.9rem;color:var(--success);">◈ ' + escapeHtml(e.solution) + '</div>' +
                '<div style="margin-top:8px;">';
            if (idx > 0) {
                html += '<button class="btn-icon danger" onclick="deleteDupe(\'' + e.id + '\')">🗑️ מחק עותק זה</button>';
            } else {
                html += '<span style="font-size:0.75rem;color:var(--text-muted);">← ישמר</span>';
            }
            html += '</div></div>';
        }
        html += '</div>';
    }
    container.innerHTML = html;
}

function deleteDupe(id) {
    entries = entries.filter(function(e) { return e.id !== id; });
    saveDataLocal(entries);
    showToast('🗑️ הכפילות נמחקה', 'success');
    checkDuplicates();
    renderCardsPaged(currentQuery);
}

function deleteAllDupes() {
    var seen = {};
    var toKeep = [];
    for (var i = 0; i < entries.length; i++) {
        var key = normalize(entries[i].definition);
        if (!seen[key]) {
            seen[key] = true;
            toKeep.push(entries[i]);
        }
    }
    var removed = entries.length - toKeep.length;
    entries = toKeep;
    saveDataLocal(entries);
    showToast('✅ נמחקו ' + removed + ' כפילויות', 'success');
    checkDuplicates();
    renderCardsPaged(currentQuery);
}

function openSuggestionModal() {
    var ids = ['sug-definition', 'sug-letters', 'sug-solution', 'sug-explanation'];
    for (var i = 0; i < ids.length; i++) {
        var el = document.getElementById(ids[i]);
        if (el) el.value = '';
    }
    var modal = document.getElementById('suggestionModal');
    if (modal) modal.classList.add('open');
    setTimeout(function() { var def = document.getElementById('sug-definition'); if (def) def.focus(); }, 350);
}

function closeSuggestionModal() {
    var modal = document.getElementById('suggestionModal');
    if (modal) modal.classList.remove('open');
}

async function submitSuggestion() {
    var definition = document.getElementById('sug-definition')?.value.trim();
    var solution = document.getElementById('sug-solution')?.value.trim();
    var letters = document.getElementById('sug-letters')?.value.trim();
    var explanation = document.getElementById('sug-explanation')?.value.trim();
    if (!definition) {
        showToast('נא למלא את ההגדרה', 'error');
        return;
    }
    closeSuggestionModal();
    showToast('⏳ שולח הצעה...', '');
    try {
        var url = APPS_SCRIPT_URL + '?action=submitSuggestion&def=' + encodeURIComponent(definition) + '&sol=' + encodeURIComponent(solution || '') + '&letters=' + encodeURIComponent(letters || '') + '&exp=' + encodeURIComponent(explanation || '');
        var res = await fetch(url);
        var data = await res.json();
        if (data.ok) showToast('✅ ההצעה נשלחה, תודה!', 'success');
        else showToast('שגיאה בשליחה', 'error');
    } catch(e) {
        showToast('שגיאה בשליחה', 'error');
    }
}

function openFeedbackModal() {
    var textarea = document.getElementById('feedback-text');
    if (textarea) textarea.value = '';
    selectFeedbackType('bug');
    var modal = document.getElementById('feedbackModal');
    if (modal) modal.classList.add('open');
    setTimeout(function() { var fb = document.getElementById('feedback-text'); if (fb) fb.focus(); }, 350);
}

function closeFeedbackModal() {
    var modal = document.getElementById('feedbackModal');
    if (modal) modal.classList.remove('open');
}

function selectFeedbackType(type) {
    feedbackType = type;
    var bugBtn = document.getElementById('ftype-bug');
    var improveBtn = document.getElementById('ftype-improve');
    if (bugBtn) bugBtn.classList.toggle('selected', type === 'bug');
    if (improveBtn) improveBtn.classList.toggle('selected', type === 'improve');
}

async function submitFeedback() {
    var text = document.getElementById('feedback-text')?.value.trim();
    if (!text) {
        showToast('נא לכתוב תיאור', 'error');
        return;
    }
    closeFeedbackModal();
    showToast('שולח פידבק...', '');
    try {
        var url = APPS_SCRIPT_URL + '?action=submitFeedback&type=' + feedbackType + '&text=' + encodeURIComponent(text);
        var res = await fetch(url);
        var data = await res.json();
        if (data.ok) showToast('✅ הפידבק התקבל, תודה!', 'success');
        else showToast('שגיאה בשליחת הפידבק', 'error');
    } catch(e) {
        showToast('שגיאה בשליחת הפידבק', 'error');
    }
}

// ==============================================
// ניהול מנהל - התחברות גוגל
// ==============================================

function updateOwnerUI() {
    var ownerOnly = document.querySelectorAll('.owner-only');
    for (var i = 0; i < ownerOnly.length; i++) {
        ownerOnly[i].style.display = isOwner ? 'inline-block' : 'none';
    }
    var suggestBtn = document.getElementById('suggest-btn');
    var feedbackBtn = document.getElementById('feedback-btn');
    if (suggestBtn) suggestBtn.style.display = isOwner ? 'none' : 'inline-block';
    if (feedbackBtn) feedbackBtn.style.display = isOwner ? 'none' : 'inline-block';
    var ownerOnly = document.querySelectorAll('.owner-only');
    for (var i = 0; i < ownerOnly.length; i++) {
        ownerOnly[i].style.display = isOwner ? 'inline-block' : 'none';
    }
}

function updateSyncBtn(state) {
    var btn = document.getElementById('syncBtn');
    var icon = document.getElementById('syncIcon');
    if (!btn || !icon) return;
    btn.classList.remove('syncing', 'connected');
    if (state === 'connected') {
        icon.textContent = '👑';
        btn.classList.add('connected');
        btn.title = 'מחובר כמנהל — לחץ לסנכרון';
    } else if (state === 'syncing') {
        icon.textContent = '🔄';
        btn.classList.add('syncing');
        btn.title = 'מסנכרן...';
    } else if (state === 'error') {
        icon.textContent = '⚠️';
        btn.title = 'שגיאת סנכרון';
    } else {
        icon.textContent = '☁️';
        btn.title = 'התחבר כמנהל';
    }
}

function signInGoogle() {
    var client = google.accounts.oauth2.initTokenClient({
        client_id: GDRIVE_CLIENT_ID,
        scope: GDRIVE_SCOPE,
        callback: async function(resp) {
            if (resp.error) {
                showToast('שגיאה בהתחברות', 'error');
                return;
            }
            gAccessToken = resp.access_token;
            localStorage.setItem('g_access_token', gAccessToken);
            try {
                var info = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                    headers: { 'Authorization': 'Bearer ' + gAccessToken }
                });
                var u = await info.json();
                gUserEmail = u.email;
                localStorage.setItem('g_user_email', gUserEmail);
                isOwner = gUserEmail === OWNER_EMAIL;
                if (!isOwner) {
                    showToast('רק המנהל יכול להתחבר', 'error');
                    gAccessToken = null;
                    localStorage.removeItem('g_access_token');
                    return;
                }
                updateSyncBtn('connected');
                showToast('✅ מחובר כמנהל', 'success');
                updateOwnerUI();
                await syncWithDrive();
            } catch(e) {
                console.error('Error getting user info:', e);
            }
        }
    });
    client.requestAccessToken();
}

function logout() {
    gAccessToken = null;
    gUserEmail = null;
    isOwner = false;
    localStorage.removeItem('g_access_token');
    localStorage.removeItem('g_user_email');
    updateSyncBtn('disconnected');
    updateOwnerUI();
    if (window.google && google.accounts && google.accounts.id) {
        try { google.accounts.id.disableAutoSelect(); } catch(e) {}
    }
    showToast('התנתקת, טוען מחדש נתוני אורח...', '');
    fetch('entries.json')
        .then(function(response) { return response.json(); })
        .then(function(data) {
            entries = data;
            saveDataLocal(entries);
            renderCardsPaged(currentQuery);
            showToast('✅ התנתקת בהצלחה, חזרת למצב אורח', 'success');
        })
        .catch(function(err) {
            console.error('שגיאה בטעינה מחדש:', err);
            location.reload();
        });
}

function handleSyncClick() {
    if (!gAccessToken) signInGoogle();
    else syncWithDrive();
}

async function syncWithDrive() {
    if (!isOwner) return;
    updateSyncBtn('syncing');
    try {
        var url = APPS_SCRIPT_URL + '?action=getEntries&_t=' + Date.now();
        var res = await fetch(url);
        var data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
            entries = data;
            saveDataLocal(entries);
            renderCardsPaged(currentQuery);
            showToast('✅ הנתונים סונכרנו מהענן', 'success');
        }
        updateSyncBtn('connected');
    } catch (e) {
        console.error('Sync error:', e);
        updateSyncBtn('error');
        showToast('שגיאה בסנכרון', 'error');
    }
}

async function pushToCloud() {
    if (!isOwner) return;
    updateSyncBtn('syncing');
    try {
        const payload = JSON.stringify(entries);
        const res = await fetch(APPS_SCRIPT_URL + '?action=updateEntries', {
            method: 'POST',
            body: payload,
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        if (data.ok) {
            showToast('✅ הנתונים הועלו לענן', 'success');
            updateSyncBtn('connected');
        } else {
            throw new Error('upload failed');
        }
    } catch(e) {
        updateSyncBtn('error');
        showToast('שגיאה בהעלאה: ' + e.message, 'error');
    }
}

// ==============================================
// ניהול הצעות (admin)
// ==============================================

async function renderApprovalsList() {
    var list = document.getElementById('approvalsList');
    if (!list) return;
    list.innerHTML = '<div style="color:var(--text-muted);padding:20px;text-align:center;">⏳ טוען...</div>';
    try {
        var res = await fetch(APPS_SCRIPT_URL + '?action=getSuggestions&_t=' + Date.now());
        var data = await res.json();
        if (!Array.isArray(data) || data.length === 0) {
            list.innerHTML = '<div class="empty-state"><div class="icon">📭</div><h3>אין הצעות ממתינות</h3></div>';
            var tabApprovals = document.getElementById('tab-approvals');
            if (tabApprovals) tabApprovals.textContent = '📬 הצעות';
            return;
        }
        window.currentSuggestions = data;
        var tabApprovals2 = document.getElementById('tab-approvals');
        if (tabApprovals2) tabApprovals2.innerHTML = '📬 הצעות <span class="count-badge">' + data.length + '</span>';
        var html = '';
        for (var i = 0; i < data.length; i++) {
            var s = data[i];
            html += '<div class="approval-card">';
            html += '<div class="approval-card-def">📝 ' + escapeHtml(s.definition) + (s.letters ? ' (' + escapeHtml(s.letters) + ')' : '') + '</div>';
            if (s.solution) html += '<div class="approval-card-sol">◈ ' + escapeHtml(s.solution) + '</div>';
            if (s.explanation) html += '<div class="approval-card-exp">💡 ' + escapeHtml(s.explanation) + '</div>';
            html += '<div class="approval-actions">';
            html += '<button class="btn-approve" onclick="approveSuggestion(\'' + s.id + '\')">✅ אשר והוסף</button>';
            html += '<button class="btn-reject" onclick="rejectSuggestion(\'' + s.id + '\')">❌ דחה</button>';
            html += '</div></div>';
        }
        list.innerHTML = html;
    } catch(e) {
        list.innerHTML = '<div style="color:var(--danger);padding:20px;text-align:center;">שגיאה בטעינה</div>';
    }
}

async function approveSuggestion(id) {
    try {
        await fetch(APPS_SCRIPT_URL + '?action=deleteSuggestion&id=' + id);
        var suggestions = window.currentSuggestions || [];
        var suggestion = null;
        for (var i = 0; i < suggestions.length; i++) {
            if (suggestions[i].id === id) {
                suggestion = suggestions[i];
                break;
            }
        }
        if (suggestion) {
            var entry = {
                id: Date.now().toString(36) + Math.random().toString(36).slice(2),
                definition: suggestion.definition,
                solution: suggestion.solution || '',
                letters: suggestion.letters || '',
                type: suggestion.type || '',
                explanation: suggestion.explanation || '',
                createdAt: Date.now()
            };
            entries.unshift(entry);
            saveDataLocal(entries);
            renderCardsPaged(currentQuery);
        }
        await renderApprovalsList();
        showToast('✅ ההצעה אושרה ונוספה', 'success');
    } catch(e) {
        showToast('שגיאה באישור ההצעה', 'error');
    }
}

async function rejectSuggestion(id) {
    try {
        await fetch(APPS_SCRIPT_URL + '?action=deleteSuggestion&id=' + id);
        await renderApprovalsList();
        showToast('❌ ההצעה נדחתה', 'success');
    } catch(e) {
        showToast('שגיאה בדחיית ההצעה', 'error');
    }
}

// ==============================================
// פידבקים למנהל
// ==============================================

async function renderFeedbackList() {
    var bugsEl = document.getElementById('feedbackListBugs');
    var improvEl = document.getElementById('feedbackListImprovements');
    if (!bugsEl || !improvEl) return;
    try {
        var data = await fetch(APPS_SCRIPT_URL + '?action=getFeedback&_t=' + Date.now()).then(function(r) { return r.json(); });
        var bugs = [];
        var improvements = [];
        for (var i = 0; i < data.length; i++) {
            var item = data[i];
            var enriched = { text: item.text, type: item.type, _idx: i };
            if (item.type === 'improvement') improvements.push(enriched);
            else bugs.push(enriched);
        }
        function renderCard(item) {
            var btnHtml = '';
            if (item.type === 'improvement') {
                btnHtml = '<button class="btn btn-secondary" style="padding:4px 8px; font-size:0.75rem;" onclick="approveFeedbackItem(' + item._idx + ')">אישור</button>';
            }
            var deleteBtn = '<button class="btn" style="padding:4px 8px; font-size:0.75rem; background:rgba(244,63,94,0.1); color:var(--danger);" onclick="deleteFeedbackItem(' + item._idx + ')">מחיקה</button>';
            return '<div class="card" style="margin-bottom:8px; padding:12px;">' +
                '<div style="font-size:0.85rem;margin-bottom:8px;">' + escapeHtml(item.text) + '</div>' +
                '<div style="display:flex; gap:8px; justify-content: flex-end;">' + btnHtml + deleteBtn + '</div></div>';
        }
        bugsEl.innerHTML = bugs.length ? bugs.map(renderCard).join('') : '<div style="color:var(--text-dim);text-align:center;padding:16px;">אין פריטים</div>';
        improvEl.innerHTML = improvements.length ? improvements.map(renderCard).join('') : '<div style="color:var(--text-dim);text-align:center;padding:16px;">אין פריטים</div>';
    } catch(e) {
        bugsEl.innerHTML = '<div style="color:var(--danger);text-align:center;padding:16px;">שגיאה בטעינה</div>';
        improvEl.innerHTML = '<div style="color:var(--danger);text-align:center;padding:16px;">שגיאה בטעינה</div>';
    }
}

async function approveFeedbackItem(index) {
    try {
        var res = await fetch(APPS_SCRIPT_URL + '?action=getFeedbackItem&index=' + index);
        var item = await res.json();
        if (item && item.text) {
            var entry = parseEntryLine(item.text);
            if (entry) {
                entries.unshift(entry);
                saveDataLocal(entries);
                renderCardsPaged(currentQuery);
                showToast('✅ הפידבק אושר ונוסף למאגר', 'success');
            } else {
                showToast('לא ניתן היה לפרק את הפידבק להגדרה תקינה', 'error');
                return;
            }
        }
        await fetch(APPS_SCRIPT_URL + '?action=deleteFeedback&index=' + index);
        renderFeedbackList();
    } catch(e) {
        showToast('שגיאה באישור הפידבק', 'error');
    }
}

async function deleteFeedbackItem(index) {
    if (!confirm('למחוק את הפריט?')) return;
    try {
        await fetch(APPS_SCRIPT_URL + '?action=deleteFeedback&index=' + index);
        showToast('נמחק בהצלחה', 'success');
        renderFeedbackList();
    } catch(e) {
        showToast('שגיאה במחיקה', 'error');
    }
}

// ==============================================
// הגדרות דומות (admin)
// ==============================================

async function loadSimilar() {
    var container = document.getElementById('similarList');
    if (!container) return;
    container.innerHTML = '<div style="color:var(--text-muted);padding:20px;text-align:center;">⏳ טוען קבוצות...</div>';
    try {
        var groups = await fetch(APPS_SCRIPT_URL + '?action=getSimilar&_t=' + Date.now()).then(function(r) { return r.json(); });
        if (!Array.isArray(groups) || groups.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="icon">✅</div><h3>לא נמצאו קבוצות דומות</h3></div>';
            return;
        }
        container.innerHTML = '';
        for (var i = 0; i < groups.length; i++) {
            var group = groups[i];
            var div = document.createElement('div');
            div.className = 'card';
            var html = '<h4 style="margin-bottom:10px;">קבוצה ' + (i+1) + ' - ' + group.length + ' הגדרות</h4><ol style="padding-right:18px;">';
            for (var j = 0; j < group.length; j++) {
                html += '<li style="margin-bottom:6px;">' + escapeHtml(group[j].definition) + ' ' + escapeHtml(group[j].letters || '') + '</li>';
            }
            html += '</ol>';
            var ids = group.map(function(g) { return g.id; });
            var idsEncoded = encodeURIComponent(JSON.stringify(ids));
            html += '<button class="btn btn-primary" onclick="mergeGroup(\'' + idsEncoded + '\')">מזג קבוצה</button>';
            div.innerHTML = html;
            container.appendChild(div);
        }
    } catch(e) {
        container.innerHTML = '<div style="color:var(--danger);padding:20px;text-align:center;">שגיאה בטעינת קבוצות דומות</div>';
    }
}

async function mergeGroup(idsEncoded) {
    try {
        var ids = JSON.parse(decodeURIComponent(idsEncoded));
        var data = await fetch(APPS_SCRIPT_URL + '?action=merge&ids=' + encodeURIComponent(JSON.stringify(ids))).then(function(r) { return r.json(); });
        if (data && data.ok) {
            showToast('הקבוצה מוזגה בהצלחה!', 'success');
            loadSimilar();
        } else {
            showToast('שגיאה במיזוג', 'error');
        }
    } catch(e) {
        showToast('שגיאה במיזוג', 'error');
    }
}

// ==============================================
// אתחול הדף
// ==============================================

document.addEventListener('DOMContentLoaded', function() {
    loadEntriesFromJSON();
    var savedToken = localStorage.getItem('g_access_token');
    var savedEmail = localStorage.getItem('g_user_email');
    if (savedToken && savedEmail === OWNER_EMAIL) {
        gAccessToken = savedToken;
        gUserEmail = savedEmail;
        isOwner = true;
        updateOwnerUI();
        updateSyncBtn('connected');
        setTimeout(function() { syncWithDrive(); }, 1500);
        setInterval(function() { syncWithDrive(); }, 5 * 60 * 1000);
    } else {
        isOwner = false;
        updateOwnerUI();
        updateSyncBtn('disconnected');
    }
    var searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            currentQuery = this.value.trim();
            var clearBtn = document.getElementById('clearSearch');
            if (clearBtn) clearBtn.style.display = currentQuery ? 'block' : 'none';
            entriesPage = 0;
            renderCardsPaged(currentQuery);
        });
    }
    var overlays = document.querySelectorAll('.modal-overlay');
    for (var i = 0; i < overlays.length; i++) {
        overlays[i].addEventListener('click', function(e) {
            if (e.target === this) closeModal();
        });
    }
    var importZone = document.getElementById('importZone');
    if (importZone) {
        importZone.addEventListener('dragover', function(e) { e.preventDefault(); importZone.classList.add('drag-over'); });
        importZone.addEventListener('dragleave', function() { importZone.classList.remove('drag-over'); });
        importZone.addEventListener('drop', function(e) {
            e.preventDefault();
            importZone.classList.remove('drag-over');
            var file = e.dataTransfer.files[0];
            if (file) {
                var reader = new FileReader();
                reader.onload = function(ev) { processImportText(ev.target.result); };
                reader.readAsText(file, 'UTF-8');
            }
        });
    }
    switchTab('search');
});
