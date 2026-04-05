  // הגדרת משתנים גלובליים בראש הסקריפט למניעת שגיאות initialization
  let currentUser = null;
  let isAdmin = false; // ברירת מחדל: לא מנהל
  let allEntries = [];
  let gAccessToken = null;
  let gUserEmail = null;
  let entries = []; 
  let currentQuery = '';
  let currentFilter = 'all';
  let sortAZ = true;
  let searchField = 'definition';
  const ENTRIES_PAGE_SIZE = 1000; 
  let entriesPage = 0;
  let isOwner = false; // שורה זו חייבת להיות כאן בראש הקוד!
  // משתני עזר ותפעול
  let definition = '', solution = '', explanation = '', letters = '', type = '';
  let toastTimer;
  let selectedForDelete = new Set();
  let feedbackType = 'bug';
  // ──────────────────────────────────────────────
  // DATA LAYER
  // ──────────────────────────────────────────────
  // הוספת הפונקציה שחסרה לדפדפן
// הגדרה גלובלית בראש הסקריפט כדי שה-HTML יזהה אותה תמיד
window.switchTab = function(tabId) {
    console.log("Switching to tab:", tabId); // לבדיקה ב-Console
    
    // 1. הסרת מצב פעיל מכל הטאבים
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));

    // 2. הפעלת הטאב שנבחר
    const activeBtn = document.querySelector(`.tab-btn[onclick*="${tabId}"]`);
    if (activeBtn) activeBtn.classList.add('active');

    const activeView = document.getElementById(`view-${tabId}`);
    if (activeView) activeView.classList.add('active');
    
    // מיקוד אוטומטי בשדה החיפוש אם עברנו לחיפוש
    if (tabId === 'search') {
        setTimeout(() => document.getElementById('searchInput')?.focus(), 100);
    }
};
  function updateFilterButtons() {
    console.log("מעדכן כפתורי סינון...");
    // כאן אפשר להוסיף לוגיקה עתידית לעיצוב הכפתורים
}
  window.onload = function() {
    console.log("המערכת בטעינה... בודק נתונים ב-tashbetz_entries");

    try {
      // 1. טעינה ראשונית - קודם כל מהקובץ המקומי (BUNDLED_ENTRIES)
      // אנחנו משתמשים ב-window. כדי למנוע שגיאות ReferenceError אם המשתנה מוגדר בסוף
      if (window.BUNDLED_ENTRIES && Array.isArray(window.BUNDLED_ENTRIES)) {
          allEntries = [...window.BUNDLED_ENTRIES];
          console.log("נתונים נטענו מהקובץ: " + allEntries.length);
      }

      // 2. בדיקה אם יש נתונים חדשים יותר ב-LocalStorage (סנכרון קודם או עריכות)
      const savedData = localStorage.getItem('tashbetz_entries');
      if (savedData) {
          const parsed = JSON.parse(savedData);
          if (Array.isArray(parsed) && parsed.length > 0) {
              allEntries = parsed;
              console.log("נמצאו נתונים מעודכנים בזיכרון המקומי: " + allEntries.length);
          }
      }

      // 3. הכנת המערך לעבודה (חיפושים ותצוגה)
      entries = [...allEntries];

      // 4. הצגה ראשונית של התוצאות (עמוד ראשון)
      if (typeof renderCardsPaged === "function") {
          renderCardsPaged(entries);
      } else if (typeof render === "function") {
          render();
      }

      // 5. עדכון הסטטיסטיקה (הבאדג' בראש הדף)
      const statsBadge = document.querySelector('.stats-badge');
      if (statsBadge) {
          statsBadge.textContent = allEntries.length.toLocaleString() + ' הגדרות במאגר';
      }

      // 6. בדיקת הרשאות מנהל וחיבור לגוגל
      if (typeof checkOwnerStatus === "function") {
          checkOwnerStatus();
      }

    } catch (err) {
      console.error("שגיאה קריטית בזמן טעינת הדף:", err);
      showToast("שגיאה בטעינת הנתונים", "error");
    }

    // הפעלת התצוגה
    renderCardsPaged(entries);
    
    // הסתרת טאב מנהל אם אינך מנהל
    if (!isOwner) {
        const dupesTab = document.getElementById('tab-dupes');
        if (dupesTab) dupesTab.style.display = 'none';
    }
  const STORAGE_KEY_PREFIX = 'tashbetz_entries';
  

  function getStorageKey() {
    const email = localStorage.getItem('g_user_email');
    return email ? STORAGE_KEY_PREFIX + '_' + email : STORAGE_KEY_PREFIX + '_public';
  }
  function loadData() {
    // בדיקה אם יש נתונים ב-LocalStorage (עדכונים אחרונים)
    const saved = localStorage.getItem('tashbetz_entries');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch (e) { console.error("Error loading local storage", e); }
    }

    // אם אין בזיכרון המקומי, ניגשים למערך הענק בסוף הקובץ
    // אנחנו משתמשים ב-window כדי למנוע את שגיאת ה-ReferenceError
    if (window.BUNDLED_ENTRIES) {
        return window.BUNDLED_ENTRIES;
    }
    
    // אם גם זה לא נמצא, אולי המשתנה נקרא tashbetz_entries.json במקום אחר?
    // נחזיר מערך ריק כברירת מחדל כדי שהאתר לא יקרוס
    return [];
}
  function switchTab(tabId) {
    // 1. הסרת מחלקת active מכל כפתורי הטאבים
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // 2. הסרת מחלקת active מכל התצוגות (views)
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });

    // 3. הוספת active לכפתור שנלחץ
    // אנחנו מחפשים כפתור שה-onclick שלו מכיל את ה-tabId שקיבלנו
    const activeBtn = document.querySelector(`.tab-btn[onclick*="${tabId}"]`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }

    // 4. הצגת התצוגה המתאימה (למשל view-search או view-add)
    const activeView = document.getElementById(`view-${tabId}`);
    if (activeView) {
        activeView.classList.add('active');
    }

    // לוגיקה נוספת לפי סוג הטאב
    if (tabId === 'search') {
        setTimeout(() => document.getElementById('searchInput')?.focus(), 100);
    }
}
  function saveData(data) {
    localStorage.setItem(getStorageKey(), JSON.stringify(data));
    updateStats();
    if (gAccessToken && isOwner && !isSyncing && gEntriesFileId) {
      clearTimeout(saveData._timer);
      saveData._timer = setTimeout(() => writeEntriesToDrive(data), 2000);
    }
  }

  // ──────────────────────────────────────────────
  // UI
  // ──────────────────────────────────────────────
  function updateStats() {
    const badge = document.getElementById('statsText');
    if (entries.length > 0) {
      badge.textContent = `${entries.length} הגדרות`;
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }
  }
function switchTab(tabId) {
    // הסרת מחלקת active מכל הכפתורים והתצוגות
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));

    // הוספת active לטאב הנבחר
    const selectedBtn = document.querySelector(`[onclick="switchTab('${tabId}')"]`);
    if (selectedBtn) selectedBtn.classList.add('active');

    const selectedView = document.getElementById(`view-${tabId}`);
    if (selectedView) selectedView.classList.add('active');
}
 function switchTab(tab) {
  // עדכון כפתורים: מחפש את הכפתור שה-onclick שלו מכיל את שם הטאב
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('onclick').includes(`'${tab}'`));
  });

  // הסרת active מכל התצוגות והוספה לתצוגה הנבחרת
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const targetView = document.getElementById(`view-${tab}`);
  if (targetView) targetView.classList.add('active');

  // לוגיקה ספציפית לחיפוש
  document.getElementById('searchWrap').style.display = tab === 'search' ? 'flex' : 'none';
  
  if (tab === 'search') { 
    entriesPage = 0; 
    renderCardsPaged(currentQuery || ""); // הוספת הגנה למקרה ש-currentQuery ריק
  }
  
  // טעינת רשימות לפי הצורך
  if (tab === 'delete') renderDeleteList();
  if (tab === 'feedback') renderFeedbackList();
  if (tab === 'approvals') renderApprovalsList();
  if (tab === 'similar') loadSimilar();
}

// שורת הקסם: מפעיל את הטאב הנכון מיד כשהסקריפט נטען
switchTab('search');
  // ──────────────────────────────────────────────
  // SEARCH
  // ──────────────────────────────────────────────
  document.getElementById('searchInput').addEventListener('input', function() {
    currentQuery = this.value.trim();
    document.getElementById('clearSearch').style.display = currentQuery ? 'block' : 'none';
    renderCardsPaged(currentQuery);
  });

  function onSearchFieldChange() {
    searchField = document.getElementById('searchField').value;
    const placeholders = { definition: 'חפש הגדרה...', solution: 'חפש פתרון...', explanation: 'חפש רמז...' };
    document.getElementById('searchInput').placeholder = placeholders[searchField];
    currentQuery = document.getElementById('searchInput').value.trim();
    entriesPage = 0;
    renderCardsPaged(currentQuery);
  }

  function clearSearch() {
    document.getElementById('searchInput').value = '';
    currentQuery = '';
    document.getElementById('clearSearch').style.display = 'none';
    entriesPage = 0;
    renderCardsPaged('');
    document.getElementById('searchInput').focus();
  }

  function normalize(str) {
    // הגנה: אם str הוא לא טקסט, אל תנסה להריץ replace אלא תחזיר טקסט ריק
    if (typeof str !== 'string' || !str) return '';

    return str
        .replace(/"/g, '')
        .replace(/'/g, '')
        .replace(/\s+/g, ' ')
        .replace(/[.,?!]/g, '')
        .trim();
}

  function highlightText(text, query) {
    if (!query) return escapeHtml(text);
    const escaped = escapeHtml(text);
    const escapedQ = escapeHtml(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return escaped.replace(new RegExp(escapedQ, 'gi'), m => `<mark>${m}</mark>`);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function setFilter(filter) {
    currentFilter = filter;
    document.querySelectorAll('.filter-btn[id^="filter"]').forEach(b => b.classList.remove('active'));
    document.getElementById(`filter-${filter}`).classList.add('active');
    renderCardsPaged(currentQuery);
  }

  function normalize() {
    const hasNoExplanation = entries.some(e => !e.explanation || !e.explanation.trim());
    const hasNoSolution = entries.some(e => !e.solution || !e.solution.trim());
    const btnExp = document.getElementById('filter-no-explanation');
    const btnSol = document.getElementById('filter-no-solution');
    if (btnExp) btnExp.style.display = hasNoExplanation ? 'inline-block' : 'none';
    if (btnSol) btnSol.style.display = hasNoSolution ? 'inline-block' : 'none';
    // If active filter no longer valid, reset to all
    if (currentFilter === 'no-explanation' && !hasNoExplanation) setFilter('all');
    if (currentFilter === 'no-solution' && !hasNoSolution) setFilter('all');

    // Show dupes tab only if duplicates exist
    const seen = {};
    let hasDupes = false;
    for (const e of entries) {
      const key = normalize(e.definition);
      if (seen[key]) { hasDupes = true; break; }
      seen[key] = true;
    }
    const tabDupes = document.getElementById('tab-dupes');
    if (tabDupes) tabDupes.style.display = hasDupes ? 'inline-block' : 'none';
  }

  function hebrewSort(a, b) {
    return a.definition.localeCompare(b.definition, 'he');
  }
function renderCardsPaged(data) {
    const container = document.getElementById('results-container');
    if (!container) return;

    // לוקחים רק את ה-1000 הראשונים לביצועים
    const chunk = data.slice(0, 1000);

    // ניקוי ובנייה מחדש בפעולה אחת
    container.innerHTML = chunk.map(item => {
        // בדיקה בטוחה של משתנה הניהול
        const canEdit = (typeof isOwner !== 'undefined' && isOwner);
        
        const def = item.definition || '';
        const sol = item.solution || '';
        
        return `
            <div class="card">
                <h3>${def}</h3>
                <p>${sol}</p>
                ${canEdit ? `<button class="edit-btn" onclick="editEntry('${item.id}')">עריכה</button>` : ''}
            </div>
        `;
    }).join('');
}
  function renderCardsPaged(query) {
    updateFilterButtons();
    const list = document.getElementById('cardsList');
    const empty = document.getElementById('emptyState');
    const info = document.getElementById('resultsInfo');
    const q = normalize(query);
    let filtered = q
      ? entries.filter(e => {
          if (searchField === 'solution') return normalize(e.solution || '').includes(q);
          if (searchField === 'explanation') return normalize(e.explanation || '').includes(q);
          return normalize(e.definition).includes(q);
        })
      : [...entries];
    if (currentFilter === 'no-explanation') {
      filtered = filtered.filter(e => !e.explanation || !e.explanation.trim());
    } else if (currentFilter === 'no-solution') {
      filtered = filtered.filter(e => !e.solution || !e.solution.trim());
    }
    if (sortAZ) {
      filtered = filtered.slice().sort(hebrewSort);
    }
    if (entries.length === 0) {
      list.innerHTML = '';
      empty.style.display = 'block';
      info.style.display = 'none';
      const emptyTitle = document.getElementById('emptyTitle');
      const emptyMsg = document.getElementById('emptyMsg');
      if (isOwner) {
        emptyTitle.textContent = 'אין עדיין הגדרות';
        emptyMsg.innerHTML = 'הוסף הגדרות דרך לשונית "הוסף"<br/>או ייבא קובץ טקסט דרך "ייבוא"';
      } else {
        emptyTitle.textContent = 'טוען הגדרות...';
        emptyMsg.textContent = '';
      }
      return;
    }
    empty.style.display = 'none';

    // הצגת טקסט "מוצגים X הגדרות מתוך: Y"
    const start = 0;
    const end = (entriesPage + 1) * ENTRIES_PAGE_SIZE;
    const pageFiltered = filtered.slice(start, end);
    const shownCount = pageFiltered.length;
    const totalFiltered = filtered.length;
    info.style.display = 'block';
    info.innerHTML = `מוצגים <span class="highlight">${shownCount}</span> הגדרות מתוך: <span class="highlight">${totalFiltered}</span>`;

    // הצגת כמות טעינה בפועל (אם צריך)
    const loadedInfo = document.getElementById('loadedInfo');
    if (loadedInfo) {
      if (shownCount < totalFiltered) {
        loadedInfo.style.display = 'inline';
        loadedInfo.innerHTML = `&nbsp;|&nbsp;נטענו <span class="highlight">${shownCount}</span> מתוך <span class="highlight">${totalFiltered}</span>`;
      } else {
        loadedInfo.style.display = 'none';
      }
    }
    if (pageFiltered.length === 0) {
      list.innerHTML = `<div class="empty-state"><div class="icon">🔍</div><h3>לא נמצאו תוצאות</h3><p>נסה מילה אחרת או שנה סינון</p></div>`;
      return;
    }
    list.innerHTML = pageFiltered.map((e, idx) => `
      <div class="card" style="animation-delay:${Math.min(idx * 0.03, 0.3)}s">
        <div class="card-header">
          <div class="card-definition">${searchField === 'definition' ? highlightText(e.definition, query) : escapeHtml(e.definition)}</div>
          <div class="card-meta">
            
            ${e.type ? `<span class="tag tag-type">${escapeHtml(e.type)}</span>` : ''}
          </div>
        </div>
        <div class="card-solution">◈ ${e.solution ? (searchField === 'solution' ? highlightText(e.solution, query) : escapeHtml(e.solution)) : '<span style="color:var(--danger);font-size:0.9rem;font-family:Rubik,sans-serif;font-weight:400">ללא תשובה</span>'}</div>
        
        ${e.explanation ? `<div class="card-divider"></div><div class="card-explanation">${searchField === 'explanation' ? highlightText(e.explanation, query) : escapeHtml(e.explanation)}</div>` : ''}        
        ${isOwner ? `
  <div class="card-actions">
    <button class="btn-icon" onclick="openEdit('${e.id}')">עריכה</button>
  </div>` : ''}
      </div>
    `).join('');

    if (end < filtered.length) {
      list.innerHTML += `<div style="text-align:center;margin:20px 0;"><button class="btn" onclick="loadMoreEntries()">טען עוד (${filtered.length - end} נוספים)</button></div>`;
    }
  }

  function loadMoreEntries() {
    entriesPage++;
    renderCardsPaged(currentQuery);
  }

  // ──────────────────────────────────────────────
  // ADD
  // ──────────────────────────────────────────────
  function addEntry() {
    let definition = document.getElementById('f-definition').value.trim();
    const solution = document.getElementById('f-solution').value.trim();
    let letters = document.getElementById('f-letters').value.trim();
    const type = document.getElementById('f-type').value.trim();
    const explanation = document.getElementById('f-explanation').value.trim();

    if (!definition) {
      showToast('נדרשת הגדרה', 'error');
      return;
    }

    // אם לא הוזן מספר אותיות — חלץ אוטומטית מהגדרה
    if (!letters) {
      const m = definition.match(/\((\d[\d,]*)\)/);
      if (m) letters = m[1];
    }

    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      definition, solution, letters, type, explanation,
      createdAt: Date.now()
    };

    // Clear fields
    document.getElementById('f-definition').value = '';
    document.getElementById('f-solution').value = '';
    document.getElementById('f-letters').value = '';
    document.getElementById('f-type').value = '';
    document.getElementById('f-explanation').value = '';

    if (!gAccessToken || isOwner) {
      // Owner or offline: add directly
      entries.unshift(entry);
      saveData(entries);
      showToast('✅ ההגדרה נוספה!', 'success');
      switchTab('search');
    } else {
      // Non-owner: open suggest form
      openSuggestForm();
    }
  }

  // ──────────────────────────────────────────────
  // PARSE ENTRY LINE
  // ──────────────────────────────────────────────
  function parseEntryLine(line) {
    line = line.trim();
    if (!line) return null;

    // Split by | separator
    const parts = line.split('|').map(p => p.trim());


    for (const part of parts) {
      if (part.startsWith('ההגדרה:') || part.startsWith('הגדרה:')) {
        let def = part.replace(/^(ה)?הגדרה:\s*/, '');
        // Extract letters (number in parens)
        const lettersMatch = def.match(/\((\d[\d,\s-]*)\)/);
        if (lettersMatch) letters = lettersMatch[1];
        // Extract type [...]
        const typeMatch = def.match(/\[([^\]]+)\]/);
        if (typeMatch) type = typeMatch[1];
        // Clean definition
        definition = def.replace(/\s*\(\d[\d,\s-]*\)\s*/g, '').replace(/\s*\[[^\]]+\]\s*/g, '').trim();
      } else if (part.startsWith('הפתרון:') || part.startsWith('פתרון:')) {
        solution = part.replace(/^(ה)?פתרון:\s*/, '').trim();
      } else if (part.startsWith('הסבר:') || part.startsWith('סבר:')) {
        explanation = part.replace(/^(ה)?סבר:\s*/, '').trim();
      }
    }

    // Fallback: if no pipes, try to parse as "הגדרה: X (N) [Y] הפתרון: Z הסבר: W"
    if (!solution && parts.length === 1) {
      const m = line.match(/^(?:ה?הגדרה:\s*)?(.+?)\s*(?:\((\d[\d,\s-]*)\))?\s*(?:\[([^\]]+)\])?\s*\|\s*(?:ה?פתרון:\s*)(.+?)(?:\s*\|\s*(?:ה?סבר:\s*)(.+))?$/);
      if (m) {
        definition = m[1].trim();
        letters = m[2] || '';
        type = m[3] || '';
        solution = m[4].trim();
        explanation = m[5] ? m[5].trim() : '';
      }
    }

    if (!definition) return null;

    return {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2),
      definition, solution, letters, type, explanation,
      createdAt: Date.now()
    };
  }

  // ──────────────────────────────────────────────
  // IMPORT FROM FILE
  // ──────────────────────────────────────────────
  function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      processImportText(text);
    };
    reader.readAsText(file, 'UTF-8');
  }

  function importFromPaste() {
    const text = document.getElementById('pasteArea').value;
    if (!text.trim()) { showToast('אין טקסט Heidi', 'error'); return; }
    processImportText(text);
    document.getElementById('pasteArea').value = '';
  }

  function normalize(str) {
    // אם זה לא טקסט (null/undefined), החזר מחרוזת ריקה במקום לקרוס
    if (typeof str !== 'string' || !str) return '';

    return str
        .replace(/"/g, '')
        .replace(/'/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

  function processImportText(text) {
    const lines = text.split('\n');
    let added = 0, updated = 0, skipped = 0, failed = 0;

    for (const line of lines) {
      if (!line.trim()) continue;
      const entry = parseEntryLine(line);
      if (!entry) { failed++; continue; }

      // Check for existing entry with same definition (normalized)
      const normNew = normalize(entry.definition);
      const existingIdx = entries.findIndex(e => normalize(e.definition) === normNew);

      if (existingIdx !== -1) {
        const existing = entries[existingIdx];
        let changed = false;
        let updatedEntry = { ...existing };

        // אם ההגדרה הקיימת ללא פתרון והחדשה יש לה — עדכן פתרון
        if (entry.solution && !existing.solution) {
          updatedEntry.solution = entry.solution;
          changed = true;
        }
        // אם ההגדרה הקיימת ללא הסבר והחדשה יש לה — עדכן הסבר
        if (entry.explanation && !existing.explanation) {
          updatedEntry.explanation = entry.explanation;
          changed = true;
        }
        // אם חסר מספר אותיות והחדש מכיל — עדכן
        if (entry.letters && !existing.letters) {
          updatedEntry.letters = entry.letters;
          changed = true;
        }
        // אם חסר סוג והחדש מכיל — עדכן
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

    saveData(entries);

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

  // Drag and drop
  const zone = document.getElementById('importZone');
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = ev => processImportText(ev.target.result);
      reader.readAsText(file, 'UTF-8');
    }
  });

  // ──────────────────────────────────────────────
  // EDIT
  // ──────────────────────────────────────────────
  function openEdit(id) {
    const e = entries.find(x => x.id === id);
    if (!e) return;
    document.getElementById('edit-id').value = id;
    document.getElementById('edit-definition').value = e.definition;
    document.getElementById('edit-letters').value = e.letters || '';
    document.getElementById('edit-type').value = e.type || '';
    document.getElementById('edit-solution').value = e.solution;
    document.getElementById('edit-explanation').value = e.explanation || '';
    document.getElementById('editModal').classList.add('open');
  }

  function saveEdit() {
    const id = document.getElementById('edit-id').value;
    const idx = entries.findIndex(x => x.id === id);
    if (idx === -1) return;

    const def = document.getElementById('edit-definition').value.trim();
    const sol = document.getElementById('edit-solution').value.trim();
    if (!def) { showToast('נדרשת הגדרה', 'error'); return; }

    entries[idx] = {
      ...entries[idx],
      definition: def,
      letters: document.getElementById('edit-letters').value.trim(),
      type: document.getElementById('edit-type').value.trim(),
      solution: sol,
      explanation: document.getElementById('edit-explanation').value.trim(),
    };

    saveData(entries);
    closeModal();
    renderCardsPaged(currentQuery);
    showToast('✅ ההגדרה עודכנה', 'success');
  }

  // ──────────────────────────────────────────────
  // DELETE
  // ──────────────────────────────────────────────
  function openDelete(id) {
    const e = entries.find(x => x.id === id);
    if (!e) return;
    document.getElementById('delete-id').value = id;
    document.getElementById('delete-preview').textContent = e.definition + ' → ' + e.solution;
    document.getElementById('deleteModal').classList.add('open');
  }

  function confirmDelete() {
    const id = document.getElementById('delete-id').value;
    entries = entries.filter(x => x.id !== id);
    saveData(entries);
    closeModal();
    renderCardsPaged(currentQuery);
    showToast('🗑️ ההגדרה נמחקה', 'success');
  }

  function closeModal() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
  }

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) closeModal();
    });
  });

  // ──────────────────────────────────────────────
  // TOAST
  // ──────────────────────────────────────────────
  
  function showToast(msg, type = '') {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = `toast ${type} show`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2500);
  }

  // ──────────────────────────────────────────────
  // EXPORT
  // ──────────────────────────────────────────────
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
    a.download = `תשובות_להגדרות_היגיון_${new Date().toLocaleDateString('he-IL').replace(/\//g,'-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`✅ יוצאו ${entries.length} הגדרות`, 'success');
  }

  // ──────────────────────────────────────────────
  // DUPLICATES
  // ──────────────────────────────────────────────
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

    if (groups.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding:30px 0;">
          <div class="icon">✅</div>
          <h3>אין כפילויות!</h3>
          <p>כל ${entries.length} ההגדרות ייחודיות</p>
        </div>`;
      return;
    }

    let html = `<div class="results-info" style="display:block;margin-bottom:14px;">
      נמצאו <span class="highlight">${groups.length}</span> קבוצות כפילויות
      <button class="btn-icon danger" style="margin-right:10px;font-size:0.8rem;" onclick="deleteAllDupes()">🗑️ מחק כפילויות אוטומטית</button>
    </div>`;

    for (const group of groups) {
      html += `<div class="card" style="border-color:var(--danger);margin-bottom:14px;">
        <div style="font-size:0.75rem;color:var(--danger);font-weight:700;margin-bottom:10px;">⚠️ ${group.length} כניסות זהות</div>`;
      group.forEach((e, idx) => {
        html += `
          <div style="background:var(--surface2);border-radius:10px;padding:12px;margin-bottom:8px;position:relative;">
            <div style="font-size:0.85rem;font-weight:600;margin-bottom:4px;">${escapeHtml(e.definition)}</div>
            <div style="font-size:0.9rem;color:var(--success);">◈ ${escapeHtml(e.solution)}</div>
            ${e.explanation ? `<div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px;">💡 ${escapeHtml(e.explanation)}</div>` : ''}
            <div style="margin-top:8px;display:flex;gap:6px;">
              ${idx > 0 ? `<button class="btn-icon danger" onclick="deleteDupe('${e.id}')" style="font-size:0.8rem;">🗑️ מחק עותק זה</button>` : `<span style="font-size:0.75rem;color:var(--text-muted);padding:4px 8px;">← ישמר</span>`}
            </div>
          </div>`;
      });
      html += `</div>`;
    }

    container.innerHTML = html;
  }

  // ──────────────────────────────────────────────
  // SIMILAR DEFINITIONS (admin)
  // ──────────────────────────────────────────────
  async function loadSimilar() {
    const container = document.getElementById('similarList');
    if (!container) return;

    container.innerHTML = '<div style="color:var(--text-muted);padding:20px;text-align:center;">⏳ טוען קבוצות...</div>';

    try {
      const groups = await apiGetJson('?action=getSimilar');

      if (!Array.isArray(groups) || groups.length === 0) {
        container.innerHTML = '<div class="empty-state" style="padding:30px 0;"><div class="icon">✅</div><h3>לא נמצאו קבוצות דומות</h3></div>';
        return;
      }

      container.innerHTML = '';

      groups.forEach((group, idx) => {
        const div = document.createElement('div');
        div.className = 'card';

        let html = `<h4 style="margin-bottom:10px;">קבוצה ${idx + 1} - ${group.length} הגדרות</h4><ol style="padding-right:18px;">`;
        group.forEach(g => {
          html += `<li data-id="${escapeHtml(g.id || '')}" style="margin-bottom:6px;">${escapeHtml(g.definition || '')} ${escapeHtml(g.letters || '')}</li>`;
        });
        html += '</ol>';

        const ids = group.map(g => g.id);
        const idsEncoded = encodeURIComponent(JSON.stringify(ids));
        html += `<button class="btn btn-primary" onclick="mergeGroup('${idsEncoded}')">מזג קבוצה</button>`;

        div.innerHTML = html;
        container.appendChild(div);
      });
    } catch (e) {
      console.error('loadSimilar failed:', e);
      container.innerHTML = '<div style="color:var(--danger);padding:20px;text-align:center;">שגיאה בטעינת קבוצות דומות</div>';
    }
  }

  async function mergeGroup(idsEncoded) {
    try {
      const ids = JSON.parse(decodeURIComponent(idsEncoded));
      const data = await apiGetJson('?action=merge&ids=' + encodeURIComponent(JSON.stringify(ids)));

      if (data && data.ok) {
        showToast('הקבוצה מוזגה בהצלחה!', 'success');
        loadSimilar();
      } else {
        showToast('שגיאה במיזוג', 'error');
      }
    } catch (e) {
      console.error('mergeGroup failed:', e);
      showToast('שגיאה במיזוג', 'error');
    }
  }

  function deleteDupe(id) {
    entries = entries.filter(e => e.id !== id);
    saveData(entries);
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
    saveData(entries);
    showToast(`✅ נמחקו ${removed} כפילויות`, 'success');
    checkDuplicates();
  }

  // ──────────────────────────────────────────────
  // GOOGLE DRIVE SYNC
  // ──────────────────────────────────────────────
  const GDRIVE_CLIENT_ID = '361524127527-b5cvvltaj5btoitfe07lcf7053hp7vhl.apps.googleusercontent.com';
  const GDRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email';
  const OWNER_EMAIL = '012ohad@gmail.com';
  const FOLDER_ID = '1poPxM9l92zhppX13f9gdzS14vz9ZSSPk';
  const ENTRIES_FILENAME = 'tashbetz_entries.json';
  const FORMS_URL = 'https://forms.gle/sGWX4LKuUzSFeSjd6';
  const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby55S-WhnCmk6sF95VwWa4h77moNa1TRhraw2gattzxZ8sqoLTa3ewXduHsqBvKQROB/exec';

  async function apiGetJson(query, timeoutMs = 12000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const sep = query.includes('?') ? '&' : '?';
      const url = APPS_SCRIPT_URL + query + `${sep}_t=${Date.now()}`;
      const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  function updateSyncBtn(state) {
    const btn = document.getElementById('syncBtn');
    const icon = document.getElementById('syncIcon');
    btn.classList.remove('syncing', 'connected');
    if (state === 'connected') { icon.textContent = '👑'; btn.classList.add('connected'); btn.title = 'מחובר כמנהל — לחץ לסנכרון'; }
    else if (state === 'syncing') { icon.textContent = '🔄'; btn.classList.add('syncing'); btn.title = 'מסנכרן...'; }
    else if (state === 'error') { icon.textContent = '⚠️'; btn.title = 'שגיאת סנכרון'; }
    else { icon.textContent = '☁️'; btn.title = 'התחבר כמנהל'; }
  }

  function handleSyncClick() {
    if (!gAccessToken) signInGoogle();
    else syncWithDrive();
  }

  function signInGoogle() {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: GDRIVE_CLIENT_ID,
      scope: GDRIVE_SCOPE,
      callback: async (resp) => {
        if (resp.error) { showToast('שגיאה בהתחברות', 'error'); return; }
        gAccessToken = resp.access_token;
        localStorage.setItem('g_access_token', gAccessToken);
        try {
          const info = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { 'Authorization': `Bearer ${gAccessToken}` }
          });
          const u = await info.json();
          gUserEmail = u.email;
          localStorage.setItem('g_user_email', gUserEmail);
        } catch(e) {}
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
        // טען נתונים מהקאש האישי (מפתח ספציפי לחשבון)
        const ownerKey = STORAGE_KEY_PREFIX + '_' + gUserEmail;
        try {
          const cached = JSON.parse(localStorage.getItem(ownerKey));
          if (cached && cached.length > 0) {
            entries = cached;
            renderCardsPaged('');
          }
        } catch(e) {}
        await syncWithDrive();
      }
    });
    client.requestAccessToken();
  }

  async function driveRequest(url, options = {}) {
    const res = await fetch(url, {
      ...options,
      headers: { 'Authorization': `Bearer ${gAccessToken}`, ...(options.headers || {}) }
    });
    if (res.status === 401) {
      gAccessToken = null;
      localStorage.removeItem('g_access_token');
      updateSyncBtn('disconnected');
      showToast('פג תוקף החיבור — התחבר שוב', 'error');
      return null;
    }
    return res;
  }

  async function findEntriesFile() {
    const res = await driveRequest(
      `https://www.googleapis.com/drive/v3/files?q=name='${ENTRIES_FILENAME}' and '${FOLDER_ID}' in parents and trashed=false&fields=files(id)`
    );
    if (!res) return null;
    const data = await res.json();
    return data.files && data.files.length > 0 ? data.files[0].id : null;
  }

  async function readEntriesFromDrive() {
    if (!gEntriesFileId) return null;
    const res = await driveRequest(`https://www.googleapis.com/drive/v3/files/${gEntriesFileId}?alt=media`);
    if (!res || !res.ok) return null;
    try { return await res.json(); } catch { return null; }
  }

  async function writeEntriesToDrive(data) {
    if (!gEntriesFileId) return false;
    const res = await driveRequest(
      `https://www.googleapis.com/upload/drive/v3/files/${gEntriesFileId}?uploadType=media`,
      { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }
    );
    return res && res.ok;
  }

  async function syncWithDrive() {
    console.log("מבצע סנכרון מול Apps Script...");
    try {
        const data = await apiGetJson('?action=getEntries');
        
        if (Array.isArray(data) && data.length > 0) {
            // מעדכנים את המשתנה הגלובלי של ההגדרות
            entries = data;
            saveDataLocal(entries);
            renderCardsPaged(currentQuery);
            
            console.log("הנתונים נטענו בהצלחה מהשרת");
        }
    } catch (e) {
        console.error("שגיאה בסנכרון:", e);
        showToast('טעינת נתונים מהשרת נכשלה', 'error');
    }
}
  function mergeEntries(local, remote) {
    const seen = {};
    const result = [];
    for (const e of [...local, ...remote]) {
      // אם אין מספר אותיות — חלץ מההגדרה
      if (!e.letters) {
        const m = e.definition.match(/\((\d[\d,]*)\)/);
        if (m) e.letters = m[1];
      }
      const key = normalize(e.definition);
      if (!seen[key]) { seen[key] = true; result.push(e); }
      else {
        const idx = result.findIndex(r => normalize(r.definition) === key);
        if (idx !== -1) {
          if (!result[idx].solution && e.solution) result[idx].solution = e.solution;
          if (!result[idx].explanation && e.explanation) result[idx].explanation = e.explanation;
          if (!result[idx].letters && e.letters) result[idx].letters = e.letters;
        }
      }
    }
    return result;
  }

  function saveDataLocal(data) {
    localStorage.setItem(getStorageKey(), JSON.stringify(data));
    updateStats();
  }

 function updateOwnerUI() {
    // כפתורי מנהל - מוצגים רק אם isOwner = true
    document.querySelectorAll('.owner-only').forEach(el => {
        el.style.display = isOwner ? 'inline-block' : 'none';
    });
    
    // כפתורי משתמש רגיל - מוצגים רק אם isOwner = false
    const suggestBtn = document.getElementById('suggest-btn');
    const feedbackBtn = document.getElementById('feedback-btn');
    
    if (suggestBtn) {
        suggestBtn.style.display = isOwner ? 'none' : 'inline-block';
    }
    if (feedbackBtn) {
        feedbackBtn.style.display = isOwner ? 'none' : 'inline-block';
    }
}
// ──────────────────────────────────────────────
// LOGOUT FUNCTION
// ──────────────────────────────────────────────
function logout() {
  gAccessToken = null;
  gUserEmail = null;
  isOwner = false;
  localStorage.removeItem('g_access_token');
  localStorage.removeItem('g_user_email');
  updateSyncBtn('disconnected');
  updateOwnerUI();
  showToast('התנתקת מהחשבון', 'success');
  
  // רענון הדף כדי להחזיר למצב אורח
  setTimeout(() => {
      location.reload();
  }, 500);
}

  // ──────────────────────────────────────────────
  // SUGGESTION MODAL (replaces Google Forms)
  // ──────────────────────────────────────────────
  function openSuggestionModal() {
    ['sug-definition','sug-letters','sug-solution','sug-explanation'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    document.getElementById('suggestionModal').classList.add('open');
    setTimeout(() => document.getElementById('sug-definition').focus(), 350);
  }

  function closeSuggestionModal() {
    document.getElementById('suggestionModal').classList.remove('open');
  }

  async function submitSuggestion() {
    const definition = document.getElementById('sug-definition').value.trim();
    const solution   = document.getElementById('sug-solution').value.trim();
    const letters    = document.getElementById('sug-letters').value.trim();
    const explanation= document.getElementById('sug-explanation').value.trim();
    if (!definition) { showToast('נא למלא את ההגדרה', 'error'); return; }
    closeSuggestionModal();
    showToast('⏳ שולח הצעה...', '');
    try {
      const url = APPS_SCRIPT_URL +
        '?action=submitSuggestion' +
        '&def=' + encodeURIComponent(definition) +
        '&sol=' + encodeURIComponent(solution) +
        '&letters=' + encodeURIComponent(letters) +
        '&exp=' + encodeURIComponent(explanation);
      const res = await fetch(url);
      const data = await res.json();
      if (data.ok) showToast('✅ ההצעה נשלחה, תודה!', 'success');
      else showToast('שגיאה בשליחה', 'error');
    } catch(e) {
      showToast('שגיאה בשליחה', 'error');
    }
  }

  document.getElementById('suggestionModal').addEventListener('click', function(e) {
    if (e.target === this) closeSuggestionModal();
  });

  // ──────────────────────────────────────────────
  // APPROVALS (admin)
  // ──────────────────────────────────────────────
  async function renderApprovalsList() {
    const list = document.getElementById('approvalsList');
    if (!list) return;
    list.innerHTML = '<div style="color:var(--text-muted);padding:20px;text-align:center;">⏳ טוען...</div>';
    try {
      const data = await apiGetJson('?action=getSuggestions');
      if (!Array.isArray(data) || data.length === 0) {
        list.innerHTML = '<div class="empty-state" style="padding:30px 0;"><div class="icon">📭</div><h3>אין הצעות ממתינות</h3></div>';
        // אפס את המונה בטאב ההצעות כשאין הצעות
        const tabApprovals = document.getElementById('tab-approvals');
        if (tabApprovals) {
          tabApprovals.textContent = '📬 הצעות';
        }
        return;
      }

      // שמירת ההצעות האחרונות בגלובל לשימוש בעת אישור/דחייה
      window.currentSuggestions = data;

      // עדכון מונה ההצעות בטאב
      const tabApprovals = document.getElementById('tab-approvals');
      if (tabApprovals) {
        tabApprovals.innerHTML = `📬 הצעות <span class="count-badge">${data.length}</span>`;
      }

      list.innerHTML = data.map((s, i) => `
        <div class="approval-card">
          <div class="approval-card-def">📝 ${escapeHtml(s.definition)}${s.letters ? ' (' + escapeHtml(s.letters) + ')' : ''}</div>
          ${s.solution ? `<div class="approval-card-sol">◈ ${escapeHtml(s.solution)}</div>` : ''}
          ${s.explanation ? `<div class="approval-card-exp">💡 ${escapeHtml(s.explanation)}</div>` : ''}
          <div style="font-size:0.72rem;color:var(--text-dim);margin-bottom:10px;">${new Date(s.createdAt).toLocaleString('he-IL')}</div>
          <div class="approval-actions">
            <button class="btn-approve" onclick="approveSuggestion(${i}, this, '${encodeURIComponent(s.suggestionKey || '')}')">✅ אשר והוסף</button>
            <button class="btn-reject" onclick="rejectSuggestion(${i}, this, '${encodeURIComponent(s.suggestionKey || '')}')">❌ דחה</button>
          </div>
        </div>
      `).join('');
    } catch(e) {
      list.innerHTML = '<div style="color:var(--danger);padding:20px;text-align:center;">שגיאה בטעינה</div>';
    }
  }

  function removeSuggestionFromUI(index) {
    const suggestions = window.currentSuggestions || [];
    if (!Array.isArray(suggestions) || index < 0 || index >= suggestions.length) return;
    suggestions.splice(index, 1);
    window.currentSuggestions = suggestions;

    const tabApprovals = document.getElementById('tab-approvals');
    if (tabApprovals) {
      if (suggestions.length > 0) {
        tabApprovals.innerHTML = `📬 הצעות <span class="count-badge">${suggestions.length}</span>`;
      } else {
        tabApprovals.textContent = '📬 הצעות';
      }
    }

    const list = document.getElementById('approvalsList');
    if (list) {
      if (suggestions.length === 0) {
        list.innerHTML = '<div class="empty-state" style="padding:30px 0;"><div class="icon">📭</div><h3>אין הצעות ממתינות</h3></div>';
      } else {
        // רינדור מחדש מהיר מקומי אחרי עדכון האינדקסים
        list.innerHTML = suggestions.map((s, i) => `
          <div class="approval-card">
            <div class="approval-card-def">📝 ${escapeHtml(s.definition)}${s.letters ? ' (' + escapeHtml(s.letters) + ')' : ''}</div>
            ${s.solution ? `<div class="approval-card-sol">◈ ${escapeHtml(s.solution)}</div>` : ''}
            ${s.explanation ? `<div class="approval-card-exp">💡 ${escapeHtml(s.explanation)}</div>` : ''}
            <div style="font-size:0.72rem;color:var(--text-dim);margin-bottom:10px;">${new Date(s.createdAt).toLocaleString('he-IL')}</div>
            <div class="approval-actions">
              <button class="btn-approve" onclick="approveSuggestion(${i}, this, '${encodeURIComponent(s.suggestionKey || '')}')">✅ אשר והוסף</button>
              <button class="btn-reject" onclick="rejectSuggestion(${i}, this, '${encodeURIComponent(s.suggestionKey || '')}')">❌ דחה</button>
            </div>
          </div>
        `).join('');
      }
    }
  }

  async function approveSuggestion(index, btn, keyEncoded) {
    // שליפת ההצעה הרלוונטית מהמערך הגלובלי שנשמר ב-renderApprovalsList
    const suggestions = window.currentSuggestions || [];
    const suggestion = suggestions[index];
    if (!suggestion) {
      showToast('שגיאה באישור ההצעה', 'error');
      return;
    }

    const definition = suggestion.definition || '';

    try {
        if (btn) btn.disabled = true;
        // הסרה מיידית מהממשק כדי למנוע תחושת איטיות
        removeSuggestionFromUI(index);

        // אישור מהיר לפי אינדקס (JSON רגיל) כדי למנוע המתנה איטית של no-cors
        const key = decodeURIComponent(keyEncoded || '');
        const data = await apiGetJson('?action=approveSuggestion&index=' + index + '&key=' + encodeURIComponent(key));
        if (!data || !data.ok) throw new Error('approve failed');

        showToast('ההגדרה אושרה ונוספה למאגר!', 'success');
        // רענון מאגר ההגדרות ברקע
        setTimeout(() => syncWithDrive(), 400);
        
    } catch (error) {
        console.error('Error approving suggestion:', error);
        showToast(`שגיאה בביצוע האישור: ${definition}`, 'error');
        // אם היתה שגיאה, נרענן מהרשת כדי לשחזר מצב אמיתי
        renderApprovalsList();
    }
}
window.logout = function() {
    console.log("מתבצע התנתקות...");

    // 1. ניקוי נתונים מה-LocalStorage (אם שמרת שם פרטי משתמש)
    localStorage.removeItem('user_data');
    localStorage.removeItem('is_admin');

    // 2. איפוס משתנים גלובליים בקוד
    window.currentUser = null;
    window.isAdmin = false;

    // 3. עדכון ה-UI (הסתרת כפתורי ניהול, שינוי כפתור כניסה/יציאה)
    if (typeof updateOwnerUI === 'function') {
        updateOwnerUI(null);
    }

    // 4. התנתקות מ-Google (אם מוגדר)
    if (window.google && google.accounts.id) {
        google.accounts.id.disableAutoSelect();
    }

    // 5. העברה לטאב הראשי ורענון קל
    if (typeof switchTab === 'function') {
        switchTab('search');
    }
    
    alert("התנתקת בהצלחה");
    location.reload(); // רענון הדף כדי להחזיר אותו למצב נקי
};
  async function rejectSuggestion(index, btn, keyEncoded) {
    try {
      if (btn) btn.disabled = true;
      const key = decodeURIComponent(keyEncoded || '');
      const data = await apiGetJson('?action=rejectSuggestion&index=' + index + '&key=' + encodeURIComponent(key));
      if (data.ok) { 
        removeSuggestionFromUI(index);
        showToast('נדחתה', 'success');
      }
      else showToast('שגיאה', 'error');
    } catch(e) { showToast('שגיאה', 'error'); }
  }

  if (gAccessToken && gUserEmail === OWNER_EMAIL) {
    isOwner = true;
    updateSyncBtn('connected');
    setTimeout(() => { syncWithDrive(); updateOwnerUI(); }, 1500);
    setInterval(() => syncWithDrive(), 5 * 60 * 1000);
  }

    // ──────────────────────────────────────────────
  // DELETE VIEW
  // ──────────────────────────────────────────────

  function renderDeleteList() {
    const query = (document.getElementById('deleteSearchInput')?.value || '').trim().toLowerCase();
    const list = document.getElementById('deleteList');
    const footer = document.getElementById('deleteFooter');

    const filtered = query
      ? entries.filter(e => normalize(e.definition).includes(query))
      : entries;

    if (filtered.length === 0) {
      list.innerHTML = `<div class="empty-state" style="padding:30px 0;"><div class="icon">🔍</div><h3>לא נמצאו הגדרות</h3></div>`;
      footer.style.display = 'none';
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
      el.classList.remove('selected');
      el.querySelector('input').checked = false;
    } else {
      selectedForDelete.add(id);
      el.classList.add('selected');
      el.querySelector('input').checked = true;
    }
    updateDeleteFooter();
  }

  function updateDeleteFooter() {
    const footer = document.getElementById('deleteFooter');
    const count = document.getElementById('deleteCount');
    if (selectedForDelete.size > 0) {
      footer.style.display = 'block';
      count.textContent = selectedForDelete.size;
    } else {
      footer.style.display = 'none';
    }
  }

  function selectAllDelete() {
    const query = (document.getElementById('deleteSearchInput')?.value || '').trim().toLowerCase();
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
    saveData(entries);
    renderDeleteList();
    showToast(`🗑️ נמחקו ${count} הגדרות`, 'success');
  }

  // ──────────────────────────────────────────────
  // FEEDBACK MODAL
  // ──────────────────────────────────────────────

  function openFeedbackModal() {
    document.getElementById('feedback-text').value = '';
    selectFeedbackType('bug');
    document.getElementById('feedbackModal').classList.add('open');
    setTimeout(() => document.getElementById('feedback-text').focus(), 350);
  }

  function closeFeedbackModal() {
    document.getElementById('feedbackModal').classList.remove('open');
  }

  function selectFeedbackType(type) {
    feedbackType = type;
    document.getElementById('ftype-bug').classList.toggle('selected', type === 'bug');
    document.getElementById('ftype-improve').classList.toggle('selected', type === 'improve');
  }

  // שליחת פידבק ל-Apps Script
  function submitFeedback() {
    const text = document.getElementById('feedback-text').value.trim();
    if (!text) { showToast('נא לכתוב תיאור', 'error'); return; }
    const type = feedbackType;
    closeFeedbackModal();
    showToast('שולח פידבק...', '');
    apiGetJson('?action=submitFeedback&type=' + encodeURIComponent(type) + '&text=' + encodeURIComponent(text))
      .then(data => {
        if (data.ok) showToast('✅ הפידבק התקבל, תודה!', 'success');
        else showToast('שגיאה בשליחת הפידבק', 'error');
      })
      .catch(() => showToast('שגיאה בשליחת הפידבק', 'error'));
  }

  document.getElementById('feedbackModal').addEventListener('click', function(e) {
    if (e.target === this) closeFeedbackModal();
  });

  // טעינה ציבורית מ-Apps Script למשתמשים אנונימיים
  async function loadPublicEntries() {
    // אם יש כבר נתונים בזיכרון (מ-localStorage) — הצג מיד, רענן ברקע בשקט
    if (entries.length > 0) {
      renderCardsPaged(currentQuery);
      // ריענון שקט ברקע — לא מציג toast, לא מפריע למשתמש
      apiGetJson('?action=getEntries')
        .then(data => {
          if (Array.isArray(data) && data.length > 0) {
            entries = data;
            saveDataLocal(entries);
            renderCardsPaged(currentQuery);
          }
        })
        .catch(() => {});
      return;
    }
    // טעינה ראשונה — אין נתונים בכלל
    try {
      const data = await apiGetJson('?action=getEntries');
      if (Array.isArray(data) && data.length > 0) {
        entries = data;
        saveDataLocal(entries);
        renderCardsPaged('');
        showToast('✅ נטענו ' + entries.length + ' הגדרות', 'success');
      }
    } catch(e) {
      console.warn('Public load failed:', e);
    }
  }

  if (!isOwner) loadPublicEntries();

  // רינדור ראשוני מיידי גם לפני טעינת רשת
  updateStats();
  renderCardsPaged(currentQuery);

  // ──────────────────────────────────────────────
  // FEEDBACK ADMIN
  // ──────────────────────────────────────────────
  async function renderFeedbackList() {
    const bugsEl = document.getElementById('feedbackListBugs');
    const improvEl = document.getElementById('feedbackListImprovements');
    const suggestTabLink = document.getElementById('tab-approvals');
    
    const empty = '<div style="color:var(--text-dim);font-size:0.85rem;text-align:center;padding:16px;">אין פריטים</div>';
    
    if (!bugsEl || !improvEl) return;

    try {
      const data = await apiGetJson('?action=getFeedback');
      
      const bugs = [];
      const improvements = [];
      data.forEach((item, idx) => {
        const enriched = { ...item, _idx: idx };
        if (item.type === 'improvement') improvements.push(enriched);
        else bugs.push(enriched);
      });

      // עדכון ה-Badge בטאב הצעות
      if (suggestTabLink) {
        suggestTabLink.innerHTML = `📬 הצעות <span class="count-badge">${improvements.length}</span>`;
      }

      const renderCard = (item) => `
        <div class="card" style="margin-bottom:8px; padding:12px;">
          <div style="font-size:0.85rem;margin-bottom:8px;">${item.text}</div>
          <div style="display:flex; gap:8px; justify-content: flex-end;">
            ${item.type === 'improvement' ? 
              `<button class="btn btn-secondary" style="padding:4px 8px; font-size:0.75rem;" onclick="approveFeedbackItem(${item._idx})">אישור</button>` : ''
            }
            <button class="btn" style="padding:4px 8px; font-size:0.75rem; background:rgba(244,63,94,0.1); color:var(--danger);" onclick="deleteFeedbackItem(${item._idx})">מחיקה</button>
          </div>
        </div>
      `;

      bugsEl.innerHTML = bugs.length ? bugs.map(item => renderCard(item)).join('') : empty;
      improvEl.innerHTML = improvements.length ? improvements.map(item => renderCard(item)).join('') : empty;
      
    } catch(e) {
      const err = '<div style="color:var(--danger);font-size:0.85rem;text-align:center;padding:16px;">שגיאה בטעינה</div>';
      bugsEl.innerHTML = err;
      improvEl.innerHTML = err;
    }
  }

  async function deleteFeedbackItem(index) {
    if (!confirm('למחוק את הפריט?')) return;
    try {
      const data = await apiGetJson('?action=deleteFeedback&index=' + index);
      if (data.ok) { 
        showToast('נמחק בהצלחה', 'success'); 
        renderFeedbackList(); 
      }
    } catch(e) { 
      showToast('שגיאה במחיקה', 'error'); 
    }
  }

  async function approveFeedbackItem(index) {
    try {
      const data = await apiGetJson('?action=approveFeedback&index=' + index);
      if (data && data.ok) {
        renderFeedbackList();
        setTimeout(() => syncWithDrive(), 300);
        showToast('ההצעה אושרה ונוספה למאגר', 'success');
      } else {
        showToast('שגיאה בתהליך האישור', 'error');
      }
    } catch(e) {
      console.error(e);
      showToast('שגיאה בתהליך האישור', 'error');
    }
  }
  function downloadUpdatedHTML() {
  const html = document.documentElement.outerHTML;
  const blob = new Blob([html], {type: 'text/html'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'תשובות_להגדרות_היגיון_מעודכן.html';
  a.click();
}
  function exportUpdatedHTML() {
    const htmlContent = document.documentElement.outerHTML;
    const entriesJson = JSON.stringify(entries, null, 0);
    const updated = htmlContent.replace(
      /const BUNDLED_ENTRIES = \[.*?\];/s,
      'const BUNDLED_ENTRIES = ' + entriesJson + ';'
    );
    const blob = new Blob([updated], { type: 'text/html;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'updated_riddles.html';
    a.click();
  }
  switchTab('search');

  // Hide splash after short delay (entries already loaded from BUNDLED)
  setTimeout(() => {
    const splash = document.getElementById('splash');
    if (splash) {
      splash.classList.add('hide');
      setTimeout(() => splash.remove(), 500);
    }
  }, 800);

  if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => console.log('SW error:', err));
  });
}
    // טעינת הגדרות מקובץ JSON חיצוני
    async function loadEntriesFromFile() {
        try {
            const response = await fetch('entries.json');
            if (!response.ok) throw new Error('לא ניתן לטעון את קובץ ההגדרות');
            const data = await response.json();
            window.BUNDLED_ENTRIES = data;
            console.log(`נטענו ${data.length} הגדרות מ-entries.json`);
            if (typeof renderCardsPaged === 'function') {
                renderCardsPaged('');
            }
            if (typeof updateStats === 'function') {
                updateStats();
            }
            return data;
        } catch (error) {
            console.error('שגיאה בטעינת הגדרות:', error);
            document.getElementById('cardsList').innerHTML = `
                <div class="empty-state">
                    <div class="icon">⚠️</div>
                    <h3>שגיאה בטעינת הגדרות</h3>
                    <p>לא ניתן לטעון את קובץ ההגדרות. ודא שהקובץ entries.json נמצא בתיקייה.</p>
                </div>`;
            return [];
        }
    }
    
    // החלפת פונקציית loadData
    window.loadData = function() {
        if (window.BUNDLED_ENTRIES && window.BUNDLED_ENTRIES.length) {
            return window.BUNDLED_ENTRIES;
        }
        return [];
    };
    
    // אתחול המערכת
    document.addEventListener('DOMContentLoaded', function() {
        loadEntriesFromFile();
    });
  }
// ==============================================
// טעינת הגדרות מקובץ JSON - הפונקציה החשובה!
// ==============================================
// ==============================================
// טעינת הגדרות מקובץ JSON - פונקציה ראשית
// ==============================================
async function loadEntriesFromJSON() {
    try {
        const response = await fetch('entries.json');
        if (!response.ok) {
            throw new Error('לא ניתן לטעון את קובץ ההגדרות');
        }
        const data = await response.json();
        
        // עדכון המערכים הגלובליים
        window.BUNDLED_ENTRIES = data;
        window.allEntries = data;
        window.entries = data;
        
        // עדכון ה-LocalStorage עם הנתונים החדשים
        localStorage.setItem('tashbetz_entries', JSON.stringify(data));
        
        console.log(`✅ נטענו ${data.length} הגדרות מ-entries.json`);
        
        // עדכון הסטטיסטיקה
        const statsBadge = document.getElementById('statsText');
        if (statsBadge) {
            statsBadge.textContent = data.length + ' הגדרות';
        }
        
        // הסתרת מסך הספלאש
        const splash = document.getElementById('splash');
        if (splash) {
            splash.classList.add('hide');
            setTimeout(() => splash.remove(), 500);
        }
        
        // רינדור הכרטיסים
        if (typeof renderCardsPaged === 'function') {
            renderCardsPaged('');
        }
        
        return data;
    } catch (error) {
        console.error('❌ שגיאה בטעינת הגדרות:', error);
        
        // ניסיון לטעון מ-LocalStorage כגיבוי
        const savedData = localStorage.getItem('tashbetz_entries');
        if (savedData) {
            const parsed = JSON.parse(savedData);
            window.entries = parsed;
            console.log(`⚠️ נטענו ${parsed.length} הגדרות מ-LocalStorage (גיבוי)`);
            if (typeof renderCardsPaged === 'function') {
                renderCardsPaged('');
            }
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

// הפעלה אוטומטית כשהדף נטען
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadEntriesFromJSON);
} else {
    loadEntriesFromJSON();
}

/* כפתורי משתמש - מוצגים כברירת מחדל */
#suggest-btn, #feedback-btn {
    display: inline-block !important;
}
// הפעלת עדכון ממשק המשתמש
if (typeof updateOwnerUI === 'function') {
    updateOwnerUI();
}
