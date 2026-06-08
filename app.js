/* =====================
   DayFlow v2 — app.js
   ===================== */

// ============== STATE ==============
let tasks = JSON.parse(localStorage.getItem('dayflow-tasks') || '[]');
let projects = JSON.parse(localStorage.getItem('dayflow-projects') || '[]');
let completionHistory = JSON.parse(localStorage.getItem('dayflow-history') || '{}');

let filter = 'all';
let selectedTag = 'work';
let selectedPriority = 'low';
let dragSrc = null;
let currentView = 'tasks';
let currentProjectFilter = null; // null = all
let editingTaskId = null; // for modal
let selectedProjectColor = '#e85d04';

// ============== INIT ==============
function init() {
  loadPreferences();
  setDate();
  renderProjects();
  renderTasks();
  renderProjectSelect();
  requestNotificationPermission();
  scheduleNotificationCheck();
  // Record today as active (streak tracking)
  recordTodayActivity();
}

// ============== PREFERENCES ==============
function loadPreferences() {
  const prefs = JSON.parse(localStorage.getItem('dayflow-prefs') || '{}');
  if (prefs.dark) {
    document.body.setAttribute('data-theme', 'dark');
    document.getElementById('theme-icon').textContent = '☀️';
  }
  if (prefs.color) {
    document.body.setAttribute('data-color', prefs.color);
    document.querySelectorAll('.cdot').forEach(d => {
      d.classList.toggle('active', d.classList.contains(prefs.color));
    });
  }
}
function savePreferences() {
  const prefs = {
    dark: document.body.getAttribute('data-theme') === 'dark',
    color: document.body.getAttribute('data-color') || 'orange'
  };
  localStorage.setItem('dayflow-prefs', JSON.stringify(prefs));
}

function toggleDarkMode() {
  const isDark = document.body.getAttribute('data-theme') === 'dark';
  document.body.setAttribute('data-theme', isDark ? 'light' : 'dark');
  document.getElementById('theme-icon').textContent = isDark ? '🌙' : '☀️';
  savePreferences();
}

function setColorTheme(color) {
  document.body.setAttribute('data-color', color);
  document.querySelectorAll('.cdot').forEach(d => d.classList.remove('active'));
  const btn = document.querySelector(`.cdot.${color}`);
  if (btn) btn.classList.add('active');
  savePreferences();
}

// ============== DATE ==============
function setDate() {
  const now = new Date();
  const opts = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
  const str = now.toLocaleDateString('en-US', opts);
  const els = ['header-date', 'sidebar-date', 'dash-date'];
  els.forEach(id => { const el = document.getElementById(id); if (el) el.textContent = str; });
}

// ============== SIDEBAR ==============
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const mainWrap = document.querySelector('.main-wrap');
  const toggleBtn = document.getElementById('sidebar-toggle');
  const isCollapsed = sidebar.classList.contains('collapsed') || sidebar.classList.contains('open') === false;

  // Mobile
  if (window.innerWidth <= 540) {
    sidebar.classList.toggle('open');
    return;
  }
  // Desktop
  sidebar.classList.toggle('collapsed');
  mainWrap.classList.toggle('expanded');
  const btnLeft = sidebar.classList.contains('collapsed') ? '16px' : '252px';
  toggleBtn.style.left = btnLeft;
}

// ============== VIEW SWITCHING ==============
function switchView(view, btn) {
  currentView = view;
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('view-tasks').classList.toggle('hidden', view !== 'tasks');
  document.getElementById('view-dashboard').classList.toggle('hidden', view !== 'dashboard');
  if (view === 'dashboard') renderDashboard();
}

// ============== PROJECTS ==============
function renderProjects() {
  const list = document.getElementById('projects-list');
  list.innerHTML = '';

  // "All" option
  const allBtn = document.createElement('button');
  allBtn.className = 'project-nav-item' + (currentProjectFilter === null ? ' active' : '');
  allBtn.innerHTML = `<span class="project-dot" style="background:var(--muted)"></span><span class="project-nav-name">All Tasks</span><span class="project-count">${tasks.length}</span>`;
  allBtn.onclick = () => { currentProjectFilter = null; renderProjects(); renderTasks(); updateViewTitle(); };
  list.appendChild(allBtn);

  projects.forEach(p => {
    const count = tasks.filter(t => t.projectId === p.id).length;
    const btn = document.createElement('button');
    btn.className = 'project-nav-item' + (currentProjectFilter === p.id ? ' active' : '');
    btn.innerHTML = `
      <span class="project-dot" style="background:${p.color}"></span>
      <span class="project-nav-name">${escHtml(p.name)}</span>
      <span class="project-count">${count}</span>
    `;
    btn.onclick = () => { currentProjectFilter = p.id; renderProjects(); renderTasks(); updateViewTitle(); };
    list.appendChild(btn);
  });
}

function updateViewTitle() {
  const el = document.getElementById('view-title');
  if (currentProjectFilter === null) {
    el.textContent = 'All Tasks';
  } else {
    const p = projects.find(p => p.id === currentProjectFilter);
    el.textContent = p ? p.name : 'Tasks';
  }
}

function renderProjectSelect() {
  const sel = document.getElementById('task-project-select');
  sel.innerHTML = '<option value="">No Project</option>';
  projects.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    sel.appendChild(opt);
  });
}

function openProjectModal() {
  document.getElementById('project-name-input').value = '';
  selectedProjectColor = '#e85d04';
  document.querySelectorAll('.cp-dot').forEach(d => d.classList.remove('active'));
  document.querySelector('.cp-dot').classList.add('active');
  document.getElementById('project-modal-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('project-name-input').focus(), 100);
}

function closeProjectModal(e) {
  if (!e || e.target.id === 'project-modal-overlay' || e.currentTarget.classList.contains('modal-close')) {
    document.getElementById('project-modal-overlay').classList.add('hidden');
  }
}

function selectProjectColor(btn) {
  document.querySelectorAll('.cp-dot').forEach(d => d.classList.remove('active'));
  btn.classList.add('active');
  selectedProjectColor = btn.dataset.color;
}

function saveProject() {
  const name = document.getElementById('project-name-input').value.trim();
  if (!name) { showToast('Please enter a project name'); return; }
  const project = { id: Date.now(), name, color: selectedProjectColor };
  projects.push(project);
  localStorage.setItem('dayflow-projects', JSON.stringify(projects));
  closeProjectModal();
  renderProjects();
  renderProjectSelect();
  showToast(`📁 Project "${name}" created!`);
}

// ============== TAG / PRIORITY ==============
function toggleTag(btn) {
  document.querySelectorAll('.tag-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  selectedTag = btn.dataset.tag;
}

function setPriority(btn) {
  document.querySelectorAll('.prio-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  selectedPriority = btn.dataset.p;
}

// ============== ADD TASK ==============
function addTask() {
  const input = document.getElementById('task-input');
  const text = input.value.trim();
  if (!text) {
    input.style.borderColor = 'var(--red)';
    input.style.boxShadow = '0 0 0 3px rgba(193,18,31,0.1)';
    setTimeout(() => { input.style.borderColor = ''; input.style.boxShadow = ''; }, 900);
    input.focus();
    return;
  }
  const dueVal = document.getElementById('due-input').value;
  const projectId = document.getElementById('task-project-select').value || null;

  const task = {
    id: Date.now(),
    text,
    tag: selectedTag,
    priority: selectedPriority,
    done: false,
    created: new Date().toISOString(),
    due: dueVal ? new Date(dueVal).toISOString() : null,
    projectId: projectId ? parseInt(projectId) : null,
    notes: '',
    subtasks: [],
    link: '',
    completedAt: null
  };

  tasks.unshift(task);
  saveTasks();
  renderTasks();
  renderProjects();
  input.value = '';
  document.getElementById('due-input').value = '';
  input.focus();
  showToast('✓ Task added!');
  scheduleNotificationForTask(task);
}

// ============== TOGGLE DONE ==============
function toggleDone(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  task.done = !task.done;
  task.completedAt = task.done ? new Date().toISOString() : null;
  if (task.done) recordCompletion();
  saveTasks();
  renderTasks();
  renderProjects();
  if (task.done) {
    showToast('🎉 Task completed!');
    if (tasks.length > 0 && tasks.every(t => t.done)) {
      setTimeout(() => showToast('🏆 All tasks done! Amazing!'), 900);
    }
  }
}

// ============== DELETE TASK ==============
function deleteTask(id) {
  const el = document.getElementById('task-' + id);
  if (el) {
    el.classList.add('removing');
    setTimeout(() => {
      tasks = tasks.filter(t => t.id !== id);
      saveTasks();
      renderTasks();
      renderProjects();
    }, 360);
  }
}

// ============== EDIT TASK ==============
function startEdit(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  const textEl = document.querySelector(`#task-${id} .task-text`);
  const oldText = task.text;
  const inp = document.createElement('input');
  inp.className = 'task-edit-input';
  inp.value = task.text;
  textEl.replaceWith(inp);
  inp.focus(); inp.select();
  function save() {
    const val = inp.value.trim();
    task.text = val || oldText;
    saveTasks(); renderTasks();
  }
  inp.addEventListener('blur', save);
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') save();
    if (e.key === 'Escape') { task.text = oldText; renderTasks(); }
  });
}

// ============== TASK DETAIL MODAL ==============
function openTaskModal(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  editingTaskId = id;
  document.getElementById('modal-task-title').textContent = task.text.length > 50 ? task.text.slice(0, 50) + '…' : task.text;
  document.getElementById('modal-notes').value = task.notes || '';
  document.getElementById('modal-link').value = task.link || '';
  renderSubtasks(task);
  document.getElementById('task-modal-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('modal-notes').focus(), 100);
}

function closeTaskModal(e) {
  if (e && e.target.id !== 'task-modal-overlay') return;
  closeTaskModalDirect();
}
function closeTaskModalDirect() {
  document.getElementById('task-modal-overlay').classList.add('hidden');
  editingTaskId = null;
}

function saveTaskDetails() {
  const task = tasks.find(t => t.id === editingTaskId);
  if (!task) return;
  task.notes = document.getElementById('modal-notes').value;
  task.link = document.getElementById('modal-link').value;
  saveTasks();
  renderTasks();
  closeTaskModalDirect();
  showToast('✓ Details saved!');
}

// ============== SUBTASKS ==============
function renderSubtasks(task) {
  const list = document.getElementById('subtasks-list');
  list.innerHTML = '';
  const subs = task.subtasks || [];
  subs.forEach((sub, i) => {
    const div = document.createElement('div');
    div.className = 'subtask-item';
    div.innerHTML = `
      <button class="subtask-check ${sub.done ? 'checked' : ''}" onclick="toggleSubtask(${i})"></button>
      <span class="subtask-text ${sub.done ? 'done' : ''}">${escHtml(sub.text)}</span>
      <button class="subtask-del" onclick="deleteSubtask(${i})">✕</button>
    `;
    list.appendChild(div);
  });

  // Progress
  const wrap = document.getElementById('subtask-progress-wrap');
  if (subs.length > 0) {
    wrap.style.display = 'flex';
    const done = subs.filter(s => s.done).length;
    const pct = Math.round(done / subs.length * 100);
    document.getElementById('subtask-progress-fill').style.width = pct + '%';
    document.getElementById('subtask-progress-txt').textContent = `${done}/${subs.length} (${pct}%)`;
  } else {
    wrap.style.display = 'none';
  }
}

function addSubtask() {
  const inp = document.getElementById('subtask-input');
  const text = inp.value.trim();
  if (!text) return;
  const task = tasks.find(t => t.id === editingTaskId);
  if (!task) return;
  if (!task.subtasks) task.subtasks = [];
  task.subtasks.push({ text, done: false });
  inp.value = '';
  saveTasks();
  renderSubtasks(task);
  renderTasks();
}

function toggleSubtask(index) {
  const task = tasks.find(t => t.id === editingTaskId);
  if (!task || !task.subtasks[index]) return;
  task.subtasks[index].done = !task.subtasks[index].done;
  saveTasks();
  renderSubtasks(task);
  renderTasks();
}

function deleteSubtask(index) {
  const task = tasks.find(t => t.id === editingTaskId);
  if (!task) return;
  task.subtasks.splice(index, 1);
  saveTasks();
  renderSubtasks(task);
  renderTasks();
}

// ============== FILTER / SEARCH ==============
function setFilter(btn) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  filter = btn.dataset.filter;
  renderTasks();
}

function clearCompleted() {
  const count = tasks.filter(t => t.done).length;
  if (!count) { showToast('No completed tasks to clear'); return; }
  tasks = tasks.filter(t => !t.done);
  saveTasks(); renderTasks(); renderProjects();
  showToast(`🗑 Cleared ${count} completed task${count > 1 ? 's' : ''}`);
}

// ============== DUE DATE HELPERS ==============
function getDueStatus(task) {
  if (!task.due || task.done) return null;
  const now = new Date();
  const due = new Date(task.due);
  const diffMs = due - now;
  if (diffMs < 0) return 'overdue';
  if (diffMs < 24 * 60 * 60 * 1000) return 'soon'; // within 24h
  return 'ok';
}

function formatDue(task) {
  if (!task.due) return '';
  const due = new Date(task.due);
  const status = getDueStatus(task);
  const str = due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' +
               due.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  if (status === 'overdue') return `<span class="task-due overdue-label">⚠ Overdue · ${str}</span>`;
  if (status === 'soon') return `<span class="task-due due-soon">⏰ ${str}</span>`;
  return `<span class="task-due due-ok">📅 ${str}</span>`;
}

// ============== RENDER TASKS ==============
function renderTasks() {
  const container = document.getElementById('tasks-container');
  const search = document.getElementById('search').value.toLowerCase();

  let filtered = tasks.filter(t => {
    if (currentProjectFilter !== null && t.projectId !== currentProjectFilter) return false;
    if (filter === 'active') return !t.done;
    if (filter === 'done') return t.done;
    if (filter === 'overdue') return getDueStatus(t) === 'overdue';
    return true;
  }).filter(t => t.text.toLowerCase().includes(search));

  const prioOrder = { high: 0, med: 1, low: 2 };
  filtered.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    // Overdue first
    const aOver = getDueStatus(a) === 'overdue' ? 0 : 1;
    const bOver = getDueStatus(b) === 'overdue' ? 0 : 1;
    if (aOver !== bOver) return aOver - bOver;
    return prioOrder[a.priority] - prioOrder[b.priority];
  });

  // Stats
  const total = (currentProjectFilter !== null ? tasks.filter(t => t.projectId === currentProjectFilter) : tasks).length;
  const done = (currentProjectFilter !== null ? tasks.filter(t => t.projectId === currentProjectFilter) : tasks).filter(t => t.done).length;
  document.getElementById('stat-done').textContent = done;
  document.getElementById('stat-total').textContent = total;

  const pct = total > 0 ? Math.round(done / total * 100) : 0;
  document.getElementById('progress-fill').style.width = pct + '%';
  document.getElementById('progress-pct').textContent = pct + '%';
  document.getElementById('progress-text').textContent =
    total === 0 ? 'No tasks yet' :
    done === total ? '🎉 All done!' :
    `${done} of ${total} completed`;

  const labels = { all: 'All tasks', active: 'Active tasks', done: 'Completed', overdue: 'Overdue' };
  document.getElementById('filter-label').innerHTML =
    `${labels[filter]} <span>(${filtered.length})</span>`;

  if (filtered.length === 0) {
    const msgs = {
      all: { icon: '📝', title: 'No tasks yet', sub: 'Add your first task above!' },
      active: { icon: '✅', title: 'All done!', sub: 'Enjoy your free time!' },
      done: { icon: '🎯', title: 'No completed tasks', sub: 'Complete some tasks first!' },
      overdue: { icon: '🎉', title: 'No overdue tasks!', sub: 'You\'re on top of everything!' }
    };
    const m = msgs[filter] || msgs.all;
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">${m.icon}</div><div class="empty-title">${m.title}</div><div class="empty-sub">${m.sub}</div></div>`;
    return;
  }

  container.innerHTML = '';
  filtered.forEach((task, idx) => {
    const el = createTaskEl(task, idx);
    container.appendChild(el);
  });
}

function createTaskEl(task, idx) {
  const tagLabels = { work: '💼 Work', personal: '👤 Personal', health: '💪 Health', urgent: '🔥 Urgent' };
  const dueStatus = getDueStatus(task);
  const dateStr = new Date(task.created).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  // Project badge
  let projectBadge = '';
  if (task.projectId) {
    const p = projects.find(pr => pr.id === task.projectId);
    if (p) {
      projectBadge = `<span class="task-project-badge" style="background:${p.color}20;color:${p.color};border:1px solid ${p.color}40">📁 ${escHtml(p.name)}</span>`;
    }
  }

  // Subtask mini
  let subtaskMini = '';
  if (task.subtasks && task.subtasks.length > 0) {
    const done = task.subtasks.filter(s => s.done).length;
    subtaskMini = `<span class="task-subtask-mini">☑ ${done}/${task.subtasks.length}</span>`;
  }

  const div = document.createElement('div');
  div.id = 'task-' + task.id;
  div.className = `task-item prio-${task.priority} ${task.done ? 'done' : ''} ${dueStatus === 'overdue' ? 'overdue' : ''}`;
  div.style.animationDelay = (idx * 0.04) + 's';
  div.draggable = true;

  div.innerHTML = `
    <div class="task-check ${task.done ? 'checked' : ''}" onclick="toggleDone(${task.id})"></div>
    <div class="task-body">
      <span class="task-text">${escHtml(task.text)}</span>
      <div class="task-meta">
        <span class="task-tag tag-${task.tag || 'default'}">${tagLabels[task.tag] || task.tag}</span>
        ${projectBadge}
        ${subtaskMini}
        <span class="task-date">⏰ ${dateStr}</span>
        ${formatDue(task)}
        ${task.link ? `<a href="${escHtml(task.link)}" target="_blank" style="font-size:0.72rem;color:var(--accent);font-weight:600;text-decoration:none">🔗 Link</a>` : ''}
        ${task.notes ? `<span style="font-size:0.72rem;color:var(--muted);font-weight:500">📝 Notes</span>` : ''}
      </div>
    </div>
    <div class="task-actions">
      <button class="icon-btn detail-btn" title="Details" onclick="openTaskModal(${task.id})">📋</button>
      <button class="icon-btn edit-btn" title="Edit" onclick="startEdit(${task.id})">✏️</button>
      <button class="icon-btn del-btn" title="Delete" onclick="deleteTask(${task.id})">🗑</button>
    </div>`;

  // Drag & Drop
  div.addEventListener('dragstart', e => {
    dragSrc = task.id;
    div.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });
  div.addEventListener('dragend', () => div.classList.remove('dragging'));
  div.addEventListener('dragover', e => { e.preventDefault(); div.classList.add('drag-over'); });
  div.addEventListener('dragleave', () => div.classList.remove('drag-over'));
  div.addEventListener('drop', e => {
    e.preventDefault();
    div.classList.remove('drag-over');
    if (dragSrc && dragSrc !== task.id) {
      const srcIdx = tasks.findIndex(t => t.id === dragSrc);
      const dstIdx = tasks.findIndex(t => t.id === task.id);
      const [moved] = tasks.splice(srcIdx, 1);
      tasks.splice(dstIdx, 0, moved);
      saveTasks(); renderTasks();
    }
  });

  return div;
}

// ============== SAVE ==============
function saveTasks() {
  localStorage.setItem('dayflow-tasks', JSON.stringify(tasks));
}

// ============== COMPLETION HISTORY / STREAKS ==============
function getTodayKey() {
  return new Date().toISOString().split('T')[0];
}

function recordCompletion() {
  const key = getTodayKey();
  completionHistory[key] = (completionHistory[key] || 0) + 1;
  localStorage.setItem('dayflow-history', JSON.stringify(completionHistory));
}

function recordTodayActivity() {
  const key = getTodayKey();
  // Just record that user opened app today (for streak)
  const activityLog = JSON.parse(localStorage.getItem('dayflow-activity') || '{}');
  activityLog[key] = true;
  localStorage.setItem('dayflow-activity', JSON.stringify(activityLog));
}

function calcStreak() {
  const activityLog = JSON.parse(localStorage.getItem('dayflow-activity') || '{}');
  let streak = 0;
  const d = new Date();
  while (true) {
    const key = d.toISOString().split('T')[0];
    if (activityLog[key]) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

// ============== DASHBOARD ==============
function renderDashboard() {
  const today = getTodayKey();
  const todayDone = tasks.filter(t => {
    if (!t.completedAt) return false;
    return t.completedAt.split('T')[0] === today;
  }).length;

  // Weekly
  const weekKeys = [];
  const d = new Date();
  for (let i = 6; i >= 0; i--) {
    const d2 = new Date(d);
    d2.setDate(d.getDate() - i);
    weekKeys.push(d2.toISOString().split('T')[0]);
  }
  const weekTotal = weekKeys.reduce((sum, k) => sum + (completionHistory[k] || 0), 0);
  const weekTasksCreated = tasks.filter(t => {
    const key = new Date(t.created).toISOString().split('T')[0];
    return weekKeys.includes(key);
  }).length;
  const weekPct = weekTasksCreated > 0 ? Math.round(weekTotal / weekTasksCreated * 100) : 0;

  // Overdue
  const overdueCount = tasks.filter(t => getDueStatus(t) === 'overdue').length;

  document.getElementById('dash-today').textContent = todayDone;
  document.getElementById('dash-week-pct').textContent = Math.min(weekPct, 100) + '%';
  document.getElementById('dash-streak').textContent = calcStreak();
  document.getElementById('dash-overdue').textContent = overdueCount;

  // Week chart
  renderWeekChart(weekKeys);

  // Overdue list
  renderOverdueList();

  // Breakdowns
  renderProjectBreakdown();
  renderTagBreakdown();
}

function renderWeekChart(weekKeys) {
  const wrap = document.getElementById('week-chart');
  const maxVal = Math.max(1, ...weekKeys.map(k => completionHistory[k] || 0));
  const today = getTodayKey();
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  wrap.innerHTML = '';
  weekKeys.forEach(key => {
    const val = completionHistory[key] || 0;
    const heightPct = Math.max(4, Math.round((val / maxVal) * 100));
    const dayOfWeek = new Date(key + 'T12:00:00').getDay();
    const label = dayLabels[dayOfWeek];
    const isToday = key === today;

    const barWrap = document.createElement('div');
    barWrap.className = 'chart-bar-wrap';
    barWrap.innerHTML = `
      <div class="chart-bar${isToday ? ' today' : ''}" style="height:${heightPct}%">
        ${val > 0 ? `<span class="chart-bar-num">${val}</span>` : ''}
      </div>
      <div class="chart-bar-label">${label}</div>
    `;
    wrap.appendChild(barWrap);
  });
}

function renderOverdueList() {
  const el = document.getElementById('overdue-list');
  const overdue = tasks.filter(t => getDueStatus(t) === 'overdue')
    .sort((a, b) => new Date(a.due) - new Date(b.due));

  if (overdue.length === 0) {
    el.innerHTML = '<div class="no-overdue">🎉 No overdue tasks!</div>';
    return;
  }
  el.innerHTML = '';
  overdue.slice(0, 5).forEach(t => {
    const due = new Date(t.due);
    const dueStr = due.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const div = document.createElement('div');
    div.className = 'overdue-item';
    div.innerHTML = `
      <div>${escHtml(t.text.length > 40 ? t.text.slice(0, 40) + '…' : t.text)}</div>
      <div class="overdue-item-date">⚠ Due: ${dueStr}</div>
    `;
    el.appendChild(div);
  });
  if (overdue.length > 5) {
    el.innerHTML += `<div style="font-size:0.78rem;color:var(--muted);text-align:center;padding:6px 0">+${overdue.length - 5} more</div>`;
  }
}

function renderProjectBreakdown() {
  const el = document.getElementById('project-breakdown');
  el.innerHTML = '';
  const maxCount = Math.max(1, ...projects.map(p => tasks.filter(t => t.projectId === p.id && t.done).length));

  if (projects.length === 0) {
    el.innerHTML = '<div style="font-size:0.85rem;color:var(--muted)">No projects yet</div>';
    return;
  }
  projects.forEach(p => {
    const total = tasks.filter(t => t.projectId === p.id).length;
    const done = tasks.filter(t => t.projectId === p.id && t.done).length;
    const pct = total > 0 ? Math.round(done / total * 100) : 0;
    const div = document.createElement('div');
    div.className = 'breakdown-row';
    div.innerHTML = `
      <span class="breakdown-label" title="${escHtml(p.name)}">${escHtml(p.name)}</span>
      <div class="breakdown-bar-wrap">
        <div class="breakdown-bar" style="width:${pct}%;background:${p.color}"></div>
      </div>
      <span class="breakdown-num">${done}/${total}</span>
    `;
    el.appendChild(div);
  });
}

function renderTagBreakdown() {
  const el = document.getElementById('tag-breakdown');
  const tags = ['work', 'personal', 'health', 'urgent'];
  const tagLabels = { work: '💼 Work', personal: '👤 Personal', health: '💪 Health', urgent: '🔥 Urgent' };
  const tagColors = { work: 'var(--blue)', personal: 'var(--purple)', health: 'var(--green)', urgent: 'var(--red)' };
  el.innerHTML = '';
  tags.forEach(tag => {
    const total = tasks.filter(t => t.tag === tag).length;
    if (total === 0) return;
    const done = tasks.filter(t => t.tag === tag && t.done).length;
    const pct = Math.round(done / total * 100);
    const div = document.createElement('div');
    div.className = 'breakdown-row';
    div.innerHTML = `
      <span class="breakdown-label">${tagLabels[tag]}</span>
      <div class="breakdown-bar-wrap">
        <div class="breakdown-bar" style="width:${pct}%;background:${tagColors[tag]}"></div>
      </div>
      <span class="breakdown-num">${done}/${total}</span>
    `;
    el.appendChild(div);
  });
  if (el.innerHTML === '') {
    el.innerHTML = '<div style="font-size:0.85rem;color:var(--muted)">No tasks yet</div>';
  }
}

// ============== NOTIFICATIONS ==============
function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function scheduleNotificationForTask(task) {
  if (!task.due || !('Notification' in window) || Notification.permission !== 'granted') return;
  const due = new Date(task.due);
  const now = new Date();
  const reminderTime = due.getTime() - 30 * 60 * 1000; // 30 min before
  const delay = reminderTime - now.getTime();
  if (delay > 0 && delay < 24 * 60 * 60 * 1000) { // only schedule if within 24h
    setTimeout(() => {
      const t = tasks.find(t => t.id === task.id);
      if (t && !t.done) {
        new Notification('⏰ DayFlow Reminder', {
          body: `Due in 30 minutes: ${task.text}`,
          icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><text y="28" font-size="28">◈</text></svg>'
        });
      }
    }, delay);
  }
}

function scheduleNotificationCheck() {
  // Re-check every minute for due tasks
  setInterval(() => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    tasks.forEach(task => {
      if (task.done || !task.due) return;
      const due = new Date(task.due);
      const now = new Date();
      const diffMin = (due - now) / (1000 * 60);
      if (diffMin <= 0 && diffMin > -1) {
        new Notification('🔔 Task Due Now!', {
          body: task.text,
        });
      }
    });
  }, 60000);
}

// ============== KEYBOARD ==============
document.getElementById('task-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') addTask();
});
document.getElementById('subtask-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') addSubtask();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeTaskModalDirect();
    document.getElementById('project-modal-overlay').classList.add('hidden');
  }
});

// ============== UTILS ==============
function escHtml(str) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(str));
  return d.innerHTML;
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2600);
}

// ============== START ==============
init();