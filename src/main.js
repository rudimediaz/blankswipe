import "./style.css";
import { wrap } from "comlink";
import MyWorker from "./worker?worker";
//pure func
const createRandom = (min, max) => (seed) =>
  (new Array(max + 1).fill(min).map((x, i) => x + i).length * seed()) | 0;

const randomizeHue = createRandom(0, 360);
const randomizeSatLum = createRandom(20, 80);
const seed = () => Math.random();
const hslToString = (h, s, l) => `hsl(${h}deg,${s}%,${l}%)`;
const countMovement = (xs) => {
  const first = xs[0];
  const last = xs[xs.length - 1];
  const delta = last - first;
  const average = Math.round(delta / xs.length);
  return average;
};

const clamp = (min, max) => (val) => val < min ? min : val > max ? max : val;
const clampHue = clamp(0, 360);
const clampSatLum = clamp(0, 100);
const parseRGB = (rgbString) =>
  rgbString
    .replace(/[rgba\(\)\s*]/g, "")
    .split(",")
    .map(Number);

const countContrast = (rgbValues) => {
  const total = rgbValues.reduce((a, c) => a + c, 0);
  const average = Math.round(total / rgbValues.length);

  return average;
};
//applications
const HUE = new WeakMap();
const SAT = new WeakMap();
const LUM = new WeakMap();
/**@type {WeakMap<HTMLElement,Set<Touch>>} */
const TOUCH = new WeakMap();
const worker = new MyWorker();
const workerProxy = wrap(worker);
const app = document.getElementById("app");
const display = document.getElementById("display");
const controlAreas = document.querySelectorAll(".control-area");
const colorNameContainer = document.getElementById("color-name-container");

//event registration
window.addEventListener("DOMContentLoaded", handleDCL);
window.addEventListener("load", handleLoad);
display.addEventListener("update-color", handleUpdateColor);
controlAreas.forEach((el) => {
  el.addEventListener("touchstart", handleTouchStart);
  el.addEventListener("touchmove", handelTouchMove);
  el.addEventListener("touchend", handleTouchEnd);
});
app.addEventListener("update-hue", handleUpdateHue);
app.addEventListener("update-sat", handleUpdateSat);
app.addEventListener("update-lum", handleUpdateLum);
colorNameContainer.addEventListener("color-name-ready", handleColorNameReady);

//subroutine
function setHue(val) {
  HUE.set(this, val);
  updateColor.call(this);
}

function setSat(val) {
  SAT.set(this, val);
  updateColor.call(this);
}

function setLum(val) {
  LUM.set(this, val);
  updateColor.call(this);
}

function updateColor() {
  const updateColorEvent = new CustomEvent("update-color", {
    detail: {
      hsl: [HUE.get(this), SAT.get(this), LUM.get(this)],
    },
  });
  display.dispatchEvent(updateColorEvent);
}

function changeBackground(hsl) {
  this.style.backgroundColor = hsl;
}

function setTextContent(textContent) {
  this.textContent = textContent;
}

//event handlers
function handleDCL() {
  const h = randomizeHue(seed);
  const [s, l] = new Array(2).fill(null).map((_) => randomizeSatLum(seed));
  sessionStorage.setItem("initial_color", JSON.stringify({ h, s, l }));
  workerProxy.fetchColorDatabase();
}

function handleLoad() {
  const storedHSL = sessionStorage.getItem("initial_color");

  if (typeof storedHSL === "string") {
    const { h, s, l } = JSON.parse(storedHSL);
    setHue.call(app, h);
    setSat.call(app, s);
    setLum.call(app, l);
  } else {
    setHue.call(app, 180);
    setSat.call(app, 50);
    setLum.call(app, 50);
  }
}

function handleUpdateColor(e) {
  const [h, s, l] = e.detail.hsl;
  changeBackground.call(display, hslToString(h, s, l));
  const currentStyle = getComputedStyle(display, null);
  const backgroundColor = parseRGB(currentStyle.backgroundColor);
  if (backgroundColor.length < 4 && backgroundColor !== undefined) {
    const contrastValue = countContrast(backgroundColor);

    if (contrastValue > 255 / 2) {
      if (display.hasAttribute("data-contrast") === false) {
        display.setAttribute("data-contrast", "");
      }
    } else {
      if (display.hasAttribute("data-contrast")) {
        display.removeAttribute("data-contrast");
      }
    }

    workerProxy.getColorName(backgroundColor).then((colorName) => {
      const colorNameReady = new CustomEvent("color-name-ready", {
        detail: {
          ...colorName,
        },
      });
      colorNameContainer.dispatchEvent(colorNameReady);
    });
  }
}

function handleTouchStart(e) {
  const set = new Set();
  set.add(e.targetTouches[0]);
  TOUCH.set(e.target, set);
}
function handelTouchMove(e) {
  const currentSet = TOUCH.get(e.target);
  currentSet.add(e.changedTouches[0]);
}
function handleTouchEnd(e) {
  const currentSet = TOUCH.get(e.target);
  const touchList = Array.from(currentSet);
  const acceleration = countMovement(touchList.map((t) => t.clientX));
  const eventBind = e.target.getAttribute("data-event");
  const colorUpdateEvent = new CustomEvent(eventBind, {
    detail: {
      value: acceleration,
    },
  });
  app.dispatchEvent(colorUpdateEvent);
}

function handleUpdateHue(e) {
  const aggregate = HUE.get(app) + e.detail.value;
  const value = clampHue(aggregate);
  setHue.call(app, value);
}

function handleUpdateSat(e) {
  const aggregate = SAT.get(app) + e.detail.value;
  const value = clampSatLum(aggregate);
  setSat.call(app, value);
}

function handleUpdateLum(e) {
  const aggregate = LUM.get(app) + e.detail.value;
  const value = clampSatLum(aggregate);
  setLum.call(app, value);
}

function handleColorNameReady(e) {
  setTextContent.call(colorNameContainer, e.detail.name);
}
