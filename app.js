
// ============== STATE ==============
let tasks = JSON.parse(localStorage.getItem('dayflow-tasks') || '[]');
let filter = 'all';
let selectedTag = 'work';
let selectedPriority = 'low';
let dragSrc = null;

// ============== DATE ==============
function setDate() {
  const now = new Date();
  const opts = { weekday:'long', month:'long', day:'numeric', year:'numeric' };
  document.getElementById('header-date').textContent = now.toLocaleDateString('en-US', opts);
}

// ============== TAG / PRIORITY SELECTION ==============
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
    input.style.borderColor = '#ef4444';
    input.style.boxShadow = '0 0 0 4px rgba(239,68,68,0.1)';
    setTimeout(() => {
      input.style.borderColor = '';
      input.style.boxShadow = '';
    }, 1000);
    input.focus();
    return;
  }

  const task = {
    id: Date.now(),
    text,
    tag: selectedTag,
    priority: selectedPriority,
    done: false,
    created: new Date().toISOString()
  };

  tasks.unshift(task);
  saveTasks();
  renderTasks();
  input.value = '';
  input.focus();
  showToast('✓ Task added!');
}

// ============== TOGGLE DONE ==============
function toggleDone(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  task.done = !task.done;
  saveTasks();
  renderTasks();
  if (task.done) {
    showToast('🎉 Task completed!');
    // Check if all done
    if (tasks.length > 0 && tasks.every(t => t.done)) {
      setTimeout(() => showToast('🏆 All tasks done! Amazing!'), 800);
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
    }, 380);
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
  inp.focus();
  inp.select();

  function save() {
    const val = inp.value.trim();
    task.text = val || oldText;
    saveTasks();
    renderTasks();
  }
  inp.addEventListener('blur', save);
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') save();
    if (e.key === 'Escape') { task.text = oldText; renderTasks(); }
  });
}

// ============== FILTER ==============
function setFilter(btn) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  filter = btn.dataset.filter;
  renderTasks();
}

// ============== CLEAR COMPLETED ==============
function clearCompleted() {
  const count = tasks.filter(t => t.done).length;
  if (!count) { showToast('No completed tasks to clear'); return; }
  tasks = tasks.filter(t => !t.done);
  saveTasks();
  renderTasks();
  showToast(`🗑 Cleared ${count} completed task${count > 1 ? 's' : ''}`);
}

// ============== RENDER ==============
function renderTasks() {
  const container = document.getElementById('tasks-container');
  const search = document.getElementById('search').value.toLowerCase();

  let filtered = tasks.filter(t => {
    if (filter === 'active') return !t.done;
    if (filter === 'done') return t.done;
    return true;
  }).filter(t => t.text.toLowerCase().includes(search));

  // Sort: undone first, high prio first
  const prioOrder = { high:0, med:1, low:2 };
  filtered.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return prioOrder[a.priority] - prioOrder[b.priority];
  });

  // Stats
  const total = tasks.length;
  const done = tasks.filter(t => t.done).length;
  document.getElementById('stat-done').textContent = done;
  document.getElementById('stat-total').textContent = total;

  const pct = total > 0 ? Math.round(done / total * 100) : 0;
  document.getElementById('progress-fill').style.width = pct + '%';
  document.getElementById('progress-pct').textContent = pct + '%';
  document.getElementById('progress-text').textContent =
    total === 0 ? 'No tasks yet' :
    done === total ? '🎉 All done!' :
    `${done} of ${total} completed`;

  const labels = { all:'All tasks', active:'Active tasks', done:'Completed' };
  document.getElementById('filter-label').innerHTML =
    `${labels[filter]} <span>(${filtered.length})</span>`;

  if (filtered.length === 0) {
    const msgs = {
      all: { icon:'📝', title:'No tasks yet', sub:'Add your first task above!' },
      active: { icon:'✅', title:'All tasks completed!', sub:'Enjoy your free time!' },
      done: { icon:'🎯', title:'No completed tasks', sub:'Complete some tasks first!' }
    };
    const m = msgs[filter];
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">${m.icon}</div>
        <div class="empty-title">${m.title}</div>
        <div class="empty-sub">${m.sub}</div>
      </div>`;
    return;
  }

  container.innerHTML = '';
  filtered.forEach((task, idx) => {
    const el = createTaskEl(task, idx);
    container.appendChild(el);
  });
}

function createTaskEl(task, idx) {
  const tagColors = { work:'work', personal:'personal', health:'health', urgent:'urgent' };
  const tagLabels = { work:'💼 Work', personal:'👤 Personal', health:'💪 Health', urgent:'🔥 Urgent' };
  const prioColors = { low:'#28a745', med:'#ffc107', high:'#dc3545' };
  const prioLabels = { low:'Low', med:'Med', high:'High' };

  const date = new Date(task.created);
  const dateStr = date.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit' });

  const div = document.createElement('div');
  div.id = 'task-' + task.id;
  div.className = `task-item prio-${task.priority} ${task.done ? 'done' : ''}`;
  div.style.animationDelay = (idx * 0.05) + 's';
  div.draggable = true;

  div.innerHTML = `
    <div class="task-check ${task.done ? 'checked' : ''}" onclick="toggleDone(${task.id})"></div>
    <div class="task-body">
      <span class="task-text">${escHtml(task.text)}</span>
      <div class="task-meta">
        <span class="task-tag tag-${tagColors[task.tag] || 'default'}">${tagLabels[task.tag] || task.tag}</span>
        <span class="task-date">⏰ ${dateStr}</span>
      </div>
    </div>
    <div class="task-actions">
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
      saveTasks();
      renderTasks();
    }
  });

  return div;
}

function escHtml(str) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(str));
  return d.innerHTML;
}

// ============== SAVE ==============
function saveTasks() {
  localStorage.setItem('dayflow-tasks', JSON.stringify(tasks));
}

// ============== TOAST ==============
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2500);
}

// ============== KEYBOARD ==============
document.getElementById('task-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') addTask();
});

// ============== INIT ==============
setDate();
renderTasks();