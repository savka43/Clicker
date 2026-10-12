const character = document.querySelector('#character');
const battleCry = document.querySelector('#battle-cry');
let count = 0;
let hookTimeout;

function clickPudge() {
  count += 1;
  if (count % 100 === 0) {
    clearTimeout(hookTimeout);
    character.classList.remove('hooking');
    void character.offsetWidth;
    battleCry.textContent = 'fresh meat!';
    character.classList.add('hooking');
    hookTimeout = setTimeout(() => {
      character.classList.remove('hooking');
      battleCry.textContent = '';
    }, 1800);
  }
}

character.addEventListener('click', clickPudge);
character.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    if (!event.repeat) clickPudge();
  }
});
