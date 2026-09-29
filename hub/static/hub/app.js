/* Progressive enhancement: normal forms remain usable without JavaScript. */
const token = document.querySelector("[name=csrfmiddlewaretoken]")?.value;
const dirtyBoards = new Set();

async function api(url, body, signal) {
  const response = await fetch(url, {
    method: "POST",
    signal,
    credentials: "same-origin",
    headers: {
      "X-CSRFToken": token,
      ...(body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
    },
    body: body instanceof FormData ? body : JSON.stringify(body),
  });
  if (response.redirected)
    throw Object.assign(new Error("Your session expired. Sign in again."), {
      status: 401,
    });
  if (!response.headers.get("content-type")?.includes("application/json")) {
    throw Object.assign(
      new Error(
        `Request failed (${response.status}). Please reload and try again.`,
      ),
      { status: response.status },
    );
  }
  const result = await response.json();
  if (!response.ok)
    throw Object.assign(
      new Error(result.error || `Request failed (${response.status}).`),
      { status: response.status },
    );
  return result;
}

document.querySelectorAll("nav a").forEach((link) => {
  if (link.pathname === location.pathname)
    link.setAttribute("aria-current", "page");
});
document.querySelectorAll("[data-confirm]").forEach((form) => {
  form.addEventListener("submit", (event) => {
    if (!confirm(form.dataset.confirm)) event.preventDefault();
  });
});

for (const board of document.querySelectorAll(".tier-board")) {
  let dragged = null;
  let saving = false;
  let blocked = false;
  let retryTimer = null;
  let retryCount = 0;
  const queue = [];
  const status = board.querySelector(".save-status");
  const reload = board.querySelector(".reload-ranking");
  const entries = () =>
    [...board.querySelectorAll('.tier-row:not([data-tier="U"])')].flatMap(
      (row) =>
        [...row.querySelectorAll(".tier-tile")].map((tile) => ({
          id: tile.dataset.id,
          tier: row.dataset.tier,
        })),
    );
  let confirmed = entries();
  const report = (state, message) => {
    board.dataset.saveState = state;
    status.textContent = message;
  };
  const saveNext = async () => {
    if (saving || blocked || retryTimer || !queue.length) return;
    saving = true;
    report("saving", "Saving…");
    try {
      const result = await api(
        board.dataset.saveUrl,
        {
          entries: queue[0],
          revision: board.dataset.revision,
        },
        AbortSignal.timeout(15000),
      );
      board.dataset.revision = result.revision;
      board
        .querySelectorAll('[name="revision"]')
        .forEach((input) => (input.value = result.revision));
      confirmed = queue.shift();
      retryCount = 0;
      if (!queue.length) {
        const scores = new Map(result.placements.map((p) => [p.id, p.score]));
        for (const tile of board.querySelectorAll(".tier-tile")) {
          const score = scores.get(tile.dataset.id);
          const label = tile.querySelector(".tier-score");
          label.textContent = score?.toFixed(1) ?? "";
          label.hidden = score == null;
        }
        dirtyBoards.delete(board);
        report("saved", "Saved");
      }
    } catch (error) {
      if (
        !error.status ||
        error.status >= 500 ||
        [408, 429].includes(error.status)
      ) {
        report("retrying", "Not saved yet. Retrying automatically…");
        retryTimer = setTimeout(
          () => {
            retryTimer = null;
            saveNext();
          },
          Math.min(1000 * 2 ** retryCount++, 30000),
        );
      } else {
        blocked = true;
        reload.hidden = false;
        report("error", `Changes not saved. ${error.message}`);
      }
    } finally {
      saving = false;
      saveNext();
    }
  };
  const changed = () => {
    const next = entries();
    if (JSON.stringify(next) === JSON.stringify(queue.at(-1) ?? confirmed))
      return;
    // Keep every completed move, even while a previous request is in flight.
    queue.push(next);
    dirtyBoards.add(board);
    saveNext();
  };
  window.addEventListener("online", () => {
    clearTimeout(retryTimer);
    retryTimer = null;
    saveNext();
  });
  board.addEventListener("dragstart", (event) => {
    const tile = event.target.closest(".tier-tile");
    if (
      !tile ||
      blocked ||
      event.target.closest("input,select,button,summary,a")
    ) {
      event.preventDefault();
      return;
    }
    dragged = tile;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", dragged.dataset.id);
    dragged.classList.add("dragging");
  });
  board.addEventListener("dragend", () => {
    dragged?.classList.remove("dragging");
    board
      .querySelectorAll(".drag-over")
      .forEach((row) => row.classList.remove("drag-over"));
    dragged = null;
  });
  board.addEventListener("dragover", (event) => {
    const row = event.target.closest(".tier-items");
    if (!dragged || !row) return;
    event.preventDefault();
    row.classList.add("drag-over");
    event.dataTransfer.dropEffect = "move";
  });
  board.addEventListener("dragleave", (event) =>
    event.target.closest(".tier-items")?.classList.remove("drag-over"),
  );
  board.addEventListener("drop", (event) => {
    const row = event.target.closest(".tier-items");
    if (!dragged || !row || blocked) return;
    event.preventDefault();
    const target = event.target.closest(".tier-tile");
    if (target && target !== dragged) {
      const box = target.getBoundingClientRect();
      row.insertBefore(
        dragged,
        event.clientX < box.left + box.width / 2 ? target : target.nextSibling,
      );
    } else if (!target) row.append(dragged);
    dragged.querySelector('[name="tier"]').value =
      row.closest(".tier-row").dataset.tier;
    row.classList.remove("drag-over");
    changed();
  });
  board.addEventListener("submit", (event) => {
    event.preventDefault();
    if (blocked) return;
    const form = event.target;
    const tile = form.closest(".tier-tile");
    const tier = form.querySelector('[name="tier"]').value;
    const row = board.querySelector(`[data-tier="${tier}"] .tier-items`);
    const position = form.querySelector('[name="position"]').value;
    const siblings = [...row.querySelectorAll(".tier-tile")].filter(
      (other) => other !== tile,
    );
    row.insertBefore(
      tile,
      position === ""
        ? null
        : (siblings[Math.max(0, Number(position))] ?? null),
    );
    changed();
  });
}
window.addEventListener("beforeunload", (event) => {
  if (dirtyBoards.size) {
    event.preventDefault();
    event.returnValue = "";
  }
});

if (document.querySelector("#session-token")) {
  const heartbeat = () => {
    if (!document.hidden) api("/api/heartbeat", {}).catch(() => {});
  };
  heartbeat();
  setInterval(heartbeat, 30000);
}

// Render a small Markdown subset using DOM nodes; never interpret untrusted HTML.
function messageContent(node, text) {
  for (const line of text.split("\n")) {
    const paragraph = document.createElement("div");
    const pattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*]+)\*\*/g;
    let offset = 0;
    for (const match of line.matchAll(pattern)) {
      paragraph.append(
        document.createTextNode(line.slice(offset, match.index)),
      );
      const child = document.createElement(match[3] ? "strong" : "a");
      child.textContent = match[3] || match[1];
      if (!match[3]) {
        child.href = match[2];
        child.target = "_blank";
        child.rel = "noopener noreferrer";
      }
      paragraph.append(child);
      offset = match.index + match[0].length;
    }
    paragraph.append(document.createTextNode(line.slice(offset) || "\u00a0"));
    node.append(paragraph);
  }
}

const chatForm = document.querySelector("#chat-form");
if (chatForm) {
  const conversation = [];
  const container = document.querySelector("#chat-messages");
  const status = document.querySelector("#chat-status");
  const input = document.querySelector("#chat-input");
  const submit = chatForm.querySelector("button");
  const clear = document.querySelector("#clear-chat");
  const append = (role, content) => {
    const node = document.createElement("div");
    node.className = `chat-message ${role}`;
    messageContent(node, content);
    container.append(node);
    return node;
  };
  chatForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const content = input.value.trim();
    if (!content || submit.disabled) return;
    submit.disabled = clear.disabled = true;
    status.textContent = "Looking into it…";
    const node = append("user", content);
    try {
      const request = [...conversation.slice(-28), { role: "user", content }];
      // Drop whole older exchanges to stay within the server's conversation limit.
      while (
        request.length > 1 &&
        request.reduce((sum, m) => sum + m.content.length, 0) > 60000
      )
        request.splice(0, 2);
      const result = await api("/api/chat", { messages: request });
      conversation.push(
        { role: "user", content },
        { role: "assistant", content: result.answer },
      );
      append("assistant", result.answer);
      input.value = "";
      status.textContent = "";
    } catch (error) {
      node.remove();
      status.textContent = error.message;
    } finally {
      submit.disabled = clear.disabled = false;
      input.focus();
    }
  });
  clear.addEventListener("click", () => {
    conversation.length = 0;
    container.replaceChildren();
    status.textContent = "";
  });
}

const pdfForm = document.querySelector("#pdf-form");
pdfForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = pdfForm.querySelector("button");
  const status = document.querySelector("#pdf-status");
  button.disabled = true;
  status.textContent = "Converting the rulebook…";
  try {
    const result = await api(pdfForm.action, new FormData(pdfForm));
    document.querySelector("#id_content_md").value = result.markdown;
    status.textContent = result.truncated
      ? "The conversion reached its length limit. Split the PDF before saving."
      : "Converted. Review the Markdown below, then save.";
  } catch (error) {
    status.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

function svgElement(tag, attributes = {}, text = "") {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(attributes))
    node.setAttribute(key, value);
  if (text) node.textContent = text;
  return node;
}
function plot(container, xMax, yMax, xLabel, xTicks = null, width = 800) {
  const svg = svgElement("svg", {
    viewBox: `0 0 ${width} 300`,
    class: "chart",
  });
  const x = (value) => 45 + (value / Math.max(xMax, 1)) * (width - 75);
  const y = (value) => 255 - (value / Math.max(yMax, 1)) * 230;
  const yDivisions = yMax === 6 ? 6 : 5;
  for (let i = 0; i <= yDivisions; i++) {
    const value = (i * yMax) / yDivisions;
    svg.append(
      svgElement("line", {
        x1: 45,
        x2: width - 30,
        y1: y(value),
        y2: y(value),
      }),
    );
    svg.append(svgElement("text", { x: 5, y: y(value) + 4 }, value.toFixed(1)));
  }
  xTicks ??= Array.from({ length: 6 }, (_, i) => ({
    value: (i * xMax) / 5,
    label: ((i * xMax) / 5).toFixed(1),
  }));
  for (const { value, label } of xTicks)
    svg.append(
      svgElement(
        "text",
        {
          x: x(value),
          y: 275,
          "text-anchor":
            value === 0 ? "start" : value === xMax ? "end" : "middle",
        },
        label,
      ),
    );
  svg.append(
    svgElement(
      "text",
      { x: width / 2, y: 295, "text-anchor": "middle" },
      xLabel,
    ),
  );
  container.replaceChildren(svg);
  return { svg, x, y };
}
function point(chart, xv, yv, label) {
  const circle = svgElement("circle", {
    cx: chart.x(xv),
    cy: chart.y(yv),
    r: 5,
    tabindex: 0,
  });
  circle.append(svgElement("title", {}, label));
  circle.setAttribute("aria-label", label);
  chart.svg.append(circle);
}
const wheelData = document.querySelector("#wheel-data");
if (wheelData) {
  const data = JSON.parse(wheelData.textContent);
  const svg = svgElement("svg", {
    viewBox: "0 0 500 500",
    role: "img",
    "aria-label": "Weighted game picker wheel",
  });
  const group = svgElement("g");
  const total = data.games.reduce((sum, game) => sum + game.weight, 0);
  const colors = [
    "#087c94",
    "#6b5ca5",
    "#35866c",
    "#a16536",
    "#a74565",
    "#385c99",
  ];
  let angle = -Math.PI / 2;
  let rotation = 0;
  data.games.forEach((game, index) => {
    const span = (game.weight / total) * Math.PI * 2;
    const end = angle + span;
    const center = angle + span / 2;
    if (data.games.length === 1)
      group.append(
        svgElement("circle", { cx: 250, cy: 250, r: 225, fill: colors[0] }),
      );
    else
      group.append(
        svgElement("path", {
          d: `M250 250 L${250 + Math.cos(angle) * 225} ${250 + Math.sin(angle) * 225} A225 225 0 ${span > Math.PI ? 1 : 0} 1 ${250 + Math.cos(end) * 225} ${250 + Math.sin(end) * 225} Z`,
          fill: colors[index % colors.length],
          stroke: "#fff",
          "stroke-width": 1,
        }),
      );
    const text = svgElement(
      "text",
      {
        x: 250 + Math.cos(center) * 135,
        y: 250 + Math.sin(center) * 135,
        fill: "#fff",
        "text-anchor": "middle",
        "font-size": 11,
      },
      game.name.slice(0, 22),
    );
    text.append(
      svgElement(
        "title",
        {},
        `${game.name}: ${((game.weight / total) * 100).toFixed(1)}%`,
      ),
    );
    group.append(text);
    if (game.id === data.chosen)
      rotation = 1440 - ((center * 180) / Math.PI + 90);
    angle = end;
  });
  svg.append(
    group,
    svgElement("path", { d: "M235 2 L265 2 L250 30 Z", fill: "#e9b54d" }),
  );
  document.querySelector("#picker-wheel").append(svg);
  group.style.transformOrigin = "250px 250px";
  if (data.chosen) {
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches)
      group.animate(
        [
          { transform: "rotate(0deg)" },
          { transform: `rotate(${rotation}deg)` },
        ],
        { duration: 2000, easing: "cubic-bezier(.15,.7,.1,1)" },
      );
    group.style.transform = `rotate(${rotation}deg)`;
  }
}
const chartData = document.querySelector("#chart-data");
if (chartData) {
  const rows = JSON.parse(chartData.textContent);
  const scoreMax = Number(
    document.querySelector("#complexity-chart").dataset.scoreMax,
  );
  const series = document.querySelector("#chart-series");
  const draw = () => {
    const values = rows.filter((row) => row[series.value] != null);
    const width = Math.max(
      320,
      Math.min(800, document.querySelector("#complexity-chart").clientWidth),
    );
    const scatter = plot(
      document.querySelector("#complexity-chart"),
      6,
      scoreMax,
      "Community difficulty / 6",
      Array.from({ length: 6 }, (_, i) => ({
        value: i + 1,
        label: String(i + 1),
      })),
      width,
    );
    for (const row of values)
      if (row.difficulty != null)
        point(
          scatter,
          row.difficulty,
          row[series.value],
          `${row.name}: ${row[series.value].toFixed(1)}, difficulty ${row.difficulty.toFixed(1)} / 6`,
        );
    const bins = Array(scoreMax).fill(0);
    for (const row of values)
      bins[
        Math.min(scoreMax - 1, Math.max(0, Math.ceil(row[series.value]) - 1))
      ]++;
    const histogram = plot(
      document.querySelector("#distribution-chart"),
      scoreMax,
      Math.max(1, ...bins),
      "Score",
      null,
      width,
    );
    bins.forEach((count, i) => {
      const rect = svgElement("rect", {
        x: histogram.x(i) + 3,
        y: histogram.y(count),
        width: histogram.x(i + 1) - histogram.x(i) - 6,
        height: histogram.y(0) - histogram.y(count),
      });
      rect.append(svgElement("title", {}, `${i}–${i + 1}: ${count} games`));
      histogram.svg.append(rect);
    });
  };
  series.addEventListener("change", draw);
  window.addEventListener("resize", draw);
  draw();
}
document.querySelectorAll(".history-chart").forEach((container) => {
  const data = JSON.parse(
    document.getElementById(container.dataset.history).textContent,
  );
  const rows = data.points;
  if (!rows.length) return;
  // These are server-local calendar dates. UTC arithmetic avoids browser timezone
  // shifts and treats days on either side of daylight saving as equal widths.
  const day = (date) => Date.parse(date) / 86400000;
  const dateLabel = (value) =>
    new Date(value * 86400000).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  const end = Math.max(day(data.today), day(rows.at(-1).date));
  const start = Math.min(day(rows[0].date), end - 1);
  const draw = () => {
    const width = Math.max(320, Math.min(800, container.clientWidth));
    const divisions = width < 500 ? 1 : 5;
    const ticks = [
      ...new Set(
        Array.from({ length: divisions + 1 }, (_, i) =>
          Math.round((i * (end - start)) / divisions),
        ),
      ),
    ];
    const chart = plot(
      container,
      end - start,
      data.score_max ?? 10,
      "Date",
      ticks.map((value) => ({
        value,
        label: dateLabel(start + value),
      })),
      width,
    );
    let segment = [];
    let previous = null;
    const flush = () => {
      if (segment.length)
        chart.svg.insertBefore(
          svgElement("polyline", { points: segment.join(" ") }),
          chart.svg.querySelector("circle"),
        );
      segment = [];
    };
    for (const row of rows) {
      const offset = day(row.date) - start;
      // Hold the previous day's closing score until the next recorded day.
      if (previous != null)
        segment.push(`${chart.x(offset)},${chart.y(previous)}`);
      if (row.score == null) {
        flush();
      } else {
        segment.push(`${chart.x(offset)},${chart.y(row.score)}`);
        const change =
          row.change == null
            ? ""
            : ` (${row.change > 0 ? "+" : ""}${row.change.toFixed(1)} vs previous day)`;
        point(
          chart,
          offset,
          row.score,
          `${dateLabel(day(row.date))}: ${row.score.toFixed(1)}${change}`,
        );
      }
      previous = row.score;
    }
    if (previous != null)
      segment.push(`${chart.x(end - start)},${chart.y(previous)}`);
    flush();
  };
  draw();
  window.addEventListener("resize", draw);
});
