import { expose } from "comlink";
import {
  createStore,
  keys as getKeys,
  setMany,
  get as dbGet,
  entries as getEntries,
  set as dbSet,
} from "idb-keyval";

import * as nearestColor from "nearest-color";

const colorStore = createStore("v1", "colors");
const memo = new WeakMap();
const RGBToHex = (rgbValues) => {
  let res = "";
  const divSixteen = (x) => x / 16;
  const multiplySixteen = (x) => x * 16;
  const floor = (x) => Math.floor(x);
  const getReal = (x) => x - floor(x);
  //convert

  for (const color of rgbValues) {
    const count = ((div) => [floor(div), getReal(div)])(divSixteen(color));
    res += count[0].toString(16);
    res += floor(multiplySixteen(count[1])).toString(16);
  }

  return { value: res, prefixed: "#" + res };
};

function fetchColorDatabase() {
  return getKeys(colorStore).then((keys) => {
    if (keys === undefined || keys.length === 0) {
      return fetch(
        "https://unpkg.com/color-name-list@8.38.0/dist/colornames.min.json"
      )
        .then((response) => {
          if (response.status > 399) {
            throw new Error(response.statusText);
          }

          return response.json();
        })
        .then((data) => {
          const keys = Object.keys(data);
          setMany(
            keys.map((key) => ["#" + key, data[key]]),
            colorStore
          );
        });
    }
  });
}

async function getColorName(rgbValues) {
  const colorEntries = await getEntries(colorStore);
  const hex = RGBToHex(rgbValues);

  if (colorEntries.length === 0 || colorEntries === undefined) {
    const fetchColor = await fetch(
      new URL(`/v1/${hex.value}`, "https://api.color.pizza")
    );
    const fetchColorResponse = await fetchColor.json();
    const name = fetchColorResponse.colors[0].name;
    return { ...hex, name };
  }

  const val = await dbGet(hex.prefixed, colorStore);

  if (val === undefined) {
    let colors;
    const colorLib = memo.get(colorStore);
    if (!colorLib) {
      colors = Object.fromEntries(colorEntries.map((e) => [e[1], e[0]]));
      memo.set(colorStore, colors);
    } else {
      colors = colorLib;
    }

    const getColor = nearestColor.from(colors);
    const near = getColor(hex.prefixed);
    //await dbSet(hex.prefixed, near.name, colorStore);
    return { ...hex, name: near.name };
  }
  return { ...hex, name: val };
}

expose({ fetchColorDatabase, getColorName });
