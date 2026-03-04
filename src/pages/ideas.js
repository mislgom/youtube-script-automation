// Ideas management page — Kanban board
import { showToast, showModal } from '../components/toast.js';

const STATUS_CONFIG = {
  idea: { label: '💡 아이디어', color: 'var(--info)' },
  research: { label: '🔍 리서치', color: 'var(--accent)' },
  script: { label: '✍️ 대본', color: 'var(--warning)' },
  production: { label: '🎬 제작', color: '#f97316' },
  published: { label: '✅ 발행', color: 'var(--success)' },
  archived: { label: '❌ 폐기', color: 'var(--text-muted)' }
};

export async function renderIdeas(container, { api, navigate }) {
  container.innerHTML = `
    <div class="page-header flex-between">
      <div><h2>💡 아이디어 관리</h2><p>주제 아이디어를 아이디어에서 발행까지 관리하세요</p></div>
      <button class="btn btn-primary" id="new-idea-btn">+ 새 아이디어</button>
    </div>
    <div class="kanban-board" id="kanban-board"></div>
  `;

  document.getElementById('new-idea-btn').addEventListener('click', () => showNewIdeaModal(api));
  await loadKanban(api);
}

async function loadKanban(api) {
  const board = document.getElementById('kanban-board');
  try {
    const ideas = await api.getIdeas();

    board.innerHTML = Object.entries(STATUS_CONFIG)
      .filter(([key]) => key !== 'archived')
      .map(([status, config]) => {
        const items = ideas.filter(i => i.status === status);
        return `
          <div class="kanban-column" data-status="${status}">
            <div class="kanban-column-header">
              <span>${config.label}</span>
              <span class="count">${items.length}</span>
            </div>
            <div class="kanban-list" data-status="${status}">
              ${items.length > 0 ? items.map(idea => renderKanbanCard(idea)).join('') :
            '<div style="text-align:center;padding:20px;font-size:0.78rem;color:var(--text-muted);">비어있음</div>'}
            </div>
          </div>
        `;
      }).join('');

    // Card click → edit
    board.querySelectorAll('.kanban-card').forEach(card => {
      card.addEventListener('click', () => showEditIdeaModal(api, card.dataset.id, ideas));
    });

    // Drop zones for status change
    board.querySelectorAll('.kanban-list').forEach(list => {
      list.addEventListener('dragover', (e) => { e.preventDefault(); list.style.background = 'var(--accent-glow)'; });
      list.addEventListener('dragleave', () => { list.style.background = ''; });
      list.addEventListener('drop', async (e) => {
        e.preventDefault();
        list.style.background = '';
        const ideaId = e.dataTransfer.getData('text/plain');
        const newStatus = list.dataset.status;
        try {
          await api.updateIdeaStatus(ideaId, newStatus);
          showToast('상태가 변경되었습니다.', 'success');
          loadKanban(api);
        } catch (err) { showToast(err.message, 'error'); }
      });
    });
  } catch (err) {
    board.innerHTML = `<div class="empty-state"><div class="icon">❌</div><p>${err.message}</p></div>`;
  }
}

function renderKanbanCard(idea) {
  const simColor = idea.max_similarity >= 60 ? 'var(--danger)' : idea.max_similarity >= 30 ? 'var(--warning)' : 'var(--success)';
  const simBg = idea.max_similarity >= 60 ? 'var(--danger-bg)' : idea.max_similarity >= 30 ? 'var(--caution-bg)' : 'var(--safe-bg)';
  const priorityIcon = { high: '🔴', normal: '🟡', low: '🟢' };

  return `
    <div class="kanban-card" data-id="${idea.id}" draggable="true"
      ondragstart="event.dataTransfer.setData('text/plain', '${idea.id}')">
      <div class="card-title">${priorityIcon[idea.priority] || ''} ${idea.title}</div>
      ${idea.description ? `<div class="card-meta" style="margin-bottom:4px;">${idea.description.substring(0, 60)}${idea.description.length > 60 ? '...' : ''}</div>` : ''}
      <div class="card-meta">${new Date(idea.created_at).toLocaleDateString('ko')}</div>
      ${idea.max_similarity > 0 ? `
        <span class="card-similarity" style="color:${simColor};background:${simBg};">
          유사도 ${idea.max_similarity}%
        </span>
      ` : ''}
    </div>
  `;
}

function showNewIdeaModal(api) {
  showModal('새 아이디어', `
    <div class="input-group"><label>제목 *</label><input type="text" id="idea-title" placeholder="새 영상 주제"></div>
    <div class="input-group"><label>설명</label><textarea id="idea-desc" placeholder="간단한 줄거리나 메모"></textarea></div>
    <div class="input-group"><label>우선순위</label>
      <select id="idea-priority">
        <option value="normal">🟡 보통</option>
        <option value="high">🔴 높음</option>
        <option value="low">🟢 낮음</option>
      </select>
    </div>
  `, [{
    label: '생성', onClick: async () => {
      const title = document.getElementById('idea-title').value;
      if (!title) { showToast('제목을 입력해주세요.', 'warning'); return; }
      try {
        await api.addIdea({
          title,
          description: document.getElementById('idea-desc').value,
          priority: document.getElementById('idea-priority').value
        });
        showToast('아이디어가 생성되었습니다!', 'success');
        loadKanban(api);
      } catch (e) { showToast(e.message, 'error'); }
    }
  }]);
}

function showEditIdeaModal(api, ideaId, ideas) {
  const idea = ideas.find(i => String(i.id) === String(ideaId));
  if (!idea) return;

  showModal('아이디어 편집', `
    <div class="input-group"><label>제목</label><input type="text" id="edit-title" value="${idea.title}"></div>
    <div class="input-group"><label>설명</label><textarea id="edit-desc">${idea.description || ''}</textarea></div>
    <div class="input-group"><label>메모</label><textarea id="edit-notes">${idea.notes || ''}</textarea></div>
    <div class="input-group"><label>우선순위</label>
      <select id="edit-priority">
        <option value="normal" ${idea.priority === 'normal' ? 'selected' : ''}>🟡 보통</option>
        <option value="high" ${idea.priority === 'high' ? 'selected' : ''}>🔴 높음</option>
        <option value="low" ${idea.priority === 'low' ? 'selected' : ''}>🟢 낮음</option>
      </select>
    </div>
    ${idea.max_similarity > 0 ? `<div style="font-size:0.82rem;color:var(--text-secondary);">유사도: ${idea.max_similarity}%</div>` : ''}
  `, [
    {
      label: '삭제', class: 'btn-danger', onClick: async () => {
        if (!confirm('정말로 삭제하시겠습니까?')) return;
        await api.deleteIdea(ideaId);
        showToast('아이디어가 삭제되었습니다.', 'success');
        loadKanban(api, navigate);
      }
    },
    {
      label: '✍️ 대본 작성', class: 'btn-warning', onClick: () => {
        navigate(`/editor?ideaId=${ideaId}`);
      }
    },
    {
      label: '저장', onClick: async () => {
        try {
          await api.updateIdea(ideaId, {
            title: document.getElementById('edit-title').value,
            description: document.getElementById('edit-desc').value,
            notes: document.getElementById('edit-notes').value,
            priority: document.getElementById('edit-priority').value
          });
          showToast('저장되었습니다.', 'success');
          loadKanban(api);
        } catch (e) { showToast(e.message, 'error'); }
      }
    }
  ]);
}
