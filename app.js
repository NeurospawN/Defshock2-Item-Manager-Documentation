(function () {
  "use strict";

  var state = {
    headings: [],
    blocks: [],
    currentIndex: 0,
    query: "",
    suppressOutlineScrollUntil: 0,
    suppressUrlUntil: 0,
  };
  var documentElement = document.getElementById("document");
  var outline = document.getElementById("outline");
  var searchInput = document.getElementById("search-input");
  var searchStatus = document.getElementById("search-status");
  var highlightColorInput = document.getElementById("highlight-color");

  function applyHighlightColor(color) {
    document.documentElement.style.setProperty("--highlight-color", color);
    document.documentElement.style.setProperty("--warning", color);
    highlightColorInput.value = color;
    localStorage.setItem("documentation-highlight-color", color);
  }

  function loadHighlightColor() {
    var savedColor = localStorage.getItem("documentation-highlight-color");
    var color = savedColor && /^#[0-9a-f]{6}$/i.test(savedColor)
      ? savedColor
      : "#ed4038";

    applyHighlightColor(color);
  }

  function escapeHtml(value) {
    var entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return value.replace(/[&<>"']/g, function (character) {
      return entities[character];
    });
  }

  function inlineMarkdown(value) {
    var escaped = escapeHtml(value);
    escaped = escaped.replace(
      /!\[([^\]]*)\]\(([^\s)]+)(?:\s+"([^"]*)")?\)/g,
      '<img alt="$1" src="$2" loading="lazy">',
    );
    escaped = escaped.replace(
      /\[([^\]]+)\]\(([^\s)]+)(?:\s+"([^"]*)")?\)/g,
      '<a href="$2">$1</a>',
    );
    escaped = escaped.replace(/`([^`]+)`/g, "<code>$1</code>");
    escaped = escaped.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    escaped = escaped.replace(/__([^_]+)__/g, "<strong>$1</strong>");
    escaped = escaped.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    escaped = escaped.replace(/_([^_]+)_/g, "<em>$1</em>");
    return escaped;
  }

  function isLuauLanguage(language) {
    return /^(lua|luau)$/i.test(language);
  }

  function highlightLuau(value) {
    var protectedParts = [];
    var source = escapeHtml(value).replace(
      /(--[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g,
      function (match) {
        var type = match.indexOf("--") === 0 ? "comment" : "string";
        protectedParts.push(
          '<span class="token-' + type + '">' + match + "</span>",
        );
        return "\u0000" +
          String.fromCharCode(0xe000 + protectedParts.length - 1) +
          "\u0000";
      },
    );
    source = source.replace(
      /\b(local|function|end|if|then|else|elseif|for|while|do|return|and|or|not|nil|true|false|in|break|repeat|until|continue|type|export|typeof|self)\b/g,
      '<span class="token-keyword">$1</span>',
    );
    source = source.replace(
      /\b(game|workspace|script|Instance|Vector2|Vector3|CFrame|Color3|UDim2|Enum|TweenInfo|RaycastParams|task|math|string|table|coroutine|require|wait|spawn|delay)\b/g,
      '<span class="token-builtin">$1</span>',
    );
    source = source.replace(
      /\b(\d+(?:\.\d+)?)\b/g,
      '<span class="token-number">$1</span>',
    );
    source = source.replace(
      /\b([a-zA-Z_]\w*)(?=\s*\()/g,
      '<span class="token-function">$1</span>',
    );
    return source.replace(/\u0000([\ue000-\uf8ff])\u0000/g, function (_, marker) {
      return protectedParts[marker.charCodeAt(0) - 0xe000];
    });
  }

  function renderMarkdown(markdown) {
    var lines = markdown.replace(/\r\n?/g, "\n").split("\n");
    var output = [],
      paragraph = [],
      listType = null,
      listItems = [],
      inCode = false,
      codeLanguage = "",
      codeLines = [];
    function flushParagraph() {
      if (paragraph.length) {
        output.push("<p>" + inlineMarkdown(paragraph.join(" ")) + "</p>");
        paragraph = [];
      }
    }
    function flushList() {
      if (!listItems.length) return;
      output.push(
        "<" +
          listType +
          ">" +
          listItems
            .map(function (item) {
              return "<li>" + inlineMarkdown(item) + "</li>";
            })
            .join("") +
          "</" +
          listType +
          ">",
      );
      listItems = [];
      listType = null;
    }
    function flushCode() {
      var luauBlock = isLuauLanguage(codeLanguage);
      var languageLabel = luauBlock ? "Luau" : codeLanguage;
      output.push(
        '<div class="code-block">' +
          (languageLabel
            ? '<span class="code-label">' + escapeHtml(languageLabel) + "</span>"
            : "") +
          "<pre><code>" +
          (luauBlock
            ? highlightLuau(codeLines.join("\n"))
            : escapeHtml(codeLines.join("\n"))) +
          "</code></pre></div>",
      );
      codeLines = [];
      codeLanguage = "";
    }
    for (var lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      var line = lines[lineIndex];
      var fence = line.match(/^\s*```\s*([\w-]*)\s*$/);
      if (fence && !inCode) {
        flushParagraph();
        flushList();
        inCode = true;
        codeLanguage = fence[1];
        continue;
      }
      if (inCode) {
        if (/^\s*```\s*$/.test(line)) {
          flushCode();
          inCode = false;
        } else codeLines.push(line);
        continue;
      }
      var heading = line.match(/^(#{1,4})\s+(.+?)\s*#*$/);
      var list = line.match(/^\s*([-*+] |\d+\. )(.+)$/);
      if (heading) {
        flushParagraph();
        flushList();
        var level = heading[1].length;
        var text = heading[2];
        var id = slugify(text);
        state.headings.push({
          id: id,
          text: stripMarkdown(text),
          level: level,
        });
        output.push(
          "<h" +
            level +
            ' id="' +
            id +
            '">' +
            inlineMarkdown(text) +
            "</h" +
            level +
            ">",
        );
        continue;
      }
      if (list) {
        flushParagraph();
        var nextType = /^\d/.test(list[1]) ? "ol" : "ul";
        if (listType && listType !== nextType) flushList();
        listType = listType || nextType;
        listItems.push(list[2]);
        continue;
      }
      if (/^\s*>/.test(line)) {
        flushParagraph();
        flushList();
        output.push(
          "<blockquote><p>" +
            inlineMarkdown(line.replace(/^\s*>\s?/, "")) +
            "</p></blockquote>",
        );
        continue;
      }
      if (/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
        flushParagraph();
        flushList();
        output.push("<hr>");
        continue;
      }
      if (!line.trim()) {
        flushParagraph();
        flushList();
        continue;
      }
      if (
        /^\s*\|/.test(line) &&
        lines[lineIndex + 1] &&
        /^\s*\|?\s*:?-+:?/.test(lines[lineIndex + 1])
      ) {
        flushParagraph();
        flushList();
        var headers = line
          .split("|")
          .slice(1, -1)
          .map(function (cell) {
            return cell.trim();
          });
        var rows = [];
        lineIndex += 2;
        while (lineIndex < lines.length && /^\s*\|/.test(lines[lineIndex])) {
          rows.push(
            lines[lineIndex]
              .split("|")
              .slice(1, -1)
              .map(function (cell) {
                return cell.trim();
              }),
          );
          lineIndex++;
        }
        lineIndex--;
        output.push(
          "<table><thead><tr>" +
            headers
              .map(function (cell) {
                return "<th>" + inlineMarkdown(cell) + "</th>";
              })
              .join("") +
            "</tr></thead><tbody>" +
            rows
              .map(function (row) {
                return (
                  "<tr>" +
                  headers
                    .map(function (_, cellIndex) {
                      return (
                        "<td>" + inlineMarkdown(row[cellIndex] || "") + "</td>"
                      );
                    })
                    .join("") +
                  "</tr>"
                );
              })
              .join("") +
            "</tbody></table>",
        );
        continue;
      }
      paragraph.push(line.trim());
    }
    if (inCode) flushCode();
    flushParagraph();
    flushList();
    return output.join("\n");
  }

  function slugify(value) {
    var slug = stripMarkdown(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    var base = slug || "section";
    var id = base;
    var count = 2;
    while (
      state.headings.some(function (heading) {
        return heading.id === id;
      })
    )
      id = base + "-" + count++;
    return id;
  }
  function stripMarkdown(value) {
    return value.replace(/[`*_\[\]()]/g, "").trim();
  }

  function buildOutline() {
    outline.innerHTML = state.headings
      .map(function (heading) {
        return (
          '<a class="level-' +
          heading.level +
          '" href="#' +
          heading.id +
          '" data-id="' +
          heading.id +
          '">' +
          escapeHtml(heading.text) +
          "</a>"
        );
      })
      .join("");
    document.getElementById("section-count").textContent =
      state.headings.length +
      (state.headings.length === 1 ? " section" : " sections");
  }
  function updateSectionUrl(id) {
    var hash = "#" + encodeURIComponent(id);
    if (window.location.hash !== hash) {
      history.replaceState(null, "", hash);
    }
  }

  function setActive(index, scrollOutline, updateUrl, forceUrl) {
    state.currentIndex = Math.max(0, index);
    if (
      updateUrl !== false &&
      (forceUrl || performance.now() >= state.suppressUrlUntil)
    ) {
      updateSectionUrl(state.headings[state.currentIndex].id);
    }
    document.querySelectorAll(".outline a").forEach(function (link) {
      link.classList.toggle(
        "active",
        link.dataset.id === state.headings[state.currentIndex].id,
      );
    });

    var shouldScrollOutline = scrollOutline !== false &&
      performance.now() >= state.suppressOutlineScrollUntil;

    if (shouldScrollOutline) {
      var activeLink = outline.querySelector(
        'a[data-id="' + state.headings[state.currentIndex].id + '"]',
      );
      if (activeLink) {
        activeLink.scrollIntoView({ behavior: "auto", block: "nearest" });
      }
    }
  }

  function jumpToHeading(id, behavior, scrollOutline) {
    var index = state.headings.findIndex(function (heading) {
      return heading.id === id;
    });
    var target = document.getElementById(id);

    if (index < 0 || !target) return false;
    if (scrollOutline === false) {
      state.suppressOutlineScrollUntil = performance.now() + 1200;
    }
    state.suppressUrlUntil = performance.now() + 1200;
    setActive(index, scrollOutline, true, true);
    target.scrollIntoView({ behavior: behavior || "smooth", block: "start" });
    return true;
  }

  function positionAtUrlSection() {
    var hash = window.location.hash.slice(1);
    if (!hash) {
      if (state.headings.length) setActive(0, undefined, false);
      return;
    }

    var id;
    try {
      id = decodeURIComponent(hash);
    } catch (error) {
      id = hash;
    }

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        jumpToHeading(id, "auto");
      });
    });
  }

  function flashOutlineLink(id) {
    var link = outline.querySelector('a[data-id="' + id + '"]');
    if (!link) return;

    link.classList.remove("index-flash");
    void link.offsetWidth;
    link.classList.add("index-flash");
    link.addEventListener("animationend", function () {
      link.classList.remove("index-flash");
    }, { once: true });
  }
  function setupObservers() {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            var index = state.headings.findIndex(function (heading) {
              return heading.id === entry.target.id;
            });
            if (index >= 0) setActive(index);
          }
        });
      },
      { rootMargin: "-100px 0px -65% 0px" },
    );
    state.headings.forEach(function (heading) {
      var element = document.getElementById(heading.id);
      if (element) observer.observe(element);
    });
  }
  function updateProgress() {
    var scrollable = document.documentElement.scrollHeight - window.innerHeight;
    var progress = scrollable ? Math.min(1, window.scrollY / scrollable) : 0;
    document.getElementById("progress-bar").style.transform =
      "scaleX(" + progress + ")";
    document.getElementById("progress-label").textContent =
      Math.round(progress * 100) + "% read";
    document
      .getElementById("back-to-top")
      .classList.toggle("visible", window.scrollY > 500);
  }
  function clearSearchHighlights() {
    document.querySelectorAll(".search-hit").forEach(function (node) {
      node.replaceWith(document.createTextNode(node.textContent));
    });
  }

  function getSearchTerms(query) {
    return query
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
  }

  function highlightContainer(container, terms) {
    if (!terms.length) return;
    var expression = new RegExp(
      terms
        .slice()
        .sort(function (first, second) {
          return second.length - first.length;
        })
        .map(function (term) {
          return term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        })
        .join("|"),
      "gi",
    );
    var walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    var nodes = [];
    var node;
    while ((node = walker.nextNode())) nodes.push(node);
    nodes.forEach(function (textNode) {
      if (
        !textNode.nodeValue.trim() ||
        textNode.parentElement.closest(".search-hit")
      )
        return;
      var text = textNode.nodeValue;
      if (!terms.some(function (term) {
        return text.toLowerCase().indexOf(term) !== -1;
      })) return;
      var fragment = document.createDocumentFragment();
      var cursor = 0;
      text.replace(expression, function (match, offset) {
        fragment.appendChild(
          document.createTextNode(text.slice(cursor, offset)),
        );
        var hit = document.createElement("mark");
        hit.className = "search-hit";
        hit.textContent = match;
        fragment.appendChild(hit);
        cursor = offset + match.length;
      });
      fragment.appendChild(document.createTextNode(text.slice(cursor)));
      textNode.replaceWith(fragment);
    });
  }

  function highlightMatchingSections(matches, terms) {
    matches.forEach(function (match) {
      var heading = document.getElementById(match.id);
      var headingIndex = state.headings.findIndex(function (item) {
        return item.id === match.id;
      });
      var nextHeading = state.headings[headingIndex + 1];
      var element = heading;

      while (element && (!nextHeading || element.id !== nextHeading.id)) {
        highlightContainer(element, terms);
        element = element.nextElementSibling;
      }
    });
  }
  function search(query) {
    state.query = query.trim();
    clearSearchHighlights();
    if (!state.query) {
      searchStatus.hidden = true;
      searchStatus.innerHTML = "";
      return;
    }
    var terms = getSearchTerms(state.query);
    var matches = state.blocks.filter(function (block) {
      var blockText = block.text.toLowerCase();
      return terms.every(function (term) {
        return blockText.indexOf(term) !== -1;
      });
    });
    var resultLinks = matches
      .map(function (match) {
        return (
          '<a class="search-result" href="#' +
          match.id +
          '"><span class="search-result-title">' +
          escapeHtml(document.getElementById(match.id).textContent) +
          '</span><span class="search-result-preview">' +
          escapeHtml(match.text.replace(/\s+/g, " ").slice(0, 100)) +
          (match.text.length > 100 ? "..." : "") +
          "</span></a>"
        );
      })
      .join("");
    searchStatus.hidden = false;
    searchStatus.innerHTML =
      '<div class="search-summary"><strong>' +
      matches.length +
      "</strong> matching section" +
      (matches.length === 1 ? "" : "s") +
      " for <strong>" +
      escapeHtml(state.query) +
      "</strong></div>" +
      (resultLinks ||
        '<div class="search-empty">No matching topics found.</div>');
    highlightMatchingSections(matches, terms);
    highlightContainer(searchStatus, terms);
    searchStatus.scrollIntoView({ behavior: "auto", block: "start" });
  }
  function wireControls() {
    var timer;
    searchInput.addEventListener("input", function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        search(searchInput.value);
      }, 120);
    });
    searchStatus.addEventListener("click", function (event) {
      var result = event.target.closest(".search-result");
      if (!result) return;
      var target = document.getElementById(
        result.getAttribute("href").slice(1),
      );
      if (target) {
        event.preventDefault();
        var targetId = result.getAttribute("href").slice(1);
        if (jumpToHeading(targetId)) {
          history.replaceState(null, "", "#" + targetId);
        }
      }
    });
    outline.addEventListener("click", function (event) {
      var link = event.target.closest("a[href^=\"#\"]");
      if (!link) return;
      var targetId = link.getAttribute("href").slice(1);

      event.preventDefault();
      if (jumpToHeading(targetId, "smooth", false)) {
        flashOutlineLink(targetId);
        history.replaceState(null, "", "#" + targetId);
      }
    });
    window.addEventListener("hashchange", function () {
      jumpToHeading(window.location.hash.slice(1), "auto");
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "/" && document.activeElement !== searchInput) {
        event.preventDefault();
        searchInput.focus();
      }
    });
    window.addEventListener("scroll", updateProgress, { passive: true });
    document
      .getElementById("back-to-top")
      .addEventListener("click", function () {
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    document
      .getElementById("outline-toggle")
      .addEventListener("click", function () {
        var sidebar = document.getElementById("outline-panel");
        var open = sidebar.classList.toggle("open");
        this.setAttribute("aria-expanded", open);
      });
    highlightColorInput.addEventListener("input", function () {
      applyHighlightColor(this.value);
    });
    ["previous-section", "next-section"].forEach(function (id, direction) {
      document.getElementById(id).addEventListener("click", function () {
        var next = state.currentIndex + (direction ? 1 : -1);
        if (state.headings[next]) jumpToHeading(state.headings[next].id);
      });
    });
  }
  function setupNavigation() {
    var previous = document.getElementById("previous-section");
    var next = document.getElementById("next-section");
    function update() {
      previous.disabled = state.currentIndex <= 0;
      next.disabled = state.currentIndex >= state.headings.length - 1;
    }
    var original = setActive;
    setActive = function (index) {
      original(index);
      update();
    };
    update();
    loadHighlightColor();
  }
  function load() {
    fetch("documentation.md")
      .then(function (response) {
        if (!response.ok) throw new Error("Documentation could not be loaded.");
        return response.text();
      })
      .then(function (markdown) {
        state.headings = [];
        documentElement.innerHTML = renderMarkdown(markdown);
        var renderedChildren = Array.prototype.slice.call(
          documentElement.children,
        );
        state.blocks = state.headings.map(function (heading, index) {
          var start = renderedChildren.indexOf(
            document.getElementById(heading.id),
          );
          var end = state.headings[index + 1]
            ? renderedChildren.indexOf(
                document.getElementById(state.headings[index + 1].id),
              )
            : renderedChildren.length;
          return {
            id: heading.id,
            text: renderedChildren
              .slice(start, end)
              .map(function (element) {
                return element.textContent;
              })
              .join(" "),
          };
        });
        var firstHeading = state.headings[0];
        if (firstHeading) {
          document.getElementById("page-title").textContent = firstHeading.text;
          document.getElementById("document-meta").textContent =
            state.headings.length + " sections · Updated from documentation.md";
        }
        buildOutline();
        setupNavigation();
        setupObservers();
        wireControls();
        positionAtUrlSection();
        updateProgress();
      })
      .catch(function (error) {
        documentElement.innerHTML =
          '<div class="error-state"><strong>Unable to load documentation</strong><p>' +
          escapeHtml(error.message) +
          " Serve this folder through a local HTTP server, then reload.</p></div>";
      });
  }
  load();
})();
