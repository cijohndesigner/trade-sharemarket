/* CJ Live Clock - isolated utility; does not interact with trading logic. */
(function () {
  "use strict";

  var clockId = "cjLiveClockDisplay";
  var timerId = null;

  function updateCJLiveClock() {
    var clock = document.getElementById(clockId);
    if (!clock) return;

    var now = new Date();
    var timeText = new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true
    }).format(now);

    clock.textContent = timeText + " IST";
    clock.setAttribute("datetime", new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).format(now));
  }

  function startCJLiveClock() {
    updateCJLiveClock();
    if (timerId !== null) window.clearInterval(timerId);
    timerId = window.setInterval(updateCJLiveClock, 1000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startCJLiveClock, { once: true });
  } else {
    startCJLiveClock();
  }
}());
