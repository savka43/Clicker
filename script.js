const countDisplay = document.querySelector('#count');
const button = document.querySelector('#click-button');
const character = document.querySelector('#character');
const battleCry = document.querySelector('#battle-cry');
const progress = document.querySelector('#progress');
const progressFill = document.querySelector('#progress-fill');
const remaining = document.querySelector('#remaining');
let count = 0;
let hookTimeout;

button.addEventListener('click', () => {
  count += 1;
  countDisplay.textContent = count;
  const progressCount = count % 100;
  progress.setAttribute('aria-valuenow', progressCount);
  progressFill.style.width = `${progressCount}%`;
  remaining.textContent = `До хука: ${100 - progressCount} кликов`;

  if (progressCount === 0) {
    clearTimeout(hookTimeout);
    character.classList.remove('hooking');
    // Restart the throw even if another milestone happens during the animation.
    void character.offsetWidth;
    battleCry.textContent = 'fresh meat!';
    character.classList.add('hooking');
    hookTimeout = setTimeout(() => {
      character.classList.remove('hooking');
      battleCry.textContent = '';
    }, 1800);
  }
});
