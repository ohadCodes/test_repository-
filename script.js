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
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby55S-WhnCmk6sF95VwWa4h77moNa1TRhraw2gattzxZ8sqoLTa3ewXduHsqBvKQROB/exec';
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
    return escaped.replace(new RegExp(escapedQ, 'gi'), m => `<mark>${m}</mark>`);
}

function showToast(msg, type = '') {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.className = `toast ${type} show`;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2500);
}

function saveDataLocal(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    updateStats();
}

function updateStats() {
    const badge = document.getElementById('statsText');
    if (badge && entries) {
        badge.textContent = `${entries.length} הגדרות`;
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
        const response = await fetch('entries.json');
        if (!response.ok) throw new Error('לא ניתן לטעון את קובץ ההגדרות');
        const data = await response.json();
        
        allEntries = data;
        entries = [...data];
        
        // שמירה ב-LocalStorage
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        
        console.log(`✅ נטענו ${data.length} הגדרות מ-entries.json`);
        updateStats();
        
        // הסתרת מסך הספלאש
        const splash = document.getElementById('splash');
        if (splash) {
            splash.classList.add('hide');
            setTimeout(() => splash.remove(), 500);
        }
        
        // רינדור הכרטיסים
        renderCardsPaged('');
        
        return data;
    } catch (error) {
        console.error('❌ שגיאה בטעינת הגדרות:', error);
        
        // ניסיון לטעון מ-LocalStorage כגיבוי
        const savedData = localStorage.getItem(STORAGE_KEY);
        if (savedData) {
            const parsed = JSON.parse(savedData);
            entries = parsed;
            console.log(`⚠️ נטענו ${parsed.length} הגדרות מ-LocalStorage (גיבוי)`);
            renderCardsPaged('');
            return parsed;
        }
        
        const cardsList = document.getElementById('cardsList');
        if (cardsList) {
            cardsList.innerHTML = `
                <div class="empty-state">
                    <div class="icon">⚠️</div>
                    <h3>שגיאה בטעינת הגדרות</h3>
                    <p>לא ניתן לטעון את קובץ ההגדרות. ודא שהקובץ entries.json נמצא בתיקייה.</p>
                    <button onclick="location.reload()" style="margin-top:10px;padding:8px 16px;">🔄 נסה שוב</button>
                </div>`;
        }
        return [];
    }
}

// ==============================================
// רינדור כרטיסים
// ==============================================

function renderCardsPaged(query) {
    const list = document.getElementById('cardsList');
    const empty = document.getElementById('emptyState');
    const info = document.getElementById('resultsInfo');
    
    if (!list) return;
    
    const q = normalize(query || currentQuery || '');
    let filtered = q ? entries.filter(e => normalize(e.definition || '').includes(q)) : [...entries];
    
    if (currentFilter === 'no-explanation') {
        filtered = filtered.filter(e => !e.explanation || !e.explanation.trim());
    } else if (currentFilter === 'no-solution') {
        filtered = filtered.filter(e => !e.solution || !e.solution.trim());
    }
    
    filtered = filtered.slice().sort(hebrewSort);
    
    if (entries.length === 0) {
        list.innerHTML = '';
        if (empty) empty.style.display = 'block';
        if (info) info.style.display = 'none';
        return;
    }
    
    if (empty) empty.style.display = 'none';
    
    const start = entriesPage * 50;
    const pageFiltered = filtered.slice(start, start + 50);
    
    if (info) {
        info.style.display = 'block';
        info.innerHTML = `מוצגים <span class="highlight">${pageFiltered.length}</span> הגדרות מתוך: <span class="highlight">${filtered.length}</span>`;
    }
    
    if (pageFiltered.length === 0) {
        list.innerHTML = `<div class="empty-state"><div class="icon">🔍</div><h3>לא נמצאו תוצאות</h3><p>נסה מילה אחרת או שנה סינון</p></div>`;
        return;
    }
    
    list.innerHTML = pageFiltered.map((e, idx) => `
        <div class="card" style="animation-delay:${Math.min(idx * 0.03, 0.3)}s">
            <div class="card-header">
                <div class="card-definition">${highlightText(e.definition || '', query || '')}</div>
                <div class="card-meta">
                    ${e.letters ? `<span class="tag tag-letters">${escapeHtml(e.letters)}</span>` : ''}
                    ${e.type ? `<span class="tag tag-type">${escapeHtml(e.type)}</span>` : ''}
                </div>
            </div>
            <div class="card-solution">◈ ${e.solution ? escapeHtml(e.solution) : '<span style="color:var(--danger);">ללא תשובה</span>'}</div>
            ${e.explanation ? `<div class="card-divider"></div><div class="card-explanation">${escapeHtml(e.explanation)}</div>` : ''}
            ${isOwner ? `<div class="card-actions"><button class="btn-icon" onclick="openEdit('${e.id}')">✏️ עריכה</button></div>` : ''}
        </div>
    `).join('');
    
    if (start + 50 < filtered.length) {
        list.innerHTML += `<div style="text-align:center;margin:20px 0;"><button class="btn" onclick="loadMoreEntries()">טען עוד (${filtered.length - (start + 50)} נוספים)</button></div>`;
    }
}

function loadMoreEntries() {
    entriesPage++;
    renderCardsPaged(currentQuery);
}

// ==============================================
// חיפוש וסינון
// ==============================================

function onSearchFieldChange() {
    searchField = document.getElementById('searchField').value;
    const placeholders = { definition: 'חפש הגדרה...', solution: 'חפש פתרון...', explanation: 'חפש רמז...' };
    const input = document.getElementById('searchInput');
    if (input) input.placeholder = placeholders[searchField];
    currentQuery = input ? input.value.trim() : '';
    entriesPage = 0;
    renderCardsPaged(currentQuery);
}

function clearSearch() {
    const input = document.getElementById('searchInput');
    if (input) {
        input.value = '';
        currentQuery = '';
    }
    const clearBtn = document.getElementById('clearSearch');
    if (clearBtn) clearBtn.style.display = 'none';
    entriesPage = 0;
    renderCardsPaged('');
    if (input) input.focus();
}

function setFilter(filter) {
    currentFilter = filter;
    document.querySelectorAll('.filter-btn[id^="filter"]').forEach(b => b.classList.remove('active'));
    const activeBtn = document.getElementById(`filter-${filter}`);
    if (activeBtn) activeBtn.classList.add('active');
    entriesPage = 0;
    renderCardsPaged(currentQuery);
}

// ==============================================
// מעבר בין טאבים
// ==============================================

function switchTab(tabId) {
    // הסרת active מכל הכפתורים והתצוגות
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
    
    // הפעלת הכפתור הנבחר
    const selectedBtn = document.querySelector(`.tab-btn[onclick*="${tabId}"]`);
    if (selectedBtn) selectedBtn.classList.add('active');
    
    // הפעלת התצוגה הנבחרת
    const selectedView = document.getElementById(`view-${tabId}`);
    if (selectedView) selectedView.classList.add('active');
    
    // טיפול מיוחד בטאבים מסוימים
    const searchWrap = document.getElementById('searchWrap');
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

// ==============================================
// הוספת הגדרה
// ==============================================

function addEntry() {
    const definition = document.getElementById('f-definition')?.value.trim();
    const solution = document.getElementById('f-solution')?.value.trim();
    let letters = document.getElementById('f-letters')?.value.trim();
    const type = document.getElementById('f-type')?.value.trim();
    const explanation = document.getElementById('f-explanation')?.value.trim();
    
    if (!definition) {
        showToast('נדרשת הגדרה', 'error');
        return;
    }
    
    if (!letters) {
        const m = definition.match(/\((\d[\d,]*)\)/);
        if (m) letters = m[1];
    }
    
    const entry = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2),
        definition, solution, letters, type, explanation,
        createdAt: Date.now()
    };
    
    // ניקוי שדות
    ['f-definition', 'f-solution', 'f-letters', 'f-type', 'f-explanation'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    
    entries.unshift(entry);
    saveDataLocal(entries);
    showToast('✅ ההגדרה נוספה!', 'success');
    switchTab('search');
}

// ==============================================
// עריכת הגדרה
// ==============================================

function openEdit(id) {
    const e = entries.find(x => x.id === id);
    if (!e) return;
    
    const editId = document.getElementById('edit-id');
    const editDef = document.getElementById('edit-definition');
    const editLetters = document.getElementById('edit-letters');
    const editType = document.getElementById('edit-type');
    const editSolution = document.getElementById('edit-solution');
    const editExplanation = document.getElementById('edit-explanation');
    
    if (editId) editId.value = id;
    if (editDef) editDef.value = e.definition || '';
    if (editLetters) editLetters.value = e.letters || '';
    if (editType) editType.value = e.type || '';
    if (editSolution) editSolution.value = e.solution || '';
    if (editExplanation) editExplanation.value = e.explanation || '';
    
    const modal = document.getElementById('editModal');
    if (modal) modal.classList.add('open');
}

function saveEdit() {
    const id = document.getElementById('edit-id')?.value;
    const idx = entries.findIndex(x => x.id === id);
    if (idx === -1) return;
    
    const definition = document.getElementById('edit-definition')?.value.trim();
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
        explanation: document.getElementById('edit-explanation')?.value.trim() || '',
    };
    
    saveDataLocal(entries);
    closeModal();
    renderCardsPaged(currentQuery);
    showToast('✅ ההגדרה עודכנה', 'success');
}

function closeModal() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
}

// ==============================================
// מחיקת הגדרות
// ==============================================

function renderDeleteList() {
    const query = document.getElementById('deleteSearchInput')?.value.trim().toLowerCase() || '';
    const list = document.getElementById('deleteList');
    const footer = document.getElementById('deleteFooter');
    
    if (!list) return;
    
    const filtered = query ? entries.filter(e => normalize(e.definition).includes(query)) : entries;
    
    if (filtered.length === 0) {
        list.innerHTML = `<div class="empty-state"><div class="icon">🔍</div><h3>לא נמצאו הגדרות</h3></div>`;
        if (footer) footer.style.display = 'none';
        return;
    }
    
    list.innerHTML = filtered.map(e => `
        <div class="delete-item ${selectedForDelete.has(e.id) ? 'selected' : ''}" onclick="toggleDeleteSelect('${e.id}', this)">
            <input type="checkbox" ${selectedForDelete.has(e.id) ? 'checked' : ''} onclick="event.stopPropagation();toggleDeleteSelect('${e.id}', this.closest('.delete-item'))" />
            <div class="delete-item-text">
                <div class="delete-item-def">${escapeHtml(e.definition)}</div>
                ${e.solution ? `<div class="delete-item-sol">◈ ${escapeHtml(e.solution)}</div>` : ''}
            </div>
        </div>
    `).join('');
    
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
    const checkbox = el ? el.querySelector('input') : null;
    if (checkbox) checkbox.checked = selectedForDelete.has(id);
    updateDeleteFooter();
}

function updateDeleteFooter() {
    const footer = document.getElementById('deleteFooter');
    const count = document.getElementById('deleteCount');
    if (footer && count) {
        if (selectedForDelete.size > 0) {
            footer.style.display = 'block';
            count.textContent = selectedForDelete.size;
        } else {
            footer.style.display = 'none';
        }
    }
}

function selectAllDelete() {
    const query = document.getElementById('deleteSearchInput')?.value.trim().toLowerCase() || '';
    const filtered = query ? entries.filter(e => normalize(e.definition).includes(query)) : entries;
    filtered.forEach(e => selectedForDelete.add(e.id));
    renderDeleteList();
}

function deselectAllDelete() {
    selectedForDelete.clear();
    renderDeleteList();
}

function confirmDeleteSelected() {
    if (selectedForDelete.size === 0) return;
    const count = selectedForDelete.size;
    entries = entries.filter(e => !selectedForDelete.has(e.id));
    selectedForDelete.clear();
    saveDataLocal(entries);
    renderDeleteList();
    showToast(`🗑️ נמחקו ${count} הגדרות`, 'success');
}

// ==============================================
// ייצוא
// ==============================================

function exportEntries() {
    if (entries.length === 0) {
        showToast('אין הגדרות לייצוא', 'error');
        return;
    }
    const lines = entries.map(e => {
        let def = `ההגדרה: ${e.definition}`;
        if (e.letters) def += ` (${e.letters})`;
        if (e.type) def += ` [${e.type}]`;
        const parts = [def, `הפתרון: ${e.solution || ''}`];
        if (e.explanation) parts.push(`הסבר: ${e.explanation}`);
        return parts.join(' | ');
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `תשובות_להגדרות_היגיון_${new Date().toLocaleDateString('he-IL').replace(/\//g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`✅ יוצאו ${entries.length} הגדרות`, 'success');
}

function exportUpdatedHTML() {
    const blob = new Blob([document.documentElement.outerHTML], { type: 'text/html;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'updated_riddles.html';
    a.click();
    URL.revokeObjectURL(blob);
}

// ==============================================
// בדיקת כפילויות
// ==============================================

function checkDuplicates() {
    const seen = {};
    const groups = [];
    
    for (const e of entries) {
        const key = normalize(e.definition);
        if (!seen[key]) seen[key] = [];
        seen[key].push(e);
    }
    
    for (const key in seen) {
        if (seen[key].length > 1) groups.push(seen[key]);
    }
    
    const container = document.getElementById('dupesResult');
    if (!container) return;
    
    if (groups.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="icon">✅</div><h3>אין כפילויות!</h3><p>כל ${entries.length} ההגדרות ייחודיות</p></div>`;
        return;
    }
    
    let html = `<div class="results-info">נמצאו <span class="highlight">${groups.length}</span> קבוצות כפילויות
        <button class="btn-icon danger" onclick="deleteAllDupes()">🗑️ מחק כפילויות אוטומטית</button>
    </div>`;
    
    for (const group of groups) {
        html += `<div class="card" style="border-color:var(--danger);margin-bottom:14px;">
            <div style="font-size:0.75rem;color:var(--danger);font-weight:700;margin-bottom:10px;">⚠️ ${group.length} כניסות זהות</div>`;
        group.forEach((e, idx) => {
            html += `<div style="background:var(--surface2);border-radius:10px;padding:12px;margin-bottom:8px;">
                <div style="font-size:0.85rem;font-weight:600;margin-bottom:4px;">${escapeHtml(e.definition)}</div>
                <div style="font-size:0.9rem;color:var(--success);">◈ ${escapeHtml(e.solution)}</div>
                <div style="margin-top:8px;">
                    ${idx > 0 ? `<button class="btn-icon danger" onclick="deleteDupe('${e.id}')">🗑️ מחק עותק זה</button>` : `<span style="font-size:0.75rem;color:var(--text-muted);">← ישמר</span>`}
                </div>
            </div>`;
        });
        html += `</div>`;
    }
    
    container.innerHTML = html;
}

function deleteDupe(id) {
    entries = entries.filter(e => e.id !== id);
    saveDataLocal(entries);
    showToast('🗑️ הכפילות נמחקה', 'success');
    checkDuplicates();
}

function deleteAllDupes() {
    const seen = {};
    const toKeep = [];
    for (const e of entries) {
        const key = normalize(e.definition);
        if (!seen[key]) {
            seen[key] = true;
            toKeep.push(e);
        }
    }
    const removed = entries.length - toKeep.length;
    entries = toKeep;
    saveDataLocal(entries);
    showToast(`✅ נמחקו ${removed} כפילויות`, 'success');
    checkDuplicates();
}

// ==============================================
// ייבוא
// ==============================================

function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => processImportText(e.target.result);
    reader.readAsText(file, 'UTF-8');
}

function importFromPaste() {
    const text = document.getElementById('pasteArea')?.value;
    if (!text || !text.trim()) {
        showToast('אין טקסט לייבוא', 'error');
        return;
    }
    processImportText(text);
    const pasteArea = document.getElementById('pasteArea');
    if (pasteArea) pasteArea.value = '';
}

function parseEntryLine(line) {
    line = line.trim();
    if (!line) return null;
    
    let definition = '', solution = '', explanation = '', letters = '', type = '';
    const parts = line.split('|').map(p => p.trim());
    
    for (const part of parts) {
        if (part.startsWith('ההגדרה:') || part.startsWith('הגדרה:')) {
            let def = part.replace(/^(ה)?הגדרה:\s*/, '');
            const lettersMatch = def.match(/\((\d[\d,\s-]*)\)/);
            if (lettersMatch) letters = lettersMatch[1];
            const typeMatch = def.match(/\[([^\]]+)\]/);
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
        definition, solution, letters, type, explanation,
        createdAt: Date.now()
    };
}

function processImportText(text) {
    const lines = text.split('\n');
    let added = 0, updated = 0, skipped = 0, failed = 0;
    
    for (const line of lines) {
        if (!line.trim()) continue;
        const entry = parseEntryLine(line);
        if (!entry) {
            failed++;
            continue;
        }
        
        const normNew = normalize(entry.definition);
        const existingIdx = entries.findIndex(e => normalize(e.definition) === normNew);
        
        if (existingIdx !== -1) {
            const existing = entries[existingIdx];
            let changed = false;
            let updatedEntry = { ...existing };
            
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
    
    const parts = [];
    if (added > 0) parts.push(`נוספו ${added} חדשות`);
    if (updated > 0) parts.push(`עודכנו ${updated} פתרונות/הסברים`);
    if (skipped > 0) parts.push(`${skipped} כפילויות דולגו`);
    if (failed > 0) parts.push(`${failed} שורות לא זוהו`);
    
    if (added > 0 || updated > 0) {
        showToast(`✅ ${parts.join(' · ')}`, 'success');
        switchTab('search');
    } else if (skipped > 0) {
        showToast(`⚠️ ${parts.join(' · ')}`, '');
    } else {
        showToast('לא זוהו הגדרות — בדוק את הפורמט', 'error');
    }
}

// ==============================================
// הצעות הגדרה
// ==============================================

function openSuggestionModal() {
    ['sug-definition', 'sug-letters', 'sug-solution', 'sug-explanation'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const modal = document.getElementById('suggestionModal');
    if (modal) modal.classList.add('open');
    setTimeout(() => document.getElementById('sug-definition')?.focus(), 350);
}

function closeSuggestionModal() {
    const modal = document.getElementById('suggestionModal');
    if (modal) modal.classList.remove('open');
}

async function submitSuggestion() {
    const definition = document.getElementById('sug-definition')?.value.trim();
    const solution = document.getElementById('sug-solution')?.value.trim();
    const letters = document.getElementById('sug-letters')?.value.trim();
    const explanation = document.getElementById('sug-explanation')?.value.trim();
    
    if (!definition) {
        showToast('נא למלא את ההגדרה', 'error');
        return;
    }
    
    closeSuggestionModal();
    showToast('⏳ שולח הצעה...', '');
    
    try {
        const url = `${APPS_SCRIPT_URL}?action=submitSuggestion&def=${encodeURIComponent(definition)}&sol=${encodeURIComponent(solution || '')}&letters=${encodeURIComponent(letters || '')}&exp=${encodeURIComponent(explanation || '')}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.ok) showToast('✅ ההצעה נשלחה, תודה!', 'success');
        else showToast('שגיאה בשליחה', 'error');
    } catch(e) {
        showToast('שגיאה בשליחה', 'error');
    }
}

// ==============================================
// פידבק
// ==============================================

function openFeedbackModal() {
    const textarea = document.getElementById('feedback-text');
    if (textarea) textarea.value = '';
    selectFeedbackType('bug');
    const modal = document.getElementById('feedbackModal');
    if (modal) modal.classList.add('open');
    setTimeout(() => document.getElementById('feedback-text')?.focus(), 350);
}

function closeFeedbackModal() {
    const modal = document.getElementById('feedbackModal');
    if (modal) modal.classList.remove('open');
}

function selectFeedbackType(type) {
    feedbackType = type;
    const bugBtn = document.getElementById('ftype-bug');
    const improveBtn = document.getElementById('ftype-improve');
    if (bugBtn) bugBtn.classList.toggle('selected', type === 'bug');
    if (improveBtn) improveBtn.classList.toggle('selected', type === 'improve');
}

async function submitFeedback() {
    const text = document.getElementById('feedback-text')?.value.trim();
    if (!text) {
        showToast('נא לכתוב תיאור', 'error');
        return;
    }
    closeFeedbackModal();
    showToast('שולח פידבק...', '');
    try {
        const url = `${APPS_SCRIPT_URL}?action=submitFeedback&type=${encodeURIComponent(feedbackType)}&text=${encodeURIComponent(text)}`;
        const res = await fetch(url);
        const data = await res.json();
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
    document.querySelectorAll('.owner-only').forEach(el => {
        el.style.display = isOwner ? 'inline-block' : 'none';
    });
    
    const suggestBtn = document.getElementById('suggest-btn');
    const feedbackBtn = document.getElementById('feedback-btn');
    
    if (suggestBtn) suggestBtn.style.display = isOwner ? 'none' : 'inline-block';
    if (feedbackBtn) feedbackBtn.style.display = isOwner ? 'none' : 'inline-block';
}

function updateSyncBtn(state) {
    const btn = document.getElementById('syncBtn');
    const icon = document.getElementById('syncIcon');
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
    const client = google.accounts.oauth2.initTokenClient({
        client_id: GDRIVE_CLIENT_ID,
        scope: GDRIVE_SCOPE,
        callback: async (resp) => {
            if (resp.error) {
                showToast('שגיאה בהתחברות', 'error');
                return;
            }
            gAccessToken = resp.access_token;
            localStorage.setItem('g_access_token', gAccessToken);
            try {
                const info = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                    headers: { 'Authorization': `Bearer ${gAccessToken}` }
                });
                const u = await info.json();
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
    showToast('התנתקת מהחשבון', 'success');
    setTimeout(() => location.reload(), 500);
}

function handleSyncClick() {
    if (!gAccessToken) signInGoogle();
    else syncWithDrive();
}

async function syncWithDrive() {
    if (!isOwner) return;
    updateSyncBtn('syncing');
    try {
        const url = `${APPS_SCRIPT_URL}?action=getEntries&_t=${Date.now()}`;
        const res = await fetch(url);
        const data = await res.json();
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

// ==============================================
// ניהול הצעות (admin)
// ==============================================

async function renderApprovalsList() {
    const list = document.getElementById('approvalsList');
    if (!list) return;
    list.innerHTML = '<div style="color:var(--text-muted);padding:20px;text-align:center;">⏳ טוען...</div>';
    
    try {
        const data = await fetch(`${APPS_SCRIPT_URL}?action=getSuggestions&_t=${Date.now()}`).then(r => r.json());
        if (!Array.isArray(data) || data.length === 0) {
            list.innerHTML = '<div class="empty-state"><div class="icon">📭</div><h3>אין הצעות ממתינות</h3></div>';
            const tabApprovals = document.getElementById('tab-approvals');
            if (tabApprovals) tabApprovals.textContent = '📬 הצעות';
            return;
        }
        
        window.currentSuggestions = data;
        const tabApprovals = document.getElementById('tab-approvals');
        if (tabApprovals) tabApprovals.innerHTML = `📬 הצעות <span class="count-badge">${data.length}</span>`;
        
        list.innerHTML = data.map((s, i) => `
            <div class="approval-card">
                <div class="approval-card-def">📝 ${escapeHtml(s.definition)}${s.letters ? ' (' + escapeHtml(s.letters) + ')' : ''}</div>
                ${s.solution ? `<div class="approval-card-sol">◈ ${escapeHtml(s.solution)}</div>` : ''}
                ${s.explanation ? `<div class="approval-card-exp">💡 ${escapeHtml(s.explanation)}</div>` : ''}
                <div class="approval-actions">
                    <button class="btn-approve" onclick="approveSuggestion(${i})">✅ אשר והוסף</button>
                    <button class="btn-reject" onclick="rejectSuggestion(${i})">❌ דחה</button>
                </div>
            </div>
        `).join('');
    } catch(e) {
        list.innerHTML = '<div style="color:var(--danger);padding:20px;text-align:center;">שגיאה בטעינה</div>';
    }
}

async function approveSuggestion(index) {
    const suggestions = window.currentSuggestions || [];
    const suggestion = suggestions[index];
    if (!suggestion) return;
    
    const entry = {
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
    
    // הסרה מהרשימה המקומית
    suggestions.splice(index, 1);
    window.currentSuggestions = suggestions;
    renderApprovalsList();
    showToast('✅ ההצעה אושרה ונוספה למאגר', 'success');
}

async function rejectSuggestion(index) {
    const suggestions = window.currentSuggestions || [];
    suggestions.splice(index, 1);
    window.currentSuggestions = suggestions;
    renderApprovalsList();
    showToast('❌ ההצעה נדחתה', 'success');
}

// ==============================================
// פידבקים למנהל
// ==============================================

async function renderFeedbackList() {
    const bugsEl = document.getElementById('feedbackListBugs');
    const improvEl = document.getElementById('feedbackListImprovements');
    
    if (!bugsEl || !improvEl) return;
    
    try {
        const data = await fetch(`${APPS_SCRIPT_URL}?action=getFeedback&_t=${Date.now()}`).then(r => r.json());
        const bugs = [];
        const improvements = [];
        
        data.forEach((item, idx) => {
            const enriched = { ...item, _idx: idx };
            if (item.type === 'improvement') improvements.push(enriched);
            else bugs.push(enriched);
        });
        
        const renderCard = (item) => `
            <div class="card" style="margin-bottom:8px; padding:12px;">
                <div style="font-size:0.85rem;margin-bottom:8px;">${escapeHtml(item.text)}</div>
                <div style="display:flex; gap:8px; justify-content: flex-end;">
                    ${item.type === 'improvement' ? `<button class="btn btn-secondary" style="padding:4px 8px; font-size:0.75rem;" onclick="approveFeedbackItem(${item._idx})">אישור</button>` : ''}
                    <button class="btn" style="padding:4px 8px; font-size:0.75rem; background:rgba(244,63,94,0.1); color:var(--danger);" onclick="deleteFeedbackItem(${item._idx})">מחיקה</button>
                </div>
            </div>
        `;
        
        bugsEl.innerHTML = bugs.length ? bugs.map(renderCard).join('') : '<div style="color:var(--text-dim);text-align:center;padding:16px;">אין פריטים</div>';
        improvEl.innerHTML = improvements.length ? improvements.map(renderCard).join('') : '<div style="color:var(--text-dim);text-align:center;padding:16px;">אין פריטים</div>';
    } catch(e) {
        bugsEl.innerHTML = '<div style="color:var(--danger);text-align:center;padding:16px;">שגיאה בטעינה</div>';
        improvEl.innerHTML = '<div style="color:var(--danger);text-align:center;padding:16px;">שגיאה בטעינה</div>';
    }
}

async function approveFeedbackItem(index) {
    try {
        const data = await fetch(`${APPS_SCRIPT_URL}?action=approveFeedback&index=${index}`).then(r => r.json());
        if (data && data.ok) {
            renderFeedbackList();
            setTimeout(() => syncWithDrive(), 300);
            showToast('ההצעה אושרה ונוספה למאגר', 'success');
        } else {
            showToast('שגיאה בתהליך האישור', 'error');
        }
    } catch(e) {
        showToast('שגיאה בתהליך האישור', 'error');
    }
}

async function deleteFeedbackItem(index) {
    if (!confirm('למחוק את הפריט?')) return;
    try {
        const data = await fetch(`${APPS_SCRIPT_URL}?action=deleteFeedback&index=${index}`).then(r => r.json());
        if (data.ok) {
            showToast('נמחק בהצלחה', 'success');
            renderFeedbackList();
        }
    } catch(e) {
        showToast('שגיאה במחיקה', 'error');
    }
}

// ==============================================
// הגדרות דומות (admin)
// ==============================================

async function loadSimilar() {
    const container = document.getElementById('similarList');
    if (!container) return;
    container.innerHTML = '<div style="color:var(--text-muted);padding:20px;text-align:center;">⏳ טוען קבוצות...</div>';
    
    try {
        const groups = await fetch(`${APPS_SCRIPT_URL}?action=getSimilar&_t=${Date.now()}`).then(r => r.json());
        if (!Array.isArray(groups) || groups.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="icon">✅</div><h3>לא נמצאו קבוצות דומות</h3></div>';
            return;
        }
        
        container.innerHTML = '';
        groups.forEach((group, idx) => {
            const div = document.createElement('div');
            div.className = 'card';
            let html = `<h4 style="margin-bottom:10px;">קבוצה ${idx + 1} - ${group.length} הגדרות</h4><ol style="padding-right:18px;">`;
            group.forEach(g => {
                html += `<li style="margin-bottom:6px;">${escapeHtml(g.definition)} ${escapeHtml(g.letters || '')}</li>`;
            });
            html += '</ol>';
            const ids = group.map(g => g.id);
            const idsEncoded = encodeURIComponent(JSON.stringify(ids));
            html += `<button class="btn btn-primary" onclick="mergeGroup('${idsEncoded}')">מזג קבוצה</button>`;
            div.innerHTML = html;
            container.appendChild(div);
        });
    } catch(e) {
        container.innerHTML = '<div style="color:var(--danger);padding:20px;text-align:center;">שגיאה בטעינת קבוצות דומות</div>';
    }
}

async function mergeGroup(idsEncoded) {
    try {
        const ids = JSON.parse(decodeURIComponent(idsEncoded));
        const data = await fetch(`${APPS_SCRIPT_URL}?action=merge&ids=${encodeURIComponent(JSON.stringify(ids))}`).then(r => r.json());
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
    // טעינת הגדרות מקובץ JSON
    loadEntriesFromJSON();
    
    // בדיקת מצב מנהל
    const savedEmail = localStorage.getItem('g_user_email');
    if (savedEmail === OWNER_EMAIL) {
        isOwner = true;
        updateOwnerUI();
        updateSyncBtn('connected');
    }
    
    // הוספת מאזינים
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            currentQuery = this.value.trim();
            const clearBtn = document.getElementById('clearSearch');
            if (clearBtn) clearBtn.style.display = currentQuery ? 'block' : 'none';
            entriesPage = 0;
            renderCardsPaged(currentQuery);
        });
    }
    
    // מאזינים לסגירת מודלים
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', e => {
            if (e.target === overlay) closeModal();
        });
    });
    
    // מאזין לגרירה לאזור הייבוא
    const importZone = document.getElementById('importZone');
    if (importZone) {
        importZone.addEventListener('dragover', e => { e.preventDefault(); importZone.classList.add('drag-over'); });
        importZone.addEventListener('dragleave', () => importZone.classList.remove('drag-over'));
        importZone.addEventListener('drop', e => {
            e.preventDefault();
            importZone.classList.remove('drag-over');
            const file = e.dataTransfer.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = ev => processImportText(ev.target.result);
                reader.readAsText(file, 'UTF-8');
            }
        });
    }
    
    // הצגת טאב ברירת מחדל
    switchTab('search');
});

// exportUpdatedHTML - פונקציה גלובלית
window.exportUpdatedHTML = exportUpdatedHTML;
window.switchTab = switchTab;
window.setFilter = setFilter;
window.clearSearch = clearSearch;
window.onSearchFieldChange = onSearchFieldChange;
window.loadMoreEntries = loadMoreEntries;
window.addEntry = addEntry;
window.openEdit = openEdit;
window.saveEdit = saveEdit;
window.closeModal = closeModal;
window.openDelete = function(id) {
    const e = entries.find(x => x.id === id);
    if (!e) return;
    const deleteId = document.getElementById('delete-id');
    const deletePreview = document.getElementById('delete-preview');
    if (deleteId) deleteId.value = id;
    if (deletePreview) deletePreview.textContent = `${e.definition} → ${e.solution}`;
    const modal = document.getElementById('deleteModal');
    if (modal) modal.classList.add('open');
};
window.confirmDelete = function() {
    const id = document.getElementById('delete-id')?.value;
    if (id) {
        entries = entries.filter(x => x.id !== id);
        saveDataLocal(entries);
        closeModal();
        renderCardsPaged(currentQuery);
        showToast('🗑️ ההגדרה נמחקה', 'success');
    }
};
