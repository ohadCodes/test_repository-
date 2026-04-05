// ==============================================
// כל הקוד - גרסה מלאה שעובדת
// ==============================================

// משתנים גלובליים
let allEntries = [];
let currentUser = null;
let isAdmin = false;

// ==============================================
// טעינת נתונים התחלתית
// ==============================================

async function loadAllData() {
    try {
        // טעינת entries.json
        const response = await fetch('entries.json');
        const data = await response.json();
        allEntries = data;
        
        console.log(`טעינו ${allEntries.length} הגדרות`);
        
        // הצגת הכרטיסים
        displayAllCards();
        
        // עדכון סטטוס
        const statsSpan = document.getElementById('statsText');
        if (statsSpan) statsSpan.textContent = allEntries.length + ' הגדרות';
        
        // הסתרת מסך הפתיחה
        const splash = document.getElementById('splash');
        if (splash) {
            splash.style.opacity = '0';
            setTimeout(() => splash.remove(), 500);
        }
        
    } catch (error) {
        console.error('שגיאה:', error);
        const container = document.getElementById('cardsList');
        if (container) {
            container.innerHTML = '<div class="empty-state" style="color:red;">❌ שגיאה בטעינת הגדרות</div>';
        }
    }
}

// ==============================================
// הצגת כל הכרטיסים
// ==============================================

function displayAllCards() {
    const container = document.getElementById('cardsList');
    if (!container) return;
    
    if (!allEntries || allEntries.length === 0) {
        container.innerHTML = '<div class="empty-state">📭 אין הגדרות במאגר</div>';
        return;
    }
    
    let html = '';
    
    for (let i = 0; i < allEntries.length; i++) {
        const item = allEntries[i];
        
        html += `
            <div class="card">
                <div class="card-header">
                    <div class="card-definition">${escapeHtml(item.definition)}</div>
                    ${item.letters ? `<div class="tag-letters">${escapeHtml(item.letters)} אותיות</div>` : ''}
                </div>
                <div class="card-solution">◈ ${escapeHtml(item.solution) || '<span style="color:#f43f5e;">ללא פתרון</span>'}</div>
                ${item.explanation ? `<div class="card-explanation">💡 ${escapeHtml(item.explanation)}</div>` : ''}
            </div>
        `;
    }
    
    container.innerHTML = html;
}

// ==============================================
// פונקציות חיפוש
// ==============================================

function searchEntries() {
    const query = document.getElementById('searchInput')?.value.trim().toLowerCase() || '';
    const container = document.getElementById('cardsList');
    
    if (!query) {
        displayAllCards();
        return;
    }
    
    const filtered = allEntries.filter(item => 
        item.definition.toLowerCase().includes(query) ||
        (item.solution && item.solution.toLowerCase().includes(query)) ||
        (item.explanation && item.explanation.toLowerCase().includes(query))
    );
    
    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-state">🔍 לא נמצאו תוצאות</div>';
        return;
    }
    
    let html = '';
    for (let i = 0; i < filtered.length; i++) {
        const item = filtered[i];
        html += `
            <div class="card">
                <div class="card-definition">${highlightText(item.definition, query)}</div>
                <div class="card-solution">◈ ${highlightText(item.solution || 'ללא פתרון', query)}</div>
                ${item.explanation ? `<div class="card-explanation">💡 ${highlightText(item.explanation, query)}</div>` : ''}
            </div>
        `;
    }
    container.innerHTML = html;
}

function clearSearch() {
    const input = document.getElementById('searchInput');
    if (input) input.value = '';
    displayAllCards();
}

// ==============================================
// פונקציות עזר
// ==============================================

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function highlightText(text, query) {
    if (!text || !query) return escapeHtml(text);
    const escapedText = escapeHtml(text);
    const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
    return escapedText.replace(regex, '<mark>$1</mark>');
}

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ==============================================
// מעבר בין טאבים
// ==============================================

function switchTab(tabName) {
    // הסתרת כל התצוגות
    const views = document.querySelectorAll('.view');
    views.forEach(view => view.classList.remove('active'));
    
    // הצגת התצוגה הנבחרת
    const selectedView = document.getElementById(`view-${tabName}`);
    if (selectedView) selectedView.classList.add('active');
    
    // עדכון כפתורים
    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    
    const activeBtn = document.querySelector(`[onclick="switchTab('${tabName}')"]`);
    if (activeBtn) activeBtn.classList.add('active');
    
    // טיפול מיוחד בטאב חיפוש
    const searchWrap = document.getElementById('searchWrap');
    if (searchWrap) {
        searchWrap.style.display = tabName === 'search' ? 'flex' : 'none';
    }
}

// ==============================================
// הוספת הגדרה חדשה
// ==============================================

function addEntry() {
    const definition = document.getElementById('f-definition')?.value.trim();
    const solution = document.getElementById('f-solution')?.value.trim();
    let letters = document.getElementById('f-letters')?.value.trim();
    const type = document.getElementById('f-type')?.value.trim();
    const explanation = document.getElementById('f-explanation')?.value.trim();
    
    if (!definition) {
        alert('נא להזין הגדרה');
        return;
    }
    
    // חילוץ אוטומטי של מספר אותיות
    if (!letters) {
        const match = definition.match(/\((\d+)\)/);
        if (match) letters = match[1];
    }
    
    const newEntry = {
        id: Date.now().toString(),
        definition: definition,
        solution: solution || '',
        letters: letters || '',
        type: type || '',
        explanation: explanation || '',
        createdAt: Date.now()
    };
    
    allEntries.unshift(newEntry);
    
    // שמירה ב-localStorage
    localStorage.setItem('entries_backup', JSON.stringify(allEntries));
    
    // ניקוי טופס
    document.getElementById('f-definition').value = '';
    document.getElementById('f-solution').value = '';
    document.getElementById('f-letters').value = '';
    document.getElementById('f-type').value = '';
    document.getElementById('f-explanation').value = '';
    
    alert('✅ ההגדרה נוספה!');
    
    // מעבר לטאב חיפוש
    switchTab('search');
    displayAllCards();
}

// ==============================================
// ייצוא הגדרות
// ==============================================

function exportEntries() {
    if (allEntries.length === 0) {
        alert('אין הגדרות לייצוא');
        return;
    }
    
    let text = '';
    for (let i = 0; i < allEntries.length; i++) {
        const e = allEntries[i];
        text += `הגדרה: ${e.definition}`;
        if (e.letters) text += ` (${e.letters})`;
        if (e.type) text += ` [${e.type}]`;
        text += ` | פתרון: ${e.solution || ''}`;
        if (e.explanation) text += ` | הסבר: ${e.explanation}`;
        text += '\n';
    }
    
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `definitions_${new Date().toISOString().slice(0,19).replace(/:/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    
    alert(`✅ יוצאו ${allEntries.length} הגדרות`);
}

// ==============================================
// סינון לפי חסרי הסבר/פתרון
// ==============================================

let currentFilter = 'all';

function setFilter(filter) {
    currentFilter = filter;
    
    let filtered = [...allEntries];
    
    if (filter === 'no-explanation') {
        filtered = filtered.filter(e => !e.explanation || e.explanation.trim() === '');
    } else if (filter === 'no-solution') {
        filtered = filtered.filter(e => !e.solution || e.solution.trim() === '');
    }
    
    const container = document.getElementById('cardsList');
    if (!container) return;
    
    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-state">🔍 לא נמצאו תוצאות</div>';
        return;
    }
    
    let html = '';
    for (let i = 0; i < filtered.length; i++) {
        const item = filtered[i];
        html += `
            <div class="card">
                <div class="card-definition">${escapeHtml(item.definition)}</div>
                <div class="card-solution">◈ ${escapeHtml(item.solution) || '<span style="color:#f43f5e;">ללא פתרון</span>'}</div>
                ${item.explanation ? `<div class="card-explanation">💡 ${escapeHtml(item.explanation)}</div>` : ''}
            </div>
        `;
    }
    container.innerHTML = html;
    
    // עדכון כפתורים פעילים
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`filter-${filter}`);
    if (activeBtn) activeBtn.classList.add('active');
}

// ==============================================
// אתחול הדף
// ==============================================

document.addEventListener('DOMContentLoaded', function() {
    loadAllData();
    
    // מאזין לחיפוש
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', searchEntries);
    }
    
    // פתיחת טאב חיפוש כברירת מחדל
    switchTab('search');
});
