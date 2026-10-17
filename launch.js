/* Date explicite : après le passage à l'heure d'hiver, Paris est à UTC+1. */
(() => {
  'use strict';
  const section = document.querySelector('[data-software-launch]');
  if (!section) return;
  const deadline = Date.parse(section.dataset.softwareLaunch);
  const timer = section.querySelector('[data-launch-countdown]');
  const status = section.querySelector('[data-launch-status]');
  if (!Number.isFinite(deadline) || !timer || !status) return;
  const fields = Object.fromEntries(['days', 'hours', 'minutes', 'seconds'].map(
    (name) => [name, timer.querySelector(`[data-countdown="${name}"]`)]
  ));
  if (Object.values(fields).some((field) => !field)) return;
  let interval;
  function update() {
    const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    if (remaining === 0) {
      timer.hidden = true;
      status.textContent = 'La date de lancement prévue est arrivée. Contactez-nous pour connaître la disponibilité du logiciel.';
      if (interval) window.clearInterval(interval);
      return false;
    }
    const values = {
      days: Math.floor(remaining / 86400),
      hours: Math.floor((remaining % 86400) / 3600),
      minutes: Math.floor((remaining % 3600) / 60),
      seconds: remaining % 60,
    };
    for (const [name, value] of Object.entries(values)) fields[name].textContent = String(value).padStart(2, '0');
    timer.hidden = false;
    return true;
  }
  if (update()) interval = window.setInterval(update, 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) update(); });
})();
