// Logic/Middleware layer: picks a random bright color and applies it

function randomBrightColor() {
  const hue = Math.floor(Math.random() * 360);
  return `hsl(${hue}, 90%, 60%)`;
}

function applyColor(color) {
  document.body.style.backgroundColor = color;
}

applyColor(randomBrightColor());

document.getElementById('change-btn').addEventListener('click', () => {
  applyColor(randomBrightColor());
});
