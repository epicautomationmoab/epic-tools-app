"use client";

import { useEffect } from "react";

type QrVersion = {
  dataCodewords: number;
  eccCodewords: number;
};

const QR_VERSIONS: Array<QrVersion | null> = [
  null,
  { dataCodewords: 19, eccCodewords: 7 },
  { dataCodewords: 34, eccCodewords: 10 },
  { dataCodewords: 55, eccCodewords: 15 },
  { dataCodewords: 80, eccCodewords: 20 },
  { dataCodewords: 108, eccCodewords: 26 },
];

const gfExp = new Array<number>(512).fill(0);
const gfLog = new Array<number>(256).fill(0);
let gfValue = 1;
for (let index = 0; index < 255; index += 1) {
  gfExp[index] = gfValue;
  gfLog[gfValue] = index;
  gfValue <<= 1;
  if (gfValue & 0x100) gfValue ^= 0x11d;
}
for (let index = 255; index < 512; index += 1) {
  gfExp[index] = gfExp[index - 255];
}

function gfMultiply(left: number, right: number) {
  if (left === 0 || right === 0) return 0;
  return gfExp[gfLog[left] + gfLog[right]];
}

function rsGenerator(degree: number) {
  let polynomial = [1];
  for (let exponent = 0; exponent < degree; exponent += 1) {
    const next = new Array<number>(polynomial.length + 1).fill(0);
    for (let index = 0; index < polynomial.length; index += 1) {
      next[index] ^= polynomial[index];
      next[index + 1] ^= gfMultiply(polynomial[index], gfExp[exponent]);
    }
    polynomial = next;
  }
  return polynomial;
}

function rsRemainder(data: number[], degree: number) {
  const generator = rsGenerator(degree);
  const message = [...data, ...new Array<number>(degree).fill(0)];
  for (let index = 0; index < data.length; index += 1) {
    const factor = message[index];
    if (!factor) continue;
    for (let offset = 0; offset < generator.length; offset += 1) {
      message[index + offset] ^= gfMultiply(generator[offset], factor);
    }
  }
  return message.slice(data.length);
}

function pushBits(bits: number[], value: number, length: number) {
  for (let index = length - 1; index >= 0; index -= 1) {
    bits.push((value >>> index) & 1);
  }
}

function dataCapacity(version: number) {
  const config = QR_VERSIONS[version];
  if (!config) return 0;
  return Math.floor((config.dataCodewords * 8 - 12) / 8);
}

function encodeCodewords(text: string) {
  const bytes = Array.from(new TextEncoder().encode(text));
  let version = 1;
  while (version <= 5 && bytes.length > dataCapacity(version)) version += 1;
  if (version > 5) {
    throw new Error("Guest Portal URL is too long to create a local QR code.");
  }

  const config = QR_VERSIONS[version];
  if (!config) throw new Error("Unable to select QR version.");

  const capacityBits = config.dataCodewords * 8;
  const bits: number[] = [];
  pushBits(bits, 0b0100, 4);
  pushBits(bits, bytes.length, 8);
  for (const byte of bytes) pushBits(bits, byte, 8);

  const terminator = Math.min(4, capacityBits - bits.length);
  for (let index = 0; index < terminator; index += 1) bits.push(0);
  while (bits.length % 8) bits.push(0);

  const data: number[] = [];
  for (let index = 0; index < bits.length; index += 8) {
    let value = 0;
    for (let offset = 0; offset < 8; offset += 1) {
      value = (value << 1) | (bits[index + offset] ?? 0);
    }
    data.push(value);
  }

  let padIndex = 0;
  while (data.length < config.dataCodewords) {
    data.push(padIndex % 2 === 0 ? 0xec : 0x11);
    padIndex += 1;
  }

  return {
    version,
    codewords: [...data, ...rsRemainder(data, config.eccCodewords)],
  };
}

function maskBit(mask: number, row: number, column: number) {
  switch (mask) {
    case 0:
      return (row + column) % 2 === 0;
    case 1:
      return row % 2 === 0;
    case 2:
      return column % 3 === 0;
    case 3:
      return (row + column) % 3 === 0;
    case 4:
      return (Math.floor(row / 2) + Math.floor(column / 3)) % 2 === 0;
    case 5:
      return ((row * column) % 2) + ((row * column) % 3) === 0;
    case 6:
      return (((row * column) % 2) + ((row * column) % 3)) % 2 === 0;
    case 7:
      return (((row + column) % 2) + ((row * column) % 3)) % 2 === 0;
    default:
      return false;
  }
}

function formatBits(mask: number) {
  const data = (1 << 3) | mask; // Error correction level L.
  let remainder = data << 10;
  const generator = 0x537;
  for (let bit = 14; bit >= 10; bit -= 1) {
    if ((remainder >>> bit) & 1) remainder ^= generator << (bit - 10);
  }
  return (((data << 10) | remainder) ^ 0x5412) & 0x7fff;
}

type QrBase = {
  size: number;
  modules: boolean[][];
  functionModules: boolean[][];
};

function makeBase(version: number): QrBase {
  const size = 21 + 4 * (version - 1);
  const modules = Array.from({ length: size }, () => Array<boolean>(size).fill(false));
  const functionModules = Array.from({ length: size }, () => Array<boolean>(size).fill(false));

  const setFunction = (row: number, column: number, dark: boolean) => {
    if (row < 0 || row >= size || column < 0 || column >= size) return;
    modules[row][column] = dark;
    functionModules[row][column] = true;
  };

  const drawFinder = (top: number, left: number) => {
    for (let rowOffset = -1; rowOffset <= 7; rowOffset += 1) {
      for (let columnOffset = -1; columnOffset <= 7; columnOffset += 1) {
        const row = top + rowOffset;
        const column = left + columnOffset;
        if (row < 0 || row >= size || column < 0 || column >= size) continue;
        const dark =
          rowOffset >= 0 &&
          rowOffset <= 6 &&
          columnOffset >= 0 &&
          columnOffset <= 6 &&
          (rowOffset === 0 ||
            rowOffset === 6 ||
            columnOffset === 0 ||
            columnOffset === 6 ||
            (rowOffset >= 2 && rowOffset <= 4 && columnOffset >= 2 && columnOffset <= 4));
        setFunction(row, column, dark);
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  for (let index = 8; index < size - 8; index += 1) {
    if (!functionModules[6][index]) setFunction(6, index, index % 2 === 0);
    if (!functionModules[index][6]) setFunction(index, 6, index % 2 === 0);
  }

  if (version >= 2) {
    const positions = [6, 4 * version + 10];
    for (const row of positions) {
      for (const column of positions) {
        if (functionModules[row][column]) continue;
        for (let rowOffset = -2; rowOffset <= 2; rowOffset += 1) {
          for (let columnOffset = -2; columnOffset <= 2; columnOffset += 1) {
            setFunction(
              row + rowOffset,
              column + columnOffset,
              Math.max(Math.abs(rowOffset), Math.abs(columnOffset)) !== 1,
            );
          }
        }
      }
    }
  }

  for (let index = 0; index < 15; index += 1) {
    if (index < 6) setFunction(index, 8, false);
    else if (index < 8) setFunction(index + 1, 8, false);
    else setFunction(size - 15 + index, 8, false);

    if (index < 8) setFunction(8, size - index - 1, false);
    else if (index < 9) setFunction(8, 15 - index, false);
    else setFunction(8, 15 - index - 1, false);
  }

  setFunction(size - 8, 8, true);
  return { size, modules, functionModules };
}

function placeData(base: QrBase, codewords: number[], mask: number) {
  const { size, modules, functionModules } = base;
  const bits: number[] = [];
  for (const codeword of codewords) pushBits(bits, codeword, 8);

  let bitIndex = 0;
  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right -= 1;
    for (let vertical = 0; vertical < size; vertical += 1) {
      const row = upward ? size - 1 - vertical : vertical;
      for (let offset = 0; offset < 2; offset += 1) {
        const column = right - offset;
        if (functionModules[row][column]) continue;
        let bit = bitIndex < bits.length ? bits[bitIndex] : 0;
        bitIndex += 1;
        if (maskBit(mask, row, column)) bit ^= 1;
        modules[row][column] = Boolean(bit);
      }
    }
    upward = !upward;
  }

  const format = formatBits(mask);
  for (let index = 0; index < 15; index += 1) {
    const dark = Boolean((format >>> index) & 1);
    if (index < 6) modules[index][8] = dark;
    else if (index < 8) modules[index + 1][8] = dark;
    else modules[size - 15 + index][8] = dark;

    if (index < 8) modules[8][size - index - 1] = dark;
    else if (index < 9) modules[8][15 - index] = dark;
    else modules[8][15 - index - 1] = dark;
  }
  modules[size - 8][8] = true;

  return modules;
}

function penaltyScore(modules: boolean[][]) {
  const size = modules.length;
  let score = 0;

  for (let row = 0; row < size; row += 1) {
    let runLength = 1;
    for (let column = 1; column < size; column += 1) {
      if (modules[row][column] === modules[row][column - 1]) runLength += 1;
      else {
        if (runLength >= 5) score += runLength - 2;
        runLength = 1;
      }
    }
    if (runLength >= 5) score += runLength - 2;
  }

  for (let column = 0; column < size; column += 1) {
    let runLength = 1;
    for (let row = 1; row < size; row += 1) {
      if (modules[row][column] === modules[row - 1][column]) runLength += 1;
      else {
        if (runLength >= 5) score += runLength - 2;
        runLength = 1;
      }
    }
    if (runLength >= 5) score += runLength - 2;
  }

  for (let row = 0; row < size - 1; row += 1) {
    for (let column = 0; column < size - 1; column += 1) {
      const value = modules[row][column];
      if (
        modules[row + 1][column] === value &&
        modules[row][column + 1] === value &&
        modules[row + 1][column + 1] === value
      ) {
        score += 3;
      }
    }
  }

  const pattern = [true, false, true, true, true, false, true];
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column <= size - 7; column += 1) {
      if (!pattern.every((value, offset) => modules[row][column + offset] === value)) continue;
      const leftQuiet = column >= 4 && [1, 2, 3, 4].every((offset) => !modules[row][column - offset]);
      const rightQuiet =
        column + 10 < size && [7, 8, 9, 10].every((offset) => !modules[row][column + offset]);
      if (leftQuiet || rightQuiet) score += 40;
    }
  }

  for (let column = 0; column < size; column += 1) {
    for (let row = 0; row <= size - 7; row += 1) {
      if (!pattern.every((value, offset) => modules[row + offset][column] === value)) continue;
      const upperQuiet = row >= 4 && [1, 2, 3, 4].every((offset) => !modules[row - offset][column]);
      const lowerQuiet =
        row + 10 < size && [7, 8, 9, 10].every((offset) => !modules[row + offset][column]);
      if (upperQuiet || lowerQuiet) score += 40;
    }
  }

  let darkCount = 0;
  for (const row of modules) {
    for (const module of row) if (module) darkCount += 1;
  }
  const total = size * size;
  score += Math.floor(Math.abs(darkCount * 20 - total * 10) / total) * 10;

  return score;
}

function createQrMatrix(text: string) {
  const { version, codewords } = encodeCodewords(text);
  let bestMatrix: boolean[][] | null = null;
  let bestPenalty = Number.POSITIVE_INFINITY;

  for (let mask = 0; mask < 8; mask += 1) {
    const matrix = placeData(makeBase(version), codewords, mask);
    const penalty = penaltyScore(matrix);
    if (penalty < bestPenalty) {
      bestPenalty = penalty;
      bestMatrix = matrix;
    }
  }

  if (!bestMatrix) throw new Error("Unable to generate QR code.");
  return bestMatrix;
}

function createQrSvg(text: string) {
  const matrix = createQrMatrix(text);
  const quietZone = 4;
  const dimension = matrix.length + quietZone * 2;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${dimension} ${dimension}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "QR code for this reservation's Guest Portal");
  svg.style.display = "block";
  svg.style.width = "min(520px, 78vw)";
  svg.style.height = "auto";
  svg.style.background = "#fff";
  svg.style.shapeRendering = "crispEdges";

  const background = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  background.setAttribute("width", String(dimension));
  background.setAttribute("height", String(dimension));
  background.setAttribute("fill", "#fff");
  svg.appendChild(background);

  let pathData = "";
  for (let row = 0; row < matrix.length; row += 1) {
    for (let column = 0; column < matrix.length; column += 1) {
      if (!matrix[row][column]) continue;
      const x = column + quietZone;
      const y = row + quietZone;
      pathData += `M${x} ${y}h1v1h-1z`;
    }
  }

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", pathData);
  path.setAttribute("fill", "#000");
  svg.appendChild(path);
  return svg;
}

function stylePortalQrButton(button: HTMLButtonElement) {
  button.type = "button";
  button.textContent = "Portal QR Generator";
  button.style.display = "inline-flex";
  button.style.alignItems = "center";
  button.style.justifyContent = "center";
  button.style.minHeight = "34px";
  button.style.marginLeft = "8px";
  button.style.marginTop = "8px";
  button.style.padding = "0 12px";
  button.style.border = "1px solid #d5521d";
  button.style.borderRadius = "8px";
  button.style.background = "#fff";
  button.style.color = "#d5521d";
  button.style.fontSize = "12px";
  button.style.fontWeight = "850";
  button.style.cursor = "pointer";
}

function openPortalQrModal(portalUrl: string, guestName: string, sourceDrawer: Element) {
  document.getElementById("guest-portal-qr-modal")?.remove();

  const backdrop = document.createElement("div");
  backdrop.id = "guest-portal-qr-modal";
  backdrop.dataset.portalQrModal = "true";
  backdrop.style.position = "fixed";
  backdrop.style.inset = "0";
  backdrop.style.zIndex = "2000";
  backdrop.style.display = "flex";
  backdrop.style.alignItems = "center";
  backdrop.style.justifyContent = "center";
  backdrop.style.padding = "24px";
  backdrop.style.background = "rgba(11, 18, 28, 0.72)";

  const panel = document.createElement("section");
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-label", "Guest Portal QR Code");
  panel.style.width = "min(620px, 94vw)";
  panel.style.maxHeight = "94vh";
  panel.style.overflow = "auto";
  panel.style.background = "#fff";
  panel.style.borderRadius = "14px";
  panel.style.boxShadow = "0 24px 70px rgba(0,0,0,.35)";
  panel.style.padding = "22px 24px 24px";

  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.alignItems = "flex-start";
  header.style.justifyContent = "space-between";
  header.style.gap = "18px";

  const headingWrap = document.createElement("div");
  const heading = document.createElement("h2");
  heading.textContent = "Guest Portal QR Code";
  heading.style.margin = "0";
  heading.style.fontSize = "24px";
  heading.style.color = "#202733";
  headingWrap.appendChild(heading);

  if (guestName) {
    const name = document.createElement("div");
    name.textContent = guestName;
    name.style.marginTop = "4px";
    name.style.color = "#6f7885";
    name.style.fontSize = "14px";
    name.style.fontWeight = "750";
    headingWrap.appendChild(name);
  }

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.textContent = "×";
  closeButton.setAttribute("aria-label", "Close Guest Portal QR Code");
  closeButton.style.width = "38px";
  closeButton.style.height = "38px";
  closeButton.style.border = "0";
  closeButton.style.borderRadius = "50%";
  closeButton.style.background = "#f0f2f4";
  closeButton.style.fontSize = "25px";
  closeButton.style.cursor = "pointer";

  header.append(headingWrap, closeButton);

  const instruction = document.createElement("p");
  instruction.textContent = "Scan to open this reservation's Guest Portal";
  instruction.style.margin = "16px 0 14px";
  instruction.style.textAlign = "center";
  instruction.style.fontSize = "16px";
  instruction.style.fontWeight = "800";
  instruction.style.color = "#303946";

  const qrWrap = document.createElement("div");
  qrWrap.style.display = "flex";
  qrWrap.style.justifyContent = "center";
  qrWrap.style.padding = "4px";

  try {
    qrWrap.appendChild(createQrSvg(portalUrl));
  } catch (error) {
    const message = document.createElement("div");
    message.textContent = error instanceof Error ? error.message : "Unable to generate QR code.";
    message.style.padding = "30px";
    message.style.color = "#b42318";
    message.style.fontWeight = "800";
    qrWrap.appendChild(message);
  }

  const urlBox = document.createElement("div");
  urlBox.textContent = portalUrl;
  urlBox.style.marginTop = "14px";
  urlBox.style.padding = "10px 12px";
  urlBox.style.borderRadius = "8px";
  urlBox.style.background = "#f3f4f6";
  urlBox.style.color = "#596273";
  urlBox.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, monospace";
  urlBox.style.fontSize = "11px";
  urlBox.style.lineHeight = "1.35";
  urlBox.style.overflowWrap = "anywhere";

  const openLink = document.createElement("a");
  openLink.href = portalUrl;
  openLink.target = "_blank";
  openLink.rel = "noopener noreferrer";
  openLink.textContent = "Open Guest Portal";
  openLink.style.display = "flex";
  openLink.style.alignItems = "center";
  openLink.style.justifyContent = "center";
  openLink.style.minHeight = "42px";
  openLink.style.marginTop = "14px";
  openLink.style.borderRadius = "8px";
  openLink.style.background = "#d5521d";
  openLink.style.color = "#fff";
  openLink.style.fontWeight = "850";
  openLink.style.textDecoration = "none";

  const close = () => {
    backdrop.remove();
    document.removeEventListener("keydown", onKeyDown, true);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    close();
  };

  closeButton.addEventListener("click", close);
  backdrop.addEventListener("mousedown", (event) => {
    if (event.target === backdrop) close();
  });
  panel.addEventListener("mousedown", (event) => event.stopPropagation());
  document.addEventListener("keydown", onKeyDown, true);

  panel.append(header, instruction, qrWrap, urlBox, openLink);
  backdrop.appendChild(panel);
  document.body.appendChild(backdrop);
  closeButton.focus();

  const observer = new MutationObserver(() => {
    if (!document.body.contains(sourceDrawer)) {
      observer.disconnect();
      close();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

export default function PortalQrEnhancer() {
  useEffect(() => {
    let scheduled = false;

    const enhance = () => {
      scheduled = false;
      const portalLinks = Array.from(
        document.querySelectorAll<HTMLAnchorElement>('a[href^="/guest/"]'),
      );

      for (const portalLink of portalLinks) {
        const drawer = portalLink.closest('[role="dialog"]');
        if (!drawer || drawer.id === "guest-portal-qr-modal") continue;
        if (drawer.querySelector("#portal-qr-generator-button")) continue;

        const button = document.createElement("button");
        button.id = "portal-qr-generator-button";
        stylePortalQrButton(button);
        portalLink.insertAdjacentElement("afterend", button);

        button.addEventListener("click", () => {
          const href = portalLink.getAttribute("href");
          if (!href) return;
          const portalUrl = new URL(href, window.location.origin).toString();
          const guestName = drawer.querySelector("h2")?.textContent?.trim() ?? "";
          openPortalQrModal(portalUrl, guestName, drawer);
        });
      }
    };

    const scheduleEnhance = () => {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(enhance);
    };

    scheduleEnhance();
    const observer = new MutationObserver(scheduleEnhance);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      document.getElementById("guest-portal-qr-modal")?.remove();
    };
  }, []);

  return null;
}
