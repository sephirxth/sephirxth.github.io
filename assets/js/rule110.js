// Keep the static plate without JavaScript or when reduced motion is preferred.
(function () {
  var image = document.getElementById("rule110");
  var button = document.getElementById("rule110-toggle");
  if (!image || !button) return;
  var preference = window.matchMedia("(prefers-reduced-motion: reduce)");
  var animated = false;
  function setAnimation(play) {
    animated = play;
    image.src = play ? image.dataset.animated : image.dataset.static;
    button.textContent = play ? button.dataset.pause : button.dataset.play;
  }
  button.hidden = false;
  button.addEventListener("click", function () { setAnimation(!animated); });
  preference.addEventListener("change", function () { setAnimation(!preference.matches); });
  image.addEventListener("error", function () {
    if (animated) { setAnimation(false); button.hidden = true; }
  });
  setAnimation(!preference.matches);
})();
