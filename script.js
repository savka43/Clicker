const countDisplay = document.querySelector("#count");
const button = document.querySelector("#click-button");
const character = document.querySelector("#character");
const battleCry = document.querySelector("#battle-cry");
let count = 0;
let hookTimeout;

function clickPudge() {
  console.log("Клик");
  count += 1;
  countDisplay.textContent = count;
  if (count % 100 === 0) {
    clearTimeout(hookTimeout);
    character.classList.remove("hooking");
    void character.offsetWidth;
    battleCry.textContent = "fresh meat!";
    character.classList.add("hooking");
    hookTimeout = setTimeout(() => {
      character.classList.remove("hooking");
      battleCry.textContent = "";
    }, 1800);
  }
}

button.addEventListener("click", clickPudge);
