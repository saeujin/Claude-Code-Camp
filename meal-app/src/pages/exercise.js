// F3 운동 기록 페이지 — 계획서 5·6·7장
//
// 폼 마크업은 exercise.html에 정적으로 두고, 여기서는 값·표시 상태만 갱신한다.
// (폼 전체를 re-render하면 입력 중 포커스가 날아간다.)

import { CATALOG_BY_ID, searchCatalog } from '../../data/exercises.js';
import {
  buildExerciseLog,
  calcExerciseCalories,
  DURATION_WARN_MIN,
} from '../domain/exercise.js';
import { deleteExerciseLog, newId, putExerciseLog } from '../state/store.js';
import {
  getDailyState,
  getIntakeTotal,
  getProfile,
  nowHHMM,
  todayISO,
} from '../state/selectors.js';

const $ = (id) => document.getElementById(id);
const fmt = (n) => Number(n).toLocaleString('ko-KR');

const TYPE_LABEL = { cardio: '유산소', strength: '근력' };

const ui = {
  tab: 'catalog',
  selectedId: null,
  editingId: null,
  editingSource: null,
  undoTimer: null,
  pendingUndo: null,
  lastTodayTarget: null,
};

/* ── 초기화 ────────────────────────────────────────────────── */

function init() {
  $('ex-date').value = todayISO();
  $('mn-date').value = todayISO();
  $('ex-time').value = nowHHMM();
  $('mn-time').value = nowHHMM();

  $('tab-catalog').addEventListener('click', () => switchTab('catalog'));
  $('tab-manual').addEventListener('click', () => switchTab('manual'));

  $('ex-search').addEventListener('input', renderSearchResults);
  $('ex-results').addEventListener('click', onSelectCatalogItem);
  $('ex-duration').addEventListener('input', refreshCatalogForm);
  $('panel-catalog').addEventListener('submit', onSubmitCatalog);

  ['mn-name', 'mn-cal'].forEach((id) => $(id).addEventListener('input', refreshManualForm));
  document
    .querySelectorAll('input[name="mn-type"]')
    .forEach((el) => el.addEventListener('change', refreshManualForm));
  $('panel-manual').addEventListener('submit', onSubmitManual);

  $('log-list').addEventListener('click', onLogAction);
  $('edit-cancel').addEventListener('click', cancelEdit);
  $('snackbar-undo').addEventListener('click', undoDelete);
  $('profile-link').addEventListener('click', (e) => {
    e.preventDefault();
    alert('F1 프로필 설정은 아직 구현 전이에요.');
  });

  renderSearchResults();
  render();
}

function switchTab(tab) {
  ui.tab = tab;
  $('tab-catalog').classList.toggle('active', tab === 'catalog');
  $('tab-manual').classList.toggle('active', tab === 'manual');
  $('tab-catalog').setAttribute('aria-selected', String(tab === 'catalog'));
  $('tab-manual').setAttribute('aria-selected', String(tab === 'manual'));
  $('panel-catalog').hidden = tab !== 'catalog';
  $('panel-manual').hidden = tab !== 'manual';
}

/* ── 전체 렌더 ─────────────────────────────────────────────── */

function render() {
  const date = $('ex-date').value || todayISO();
  const state = getDailyState(date);
  const profile = getProfile();

  renderSummary(state, profile, date);
  renderLogList(state);
  renderProfileBlock(profile);
  refreshCatalogForm();
  refreshManualForm();
}

function renderSummary(state, profile, date) {
  const prev = ui.lastTodayTarget;
  ui.lastTodayTarget = state.todayTarget;

  $('summary-today').textContent = fmt(state.todayTarget);
  if (prev !== null && prev !== state.todayTarget) countUp($('summary-today'), prev, state.todayTarget);

  $('summary-breakdown').textContent = state.exerciseTotal
    ? `기본 목표 ${fmt(state.baseTarget)}  +  운동 ${fmt(state.exerciseTotal)}`
    : `기본 목표 ${fmt(state.baseTarget)}`;

  const badge = $('summary-exercise-badge');
  badge.hidden = state.exerciseTotal === 0;
  badge.textContent = `+${fmt(state.exerciseTotal)} kcal 운동으로 추가됨`;

  const m = state.macros;
  $('summary-macros').textContent = `탄수 ${m.carb} g · 단백질 ${m.protein} g · 지방 ${m.fat} g`;

  const protein = $('summary-protein');
  protein.hidden = !state.hasStrength;
  protein.textContent = m.adjusted
    ? `단백질 목표 ${m.protein} g ↑ 근력운동 반영 (탄수 ${m.carbCutG} g 차감)`
    : `단백질 하한 ${state.proteinFloorG} g ↑ 근력운동 반영`;

  // 잔여 칼로리 — 음수도 그대로 보여준다 (명세: 정상 동작)
  const remaining = state.todayTarget - getIntakeTotal(date);
  const el = $('summary-remaining');
  el.textContent =
    remaining >= 0
      ? `잔여 칼로리 ${fmt(remaining)} kcal`
      : `목표 초과 ${fmt(Math.abs(remaining))} kcal (잔여 ${fmt(remaining)})`;
  el.classList.toggle('negative', remaining < 0);

  $('estimate-notice').textContent =
    profile?.goal === 'diet'
      ? '소모 칼로리는 추정치예요. 다이어트 중이라면 늘어난 만큼 전부 채우기보다 절반 정도만 채우는 걸 권해요.'
      : '소모 칼로리는 추정치예요.';
}

function renderLogList(state) {
  const list = $('log-list');
  if (state.logs.length === 0) {
    list.innerHTML = '<li class="empty">아직 기록이 없어요.</li>';
  } else {
    list.innerHTML = state.logs
      .map(
        (l) => `
      <li class="logitem${l.id === ui.editingId ? ' editing' : ''}">
        <span class="logitem__time">${l.time}</span>
        <span class="logitem__name">${escapeHtml(l.name)}</span>
        <span class="logitem__dur">${l.durationMin ? `${l.durationMin}분` : ''}</span>
        <span class="logitem__cal">${fmt(l.calories)} kcal</span>
        <span class="chip chip--${l.type}">${TYPE_LABEL[l.type] ?? '-'}</span>
        <button type="button" class="linkbtn" data-act="edit" data-id="${l.id}">수정</button>
        <button type="button" class="linkbtn" data-act="delete" data-id="${l.id}">삭제</button>
      </li>`,
      )
      .join('');
  }
  $('log-total').textContent = fmt(state.exerciseTotal);

  const banner = $('banner-suspicious');
  banner.hidden = !state.suspicious;
  banner.textContent = `오늘 운동 소모가 ${fmt(state.baseTarget)} kcal를 넘었어요. 입력을 확인해주세요.`;
}

function renderProfileBlock(profile) {
  const blocked = !profile?.weightKg;
  $('profile-block').hidden = !blocked;
  $('tab-catalog').disabled = blocked;
  if (blocked && ui.tab === 'catalog') switchTab('manual');
}

/* ── 운동 선택 탭 ──────────────────────────────────────────── */

function renderSearchResults() {
  const items = searchCatalog($('ex-search').value);
  $('ex-results').innerHTML = items.length
    ? items
        .slice(0, 12)
        .map(
          (e) => `
      <li>
        <button type="button" class="result${e.id === ui.selectedId ? ' selected' : ''}" data-id="${e.id}">
          <span class="result__name">${escapeHtml(e.name)}</span>
          <span class="result__met">MET ${e.met}</span>
          <span class="chip chip--${e.type}">${TYPE_LABEL[e.type]}</span>
          ${e.verified ? '' : '<span class="chip chip--unverified">검증 전</span>'}
        </button>
      </li>`,
        )
        .join('')
    : '<li class="empty">검색 결과가 없어요. 「직접 입력」으로 기록할 수 있어요.</li>';
}

function onSelectCatalogItem(event) {
  const btn = event.target.closest('.result');
  if (!btn) return;
  ui.selectedId = btn.dataset.id;
  renderSearchResults();
  refreshCatalogForm();
  $('ex-duration').focus();
}

function refreshCatalogForm() {
  const item = ui.selectedId ? CATALOG_BY_ID.get(ui.selectedId) : null;
  const weightKg = getProfile()?.weightKg ?? 0;
  const durationMin = Number($('ex-duration').value);

  const selected = $('ex-selected');
  selected.hidden = !item;
  if (item) selected.textContent = `선택: ${item.name} (MET ${item.met})`;

  const kcal = item ? calcExerciseCalories({ met: item.met, weightKg, durationMin }) : 0;
  $('ex-preview').innerHTML = `▸ 예상 소모 <strong>${kcal ? fmt(kcal) : '–'}</strong> kcal`;

  $('ex-warn-duration').hidden = !(durationMin > DURATION_WARN_MIN);
  $('ex-hint-walk').hidden = !(item && item.id.startsWith('walk_'));
  $('ex-hint-unverified').hidden = !(item && !item.verified);

  $('ex-submit').disabled = !(item && durationMin > 0 && weightKg > 0);
  $('ex-submit').textContent = ui.editingId ? '수정 저장' : '기록하기';
}

function onSubmitCatalog(event) {
  event.preventDefault();
  const item = CATALOG_BY_ID.get(ui.selectedId);
  const weightKg = getProfile()?.weightKg ?? 0;
  if (!item || weightKg <= 0) return;

  putExerciseLog(
    buildExerciseLog({
      id: ui.editingId ?? newId(),
      date: $('ex-date').value || todayISO(),
      time: $('ex-time').value || nowHHMM(),
      source: 'catalog',
      catalogItem: item,
      durationMin: Number($('ex-duration').value),
      weightKg,
    }),
  );

  resetCatalogForm();
  clearEditing();
  render();
}

function resetCatalogForm() {
  ui.selectedId = null;
  $('ex-duration').value = '';
  $('ex-search').value = '';
  $('ex-time').value = nowHHMM();
  renderSearchResults();
}

/* ── 직접 입력 탭 ──────────────────────────────────────────── */

function selectedManualType() {
  return document.querySelector('input[name="mn-type"]:checked')?.value ?? null;
}

function refreshManualForm() {
  const name = $('mn-name').value.trim();
  const calories = Number($('mn-cal').value);
  const type = selectedManualType();

  // 유형은 필수다. 유형을 모르면 단백질 하한 상향을 판단할 수 없다.
  $('mn-type-msg').hidden = Boolean(type);
  $('mn-submit').disabled = !(name && calories > 0 && type);
  $('mn-submit').textContent = ui.editingId ? '수정 저장' : '기록하기';
}

function onSubmitManual(event) {
  event.preventDefault();
  const type = selectedManualType();
  if (!type) return;

  putExerciseLog(
    buildExerciseLog({
      id: ui.editingId ?? newId(),
      date: $('mn-date').value || todayISO(),
      time: $('mn-time').value || nowHHMM(),
      source: 'manual',
      name: $('mn-name').value,
      calories: Number($('mn-cal').value),
      durationMin: $('mn-duration').value || null,
      type,
      weightKg: getProfile()?.weightKg ?? 0,
    }),
  );

  resetManualForm();
  clearEditing();
  render();
}

function resetManualForm() {
  $('mn-name').value = '';
  $('mn-cal').value = '';
  $('mn-duration').value = '';
  $('mn-time').value = nowHHMM();
  document.querySelectorAll('input[name="mn-type"]').forEach((el) => (el.checked = false));
}

/* ── 목록: 수정 · 삭제 ─────────────────────────────────────── */

function onLogAction(event) {
  const btn = event.target.closest('button[data-act]');
  if (!btn) return;
  const { act, id } = btn.dataset;
  if (act === 'edit') startEdit(id);
  if (act === 'delete') doDelete(id);
}

function startEdit(id) {
  const log = getDailyState($('ex-date').value || todayISO()).logs.find((l) => l.id === id);
  if (!log) return;

  ui.editingId = id;
  ui.editingSource = log.source;
  $('edit-banner').hidden = false;

  if (log.source === 'catalog') {
    switchTab('catalog');
    ui.selectedId = log.catalogId;
    $('ex-search').value = '';
    $('ex-duration').value = log.durationMin ?? '';
    $('ex-time').value = log.time;
    $('ex-date').value = log.date;
    renderSearchResults();
  } else {
    switchTab('manual');
    $('mn-name').value = log.name;
    $('mn-cal').value = log.calories;
    $('mn-duration').value = log.durationMin ?? '';
    $('mn-time').value = log.time;
    $('mn-date').value = log.date;
    const radio = document.querySelector(`input[name="mn-type"][value="${log.type}"]`);
    if (radio) radio.checked = true;
  }
  render();
}

function cancelEdit() {
  clearEditing();
  resetCatalogForm();
  resetManualForm();
  render();
}

function clearEditing() {
  ui.editingId = null;
  ui.editingSource = null;
  $('edit-banner').hidden = true;
}

/** 확인 모달 없이 삭제하고 5초 되돌리기를 준다 (계획서 6.3). */
function doDelete(id) {
  const removed = deleteExerciseLog(id);
  if (!removed) return;
  if (ui.editingId === id) clearEditing();
  render();

  ui.pendingUndo = removed;
  $('snackbar-text').textContent = `'${removed.name}' 기록을 삭제했어요.`;
  $('snackbar').hidden = false;
  clearTimeout(ui.undoTimer);
  ui.undoTimer = setTimeout(() => {
    ui.pendingUndo = null;
    $('snackbar').hidden = true;
  }, 5000);
}

function undoDelete() {
  if (!ui.pendingUndo) return;
  putExerciseLog(ui.pendingUndo);
  ui.pendingUndo = null;
  clearTimeout(ui.undoTimer);
  $('snackbar').hidden = true;
  render();
}

/* ── 유틸 ──────────────────────────────────────────────────── */

/** 오늘 목표가 변한 사실을 눈에 보이게 한다 (계획서 6.1 ⑤). */
function countUp(el, from, to, ms = 300) {
  const start = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - start) / ms);
    el.textContent = fmt(Math.round(from + (to - from) * t));
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

init();
