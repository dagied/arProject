
const HINTS = {
  idle: 'Tap Start AR to begin',
  scanning: 'Move phone to detect a floor or table…',
  ready: 'Tap to place an object',
};

let selectedShape = 'cube';
let onShapeChange = null;
let onUndo = null;
let onClear = null;

export function getSelectedShape() {
  return selectedShape;
}

export function setHint(state) {
  const el = document.getElementById('hint');
  if (el) el.textContent = HINTS[state] ?? HINTS.idle;
}

export function initUI(handlers = {}) {
  onShapeChange = handlers.onShapeChange ?? null;
  onUndo = handlers.onUndo ?? null;
  onClear = handlers.onClear ?? null;

  const shapeButtons = document.querySelectorAll('.shape-btn');
  shapeButtons.forEach((btn) => {
    // Prevent XR select from firing when tapping UI
    btn.addEventListener('beforexrselect', (e) => e.preventDefault());

    btn.addEventListener('click', () => {
      selectedShape = btn.dataset.shape;
      shapeButtons.forEach((b) => b.classList.toggle('active', b === btn));
      if (onShapeChange) onShapeChange(selectedShape);
    });
  });

  // Default active
  const first = document.querySelector('.shape-btn[data-shape="cube"]');
  if (first) first.classList.add('active');

  const undoBtn = document.getElementById('btn-undo');
  const clearBtn = document.getElementById('btn-clear');

  if (undoBtn) {
    undoBtn.addEventListener('beforexrselect', (e) => e.preventDefault());
    undoBtn.addEventListener('click', () => {
      if (onUndo) onUndo();
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('beforexrselect', (e) => e.preventDefault());
    clearBtn.addEventListener('click', () => {
      if (onClear) onClear();
    });
  }
}

export function showUnsupported() {
  const el = document.getElementById('unsupported');
  if (el) el.classList.remove('hidden');
  const overlay = document.getElementById('overlay');
  if (overlay) overlay.style.display = 'none';
}