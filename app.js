const groups = [
  { key: "boys", title: "男生词条摘录", names: ["顾星辰", "江叙白", "秋亦帆", "林泽宇"] },
  { key: "girls", title: "女生词条摘录", names: ["苏晚晴", "夏知柚", "许星眠", "温以宁"] }
];

const state = {
  names: groups.map(group => [...group.names]),
  entries: groups.map(() => Array.from({ length: 4 }, () => ({ personal: "", ideal: "" })))
};

const saved = JSON.parse(localStorage.getItem("dreamy-entry-sheet") || "null");
if (saved?.entries?.length === 2) state.entries = saved.entries;
if (saved?.names?.length === 2) state.names = saved.names;

const app = document.querySelector("#app");
app.innerHTML = `
  <div class="screen">
    <section class="sheet" id="sheet" aria-label="词条摘录表格">
      <div class="sheet-content" id="sheetContent"></div>
    </section>
    <nav class="actions" aria-label="表格操作">
      <button class="action" id="shuffle" type="button">打乱姓名</button>
      <button class="action primary" id="export" type="button">导出图片</button>
      <button class="action" id="exportHidden" type="button">隐藏姓名并导出</button>
    </nav>
    <div class="toast" id="toast" role="status" aria-live="polite"></div>
  </div>`;

const sheetContent = document.querySelector("#sheetContent");

function renderTables() {
  sheetContent.innerHTML = groups.map((group, groupIndex) => `
    <section class="group" data-group="${groupIndex}">
      <h2 class="group-title">${group.title}</h2>
      <div class="table">
        <div class="row">
          <div class="cell head">姓名</div>
          <div class="cell head">个人标签</div>
          <div class="cell head">理想型标签</div>
        </div>
        ${state.names[groupIndex].map((name, rowIndex) => `
          <div class="row">
            <div class="cell name">${name}</div>
            <div class="cell">
              <textarea class="entry" data-group="${groupIndex}" data-row="${rowIndex}" data-field="personal" aria-label="${name}的个人标签" maxlength="140" placeholder="点击填写">${escapeHtml(state.entries[groupIndex][rowIndex].personal)}</textarea>
            </div>
            <div class="cell">
              <textarea class="entry" data-group="${groupIndex}" data-row="${rowIndex}" data-field="ideal" aria-label="${name}的理想型标签" maxlength="140" placeholder="点击填写">${escapeHtml(state.entries[groupIndex][rowIndex].ideal)}</textarea>
            </div>
          </div>`).join("")}
      </div>
    </section>`).join("");
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[char]);
}

function saveState() {
  localStorage.setItem("dreamy-entry-sheet", JSON.stringify(state));
}

sheetContent.addEventListener("input", event => {
  const input = event.target.closest(".entry");
  if (!input) return;
  const { group, row, field } = input.dataset;
  state.entries[Number(group)][Number(row)][field] = input.value;
  saveState();
});

document.querySelector("#shuffle").addEventListener("click", () => {
  document.querySelectorAll(".name").forEach(name => name.classList.add("shuffling"));
  setTimeout(() => {
    state.names = state.names.map(names => shuffleToNewOrder(names));
    saveState();
    renderTables();
    showToast("姓名顺序已打乱");
  }, 140);
});

function shuffle(items) {
  for (let index = items.length - 1; index > 0; index--) {
    const target = Math.floor(Math.random() * (index + 1));
    [items[index], items[target]] = [items[target], items[index]];
  }
  return items;
}

function shuffleToNewOrder(names) {
  const original = names.join("|");
  let next = [...names];
  for (let attempt = 0; attempt < 8 && next.join("|") === original; attempt++) {
    next = shuffle([...names]);
  }
  if (next.join("|") === original) [next[0], next[1]] = [next[1], next[0]];
  return next;
}

let toastTimer;
function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 1800);
}

renderTables();

const backgroundImage = new Image();
backgroundImage.src = "background.png";
const backgroundReady = new Promise((resolve, reject) => {
  backgroundImage.onload = resolve;
  backgroundImage.onerror = reject;
});

document.querySelector("#export").addEventListener("click", () => exportSheet(false));
document.querySelector("#exportHidden").addEventListener("click", () => exportSheet(true));

async function exportSheet(hideNames) {
  const buttons = [...document.querySelectorAll(".action")];
  buttons.forEach(button => button.disabled = true);
  showToast("正在生成图片…");

  try {
    await Promise.all([backgroundReady, document.fonts?.ready || Promise.resolve()]);
    const canvas = document.createElement("canvas");
    canvas.width = 941;
    canvas.height = 1671;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
    drawExportContent(ctx, hideNames);

    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png", 1));
    if (!blob) throw new Error("图片生成失败");
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    const stamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `${hideNames ? "隐藏姓名-" : ""}词条摘录-${stamp}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    showToast(hideNames ? "已导出隐藏姓名版本" : "图片已导出");
  } catch (error) {
    console.error(error);
    showToast("导出失败，请重试");
  } finally {
    buttons.forEach(button => button.disabled = false);
  }
}

function drawExportContent(ctx, hideNames) {
  const x = 70;
  const y = 197;
  const width = 801;
  const totalHeight = 1330;
  const gap = 35;
  const groupHeight = (totalHeight - gap) / 2;

  groups.forEach((group, groupIndex) => {
    drawGroup(ctx, {
      x,
      y: y + groupIndex * (groupHeight + gap),
      width,
      height: groupHeight,
      title: group.title,
      names: state.names[groupIndex],
      entries: state.entries[groupIndex],
      hideNames
    });
  });
}

function drawGroup(ctx, options) {
  const { x, y, width, height, title, names, entries, hideNames } = options;
  const radius = 31;
  const titleHeight = 84;
  const tableHeight = height - titleHeight;
  const headerHeight = tableHeight * .52 / 4.52;
  const rowHeight = (tableHeight - headerHeight) / 4;
  const columns = [width * .20, width * .40, width * .40];
  const line = "rgba(123, 105, 177, .42)";

  ctx.save();
  roundedRect(ctx, x, y, width, height, radius);
  ctx.fillStyle = "rgba(255,255,255,.48)";
  ctx.fill();
  ctx.clip();

  const gradient = ctx.createLinearGradient(x, y, x + width, y);
  gradient.addColorStop(0, "rgba(231,224,255,.72)");
  gradient.addColorStop(1, "rgba(255,247,252,.72)");
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, width, titleHeight);

  ctx.fillStyle = "#65568f";
  ctx.font = '500 37px "Microsoft JhengHei", "Noto Sans SC", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(title, x + width / 2, y + titleHeight / 2 + 1);

  const tableY = y + titleHeight;
  ctx.fillStyle = "rgba(255,255,255,.24)";
  ctx.fillRect(x, tableY, width, headerHeight);
  ctx.fillStyle = "rgba(244,240,255,.26)";
  ctx.fillRect(x, tableY + headerHeight, columns[0], tableHeight - headerHeight);

  ctx.strokeStyle = line;
  ctx.lineWidth = 1.7;
  ctx.beginPath();
  ctx.moveTo(x, tableY); ctx.lineTo(x + width, tableY);
  ctx.moveTo(x, tableY + headerHeight); ctx.lineTo(x + width, tableY + headerHeight);
  for (let row = 1; row <= 3; row++) {
    const rowY = tableY + headerHeight + row * rowHeight;
    ctx.moveTo(x, rowY); ctx.lineTo(x + width, rowY);
  }
  let columnX = x;
  for (let column = 0; column < 2; column++) {
    columnX += columns[column];
    ctx.moveTo(columnX, tableY); ctx.lineTo(columnX, y + height);
  }
  ctx.stroke();

  const centers = [
    x + columns[0] / 2,
    x + columns[0] + columns[1] / 2,
    x + columns[0] + columns[1] + columns[2] / 2
  ];
  ctx.fillStyle = "#7a7395";
  ctx.font = '400 23px "Microsoft JhengHei", "Noto Sans SC", sans-serif';
  ["姓名", "个人标签", "理想型标签"].forEach((label, index) => {
    ctx.fillText(label, centers[index], tableY + headerHeight / 2);
  });

  for (let row = 0; row < 4; row++) {
    const rowY = tableY + headerHeight + row * rowHeight;
    if (!hideNames) {
      ctx.fillStyle = "#5e537f";
      ctx.font = '500 25px "Microsoft JhengHei", "Noto Sans SC", sans-serif';
      ctx.fillText(names[row], centers[0], rowY + rowHeight / 2);
    }

    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = "#4f4969";
    ctx.font = '400 22px "Microsoft JhengHei", "Noto Sans SC", sans-serif';
    drawWrappedText(ctx, entries[row]?.personal || "", x + columns[0] + 14, rowY + 12, columns[1] - 28, rowHeight - 24, 31);
    drawWrappedText(ctx, entries[row]?.ideal || "", x + columns[0] + columns[1] + 14, rowY + 12, columns[2] - 28, rowHeight - 24, 31);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
  }

  ctx.restore();
  ctx.save();
  roundedRect(ctx, x, y, width, height, radius);
  ctx.strokeStyle = line;
  ctx.lineWidth = 2.2;
  ctx.stroke();
  ctx.restore();
}

function drawWrappedText(ctx, text, x, y, maxWidth, maxHeight, lineHeight) {
  if (!text.trim()) return;
  const lines = [];
  String(text).split("\n").forEach((paragraph, paragraphIndex, paragraphs) => {
    let line = "";
    for (const character of paragraph) {
      const test = line + character;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = character;
      } else {
        line = test;
      }
    }
    lines.push(line);
    if (paragraphIndex < paragraphs.length - 1 && paragraph === "") lines.push("");
  });

  const maxLines = Math.max(1, Math.floor(maxHeight / lineHeight));
  const visible = lines.slice(0, maxLines);
  if (lines.length > maxLines) {
    let last = visible[maxLines - 1];
    while (last && ctx.measureText(last + "…").width > maxWidth) last = last.slice(0, -1);
    visible[maxLines - 1] = `${last}…`;
  }
  visible.forEach((line, index) => ctx.fillText(line, x, y + index * lineHeight));
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}
