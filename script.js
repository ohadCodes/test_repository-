// ==============================================
// גרסת בסיס - רק טעינה והצגה
// ==============================================

let allEntries = [];

// טעינת הגדרות
async function loadEntries() {
    try {
        const response = await fetch('entries.json');
        const data = await response.json();
        allEntries = data;
        
        console.log('נטענו', allEntries.length, 'הגדרות');
        
        // הצגה
        renderCards(allEntries);
        
        // עדכון סטטוס
        const stats = document.getElementById('statsText');
        if (stats) stats.textContent = allEntries.length + ' הגדרות';
        
        // הסתרת מסך פתיחה
        const splash = document.getElementById('splash');
        if (splash) {
            splash.classList.add('hide');
            setTimeout(() => splash.remove(), 500);
        }
        
    } catch (err) {
        console.error('שגיאה:', err);
        document.getElementById('cardsList').innerHTML = '<div class="empty-state">⚠️ שגיאה בטעינת הגדרות</div>';
    }
}

// הצגת כרטיסים
function renderCards(entries) {
    const container = document.getElementById('cardsList');
    if (!container) return;
    
    if (!entries || entries.length === 0) {
        container.innerHTML = '<div class="empty-state">📭 אין הגדרות</div>';
        return;
    }
    
    let html = '';
    for (let i = 0; i < entries.length; i++) {
        const e = entries[i];
        html += `
            <div class="card">
                <div class="card-definition">${safeHtml(e.definition)}</div>
                <div class="card-solution">◈ ${safeHtml(e.solution) || 'ללא פתרון'}</div>
                ${e.explanation ? `<div class="card-explanation">💡 ${safeHtml(e.explanation)}</div>` : ''}
            </div>
        `;
    }
    container.innerHTML = html;
}

// הגנה מפני XSS
function safeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// חיפוש
function doSearch() {
    const q = document.getElementById('searchInput')?.value.trim().toLowerCase() || '';
    if (!q) {
        renderCards(allEntries);
        return;
    }
    const filtered = allEntries.filter(e => 
        e.definition.toLowerCase().includes(q) || 
        (e.solution && e.solution.toLowerCase().includes(q))
    );
    renderCards(filtered);
}

// מעבר טאבים
function switchTab(tab) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const target = document.getElementById('view-' + tab);
    if (target) target.classList.add('active');
    
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    const btn = document.querySelector(`[onclick="switchTab('${tab}')"]`);
    if (btn) btn.classList.add('active');
    
    const searchWrap = document.getElementById('searchWrap');
    if (searchWrap) searchWrap.style.display = tab === 'search' ? 'flex' : 'none';
}

// הפעלה
document.addEventListener('DOMContentLoaded', function() {
    loadEntries();
    
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', doSearch);
    }
    
    switchTab('search');
});
