const mainArea = document.querySelector("#app");
const container = document.createElement("div");
container.classList.add("container");

let count = 0;

document.body.append(container);
container.append(mainArea);

Object.assign(container.style, {
  display: "flex",
  justifyContent: "center",
  minHeight: "100vh",
  alignItems: "center",
});

Object.assign(mainArea.style, {
  backgroundColor: "blue",
  width: "300px",
  height: "150px",
  borderRadius: "5px",
  display: "flex",
  flexFlow: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "25px",
});

const span = document.createElement("span");
span.textContent = count;

Object.assign(span.style, {
  color: "White",
});

mainArea.append(span);

const button = document.createElement("button");
button.textContent = "Нажми меня";

Object.assign(button.style, {
  borderRadius: "8px",
  color: "red",
});

mainArea.append(button);

button.addEventListener("click", () => {
  count++;
  span.textContent = count;
});
