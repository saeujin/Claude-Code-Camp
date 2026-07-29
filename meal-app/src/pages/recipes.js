// F6 재료 기반 레시피 추천 페이지 — 계획서 5·6·7장

import { RECIPES } from '../../data/recipes.js';
import { isExpiringSoon, MAX_MISSING, normalize, rankRecipes } from '../domain/recipe.js';
import {
  getIngredients,
  getProfile,
  getRemainingCalories,
  todayISO,
} from '../state/selectors.js';

const $ = (id) => document.getElementById(id);
const fmt = (n) => Number(n).toLocaleString('ko-KR');

const ui = {
  pinned: null,
  useCalorieFilter: false,
  lastRanked: [],
};

/* ── 초기화 ────────────────────────────────────────────────── */

function init() {
  $('chip-bar').addEventListener('click', onChipClick);
  $('pin-clear').addEventListener('click', () => {
    ui.pinned = null;
    render();
  });
  $('cal-toggle').addEventListener('change', (e) => {
    ui.useCalorieFilter = e.target.checked;
    render();
  });
  $('results').addEventListener('click', onResultClick);
  $('detail-close').addEventListener('click', () => $('detail').close());
  $('detail-fridge').addEventListener('click', () => {
    alert('F4 냉장고 관리는 아직 구현 전이에요.');
  });
  $('detail-log').addEventListener('click', () => {
    alert('F2 식단 기록은 아직 구현 전이에요.');
  });

  render();
}

/* ── 렌더 ──────────────────────────────────────────────────── */

function render() {
  const today = todayISO();
  const ingredients = getIngredients();
  const remaining = getRemainingCalories(today);

  renderChips(ingredients, today);
  renderCalorieToggle(remaining);

  if (ingredients.length === 0) {
    showEmpty(
      '냉장고가 비어 있어요. 재료를 등록하면 만들 수 있는 요리를 찾아드려요. <a href="#" id="to-fridge">[냉장고 채우기]</a>',
    );
    return;
  }

  const ranked = rankRecipes(RECIPES, ingredients, {
    pinnedIngredient: ui.pinned,
    useCalorieFilter: ui.useCalorieFilter,
    remaining,
    today,
  });
  ui.lastRanked = ranked;

  if (ranked.length === 0) {
    if (ui.pinned) {
      showEmpty(
        `'${escapeHtml(ui.pinned)}'을(를) 쓰는 요리가 없어요. <button type="button" class="linkbtn" id="empty-unpin">[지정 해제]</button>`,
      );
      $('empty-unpin')?.addEventListener('click', () => {
        ui.pinned = null;
        render();
      });
    } else {
      showEmpty('지금 재료로 만들 수 있는 요리를 못 찾았어요. 재료를 몇 개 더 등록해보세요.');
    }
    return;
  }

  renderResults(ranked);
}

function renderChips(ingredients, today) {
  $('ing-count').textContent = `(${ingredients.length})`;
  $('chip-bar').innerHTML = ingredients
    .map((ing) => {
      const soon = isExpiringSoon(ing, today);
      const active = ui.pinned && normalize(ui.pinned) === normalize(ing.name);
      return `<li><button type="button" class="ingchip${active ? ' active' : ''}${soon ? ' soon' : ''}" data-name="${escapeHtml(ing.name)}">
        ${escapeHtml(ing.name)}${soon ? ' <span aria-label="유통기한 임박">⏰</span>' : ''}
      </button></li>`;
    })
    .join('');

  $('pinned-row').hidden = !ui.pinned;
  if (ui.pinned) $('pinned-name').textContent = ui.pinned;
}

function renderCalorieToggle(remaining) {
  const hasProfile = Boolean(getProfile());
  const toggle = $('cal-toggle');
  toggle.disabled = !hasProfile;

  if (!hasProfile) {
    $('cal-toggle-label').textContent = '오늘 남은 칼로리 안에서 찾기';
    $('cal-hint').textContent = '잔여 칼로리를 쓰려면 프로필 설정이 필요해요.';
    return;
  }

  $('cal-toggle-label').textContent =
    remaining > 0
      ? `오늘 남은 칼로리(${fmt(remaining)} kcal) 안에서 찾기`
      : '오늘 남은 칼로리 안에서 찾기';

  if (ui.useCalorieFilter && remaining <= 0) {
    $('cal-hint').textContent = '오늘 목표를 넘었어요. 가벼운 요리부터 보여드려요.';
  } else if (ui.useCalorieFilter) {
    $('cal-hint').textContent = `${fmt(remaining)} kcal를 넘는 요리는 아래쪽으로 내려요. 숨기지는 않아요.`;
  } else {
    $('cal-hint').textContent = '';
  }
}

function renderResults(ranked) {
  $('empty-state').hidden = true;
  $('result-count').textContent = `(${ranked.length})`;

  const perfect = ranked.some((r) => r.matchPercent === 100);
  const notice = perfect
    ? ''
    : `<li class="note">딱 맞는 요리가 없어서 부족한 재료가 ${MAX_MISSING}개까지인 요리도 함께 보여드려요.</li>`;

  $('results').innerHTML =
    notice +
    ranked
      .map(
        (r) => `
    <li>
      <button type="button" class="recipe" data-id="${r.id}">
        <span class="recipe__head">
          <span class="recipe__name">${escapeHtml(r.name)}</span>
          <span class="matchbadge match--${bucket(r.matchPercent)}">${r.matchPercent}%</span>
          <span class="recipe__kcal">${fmt(r.kcal)} kcal</span>
        </span>
        ${r.expiringNames.length ? `<span class="recipe__reason">⏰ 유통기한이 임박한 ${escapeHtml(r.expiringNames.join(' · '))}을(를) 써요</span>` : ''}
        ${r.caloriePenalty ? '<span class="recipe__reason recipe__reason--over">남은 칼로리를 넘어요</span>' : ''}
        <span class="recipe__ings">보유: ${r.matched.map((i) => escapeHtml(i.name)).join(' · ')}</span>
        ${r.missing.length ? `<span class="recipe__ings recipe__ings--missing">부족: ${r.missing.map((i) => escapeHtml(i.name)).join(' · ')}</span>` : ''}
      </button>
    </li>`,
      )
      .join('');
}

function showEmpty(html) {
  $('results').innerHTML = '';
  $('result-count').textContent = '(0)';
  const el = $('empty-state');
  el.hidden = false;
  el.innerHTML = html;
  $('to-fridge')?.addEventListener('click', (e) => {
    e.preventDefault();
    alert('F4 냉장고 관리는 아직 구현 전이에요.');
  });
}

/** 매칭률 배지는 색으로 구간을 나누되 숫자를 항상 함께 쓴다 (계획서 5.1). */
function bucket(percent) {
  if (percent === 100) return 'full';
  if (percent >= 75) return 'high';
  if (percent >= 50) return 'mid';
  return 'low';
}

/* ── 상호작용 ──────────────────────────────────────────────── */

function onChipClick(event) {
  const btn = event.target.closest('.ingchip');
  if (!btn) return;
  const name = btn.dataset.name;
  ui.pinned = ui.pinned && normalize(ui.pinned) === normalize(name) ? null : name;
  render();
}

function onResultClick(event) {
  const btn = event.target.closest('.recipe');
  if (!btn) return;
  const recipe = ui.lastRanked.find((r) => r.id === btn.dataset.id);
  if (recipe) openDetail(recipe);
}

/** 재료표를 보유 / 부족 / 양념 3구간으로 나눠 보여준다 (계획서 6.1 ⑤). */
function openDetail(r) {
  $('detail-title').textContent = r.name;
  $('detail-meta').textContent = `${fmt(r.kcal)} kcal · ${r.servings}인분 · 매칭률 ${r.matchPercent}%`;

  const row = (ing, cls, label) =>
    `<li class="ingrow ${cls}"><span>${escapeHtml(ing.name)}</span><span>${ing.qty}${ing.unit}</span><span class="ingrow__tag">${label}</span></li>`;

  $('detail-ingredients').innerHTML = [
    ...r.matched.map((ing) => row(ing, 'have', '보유')),
    ...r.missing.map((ing) => row(ing, 'lack', '부족')),
    ...r.staples.map((ing) => row(ing, 'staple', '양념')),
  ].join('');

  $('detail-steps').innerHTML = r.steps.map((s) => `<li>${escapeHtml(s)}</li>`).join('');
  $('detail').showModal();
}

/* ── 유틸 ──────────────────────────────────────────────────── */

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

init();
