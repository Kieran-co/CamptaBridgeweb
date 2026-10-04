const launchDate = new Date("2026-11-01T00:00:00+01:00");
const countdown = document.querySelector("#countdown");
const fallback = document.querySelector("#countdown-fallback");

const fields = {
  days: document.querySelector("#countdown-days"),
  hours: document.querySelector("#countdown-hours"),
  minutes: document.querySelector("#countdown-minutes"),
  seconds: document.querySelector("#countdown-seconds"),
};

function updateCountdown() {
  const remaining = launchDate.getTime() - Date.now();

  if (remaining <= 0) {
    countdown.hidden = true;
    fallback.hidden = false;
    return;
  }

  const totalSeconds = Math.floor(remaining / 1000);
  fields.days.textContent = String(Math.floor(totalSeconds / 86400));
  fields.hours.textContent = String(Math.floor((totalSeconds % 86400) / 3600)).padStart(2, "0");
  fields.minutes.textContent = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  fields.seconds.textContent = String(totalSeconds % 60).padStart(2, "0");
}

updateCountdown();
setInterval(updateCountdown, 1000);

const media = document.querySelector(".maintenance-media");
const demoVideo = media?.querySelector("video");

if (media && demoVideo) {
  const showVideo = () => media.classList.add("is-ready");
  demoVideo.addEventListener("loadeddata", showVideo, { once: true });
  demoVideo.addEventListener("canplay", showVideo, { once: true });
  demoVideo.addEventListener("error", () => media.classList.remove("is-ready"));
}
