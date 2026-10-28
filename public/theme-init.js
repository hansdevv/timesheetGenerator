// Theme initializer — executes synchronously in <head> before page render to prevent FOUC
(function () {
  try {
    var saved = localStorage.getItem("ts-theme");
    var prefersLight =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: light)").matches;
    var resolved = "dark";

    if (saved === "light" || saved === "dark") {
      resolved = saved;
    } else if (saved === "system" || !saved) {
      resolved = prefersLight ? "light" : "dark";
    }

    document.documentElement.setAttribute("data-theme", resolved);
    document.documentElement.style.colorScheme = resolved;
  } catch (e) {
    // Fail silently in restricted environments
  }
})();
