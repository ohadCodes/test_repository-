// ==============================================
// גרסה פשוטה - טוענת הכל בפעם אחת
// ==============================================

let allEntries = [];

// טעינת הנתונים כשהדף נטען
async function loadData() {
    console.log("מתחיל טעינת נתונים...");
    
    try {
        const response = await fetch('entries.json');
        const data = await response.json();
        
        allEntries = data;
        console.log("נטענו " + allEntries.length + " הגדרות");
        
        // הצגת ההגדרות
        displayEntries(allEntries);
        
        // עדכון סטטוס
        const stats = document.getElementById('statsText');
        if (stats) stats.innerText = allEntries.length + " הגדרות";
        
        // הסתרת מסך פתיחה
        const splash = document.getElementById('splash');
        if (splash) {
            splash.style.opacity = '0';
            setTimeout(() => splash.remove(), 500);
        }
        
    } catch(error) {
        console.error("שגיאה:", error);
        document.getElementById('cardsList').innerHTML = '<div class="empty-state">❌ שגיאה בטעינת הגדרות</div>';
    }
}

// הצגת כל ההגדרות
function displayEntries(entries) {
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
                <div class="card-definition">${escapeHtml(e.definition)}</div>
                <div class="card-solution">◈ ${escapeHtml(e.solution || 'ללא פתרון')}</div>
                ${e.explanation ? `<div class="card-explanation">💡 ${escapeHtml(e.explanation)}</div>` : ''}
            </div>
        `;
    }
    
    container.innerHTML = html;
}

// פונקציית עזר להצגת טקסט בטוח
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// חיפוש
function searchEntries() {
    const query = document.getElementById('searchInput')?.value.trim().toLowerCase() || '';
    
    if (!query) {
        displayEntries(allEntries);
        return;
    }
    
    const filtered = allEntries.filter(e => 
        e.definition.toLowerCase().includes(query) ||
        (e.solution && e.solution.toLowerCase().includes(query))
    );
    
    displayEntries(filtered);
    
    const info = document.getElementById('resultsInfo');
    if (info) info.innerText = `נמצאו ${filtered.length} תוצאות מתוך ${allEntries.length}`;
}

// איפוס חיפוש
function clearSearch() {
    const input = document.getElementById('searchInput');
    if (input) input.value = '';
    displayEntries(allEntries);
    const info = document.getElementById('resultsInfo');
    if (info) info.innerText = '';
}

// מעבר טאבים
function switchTab(tabId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const view = document.getElementById('view-' + tabId);
    if (view) view.classList.add('active');
    
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    const btn = document.querySelector(`[onclick="switchTab('${tabId}')"]`);
    if (btn) btn.classList.add('active');
    
    const searchWrap = document.getElementById('searchWrap');
    if (searchWrap) searchWrap.style.display = tabId === 'search' ? 'flex' : 'none';
}

// הפעלה
document.addEventListener('DOMContentLoaded', function() {
    loadData();
    
    // מאזין לחיפוש
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', searchEntries);
    }
    
    // פתיחת טאב חיפוש כברירת מחדל
    switchTab('search');
});
