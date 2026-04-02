// app.js
Dropzone.autoDiscover = false;

function normalizeKey(key) {
  return key.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

function formatPercent(value) {
  const pct = value <= 1 ? value * 100 : value;
  return `${pct.toFixed(2)}%`;
}

function setLoading(isLoading) {
  const $btn = $("#submitBtn");
  if (isLoading) {
    $btn.attr("disabled", true).attr("aria-busy", "true").text("Classifying...");
  } else {
    $btn.attr("disabled", false).removeAttr("aria-busy").text("Classify Player");
  }
}

function showError() {
  $("#results").addClass("hidden");
  $("#error").removeClass("hidden");
}

function showResults() {
  $("#error").addClass("hidden");
  $("#results").removeClass("hidden");
}

/* --------------------------------------
   Routes to player-specific HTML pages
   Place these files under /out/
   -------------------------------------- */
const playerRoutes = {
  lionel_messi: "messi.html",
  ronaldo: "ronaldo.html",
  mbappe: "mbappe.html",
  jude_bellingham: "jude_bellingham.html",

  // Handle common misspellings just in case
  judebelligham: "jude_bellingham.html",
  kylian_mbappe: "mbappe.html",
  cristiano_ronaldo: "ronaldo.html",
};

/* --------------------------------------
   UI builders
   -------------------------------------- */
function buildPredictedCard(name, imgSrc, key) {
  const safeName = name || "Unknown";
  const safeImg = imgSrc || "./images/upload.png";

  // If we have a route for this player, show button
  const routeKey = playerRoutes[key] ? key : playerRoutes[normalizeKey(safeName)] ? normalizeKey(safeName) : null;
  const hasRoute = !!routeKey;
  const routeHref = hasRoute ? playerRoutes[routeKey] : "#";

  return `
    <div class="predicted-card text-center reveal">
      <div class="avatar">
        <img src="${safeImg}" alt="${safeName}" class="w-full h-full object-cover" />
      </div>
      <div class="name">${safeName}</div>
      <div class="mt-1 text-sm text-gray-500">Top prediction</div>

      ${
        hasRoute
          ? `<a href="${routeHref}" target="_blank" rel="noopener"
                class="mt-4 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-gray-200 hover:border-gray-300 shadow-sm text-sm font-medium">
                Player page
             </a>`
          : ``
      }
    </div>
  `;
}

function fillProbTable(classDict, classProb) {
  $("#score_lionel_messi").html("");
  $("#score_ronaldo").html("");
  $("#score_jude_bellingham").html("");
  $("#score_mbappe").html("");

  for (const personName in classDict) {
    const idx = classDict[personName];
    const score = classProb[idx];
    const elId = "#score_" + normalizeKey(personName);
    if ($(elId).length) {
      $(elId).html(formatPercent(score));
    }
  }
}

function highlightTopCard(key) {
  $(".player-card").removeClass("is-selected");
  if (key) {
    $(`.player-card[data-player="${key}"]`).addClass("is-selected");
  }
}

/* --------------------------------------
   Dropzone + classification
   -------------------------------------- */
function init() {
  let currentFile = null;

  const dz = new Dropzone("#dropzone", {
    url: "/",
    maxFiles: 1,
    maxFilesize: 10,
    acceptedFiles: "image/*",
    addRemoveLinks: true,
    dictDefaultMessage: "Drop an image here to classify",
    autoProcessQueue: false,
    thumbnailWidth: 160,
    thumbnailHeight: 160,
  });

  dz.on("addedfile", function (file) {
    if (dz.files[1]) dz.removeFile(dz.files[0]);
    currentFile = file;
  });

  dz.on("removedfile", function (file) {
    if (currentFile === file) currentFile = null;
  });

  $("#submitBtn").on("click", function () {
    if (!currentFile) {
      showError();
      return;
    }

    setLoading(true);

    const reader = new FileReader();
    reader.onload = function (e) {
      const imageData = e.target.result;

      $.post("http://127.0.0.1:5000/classify_image", { image_data: imageData })
        .done(function (data) {
          if (!data || !data.length) {
            showError();
            return;
          }

          // Pick best match
          let match = null;
          let bestScore = -1;
          for (let i = 0; i < data.length; i++) {
            const maxScore = Math.max(...data[i].class_probability);
            if (maxScore > bestScore) {
              bestScore = maxScore;
              match = data[i];
            }
          }

          if (!match) {
            showError();
            return;
          }

          showResults();

          const key = normalizeKey(match.class);
          const imgSrc =
            $(`.player-card[data-player="${key}"] img`).attr("src") ||
            "./images/upload.png";

          $("#resultHolder")
            .html(buildPredictedCard(match.class, imgSrc, key))
            .addClass("reveal");

          fillProbTable(match.class_dictionary, match.class_probability);
          highlightTopCard(key);

          document
            .getElementById("results")
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        })
        .fail(function () {
          showError();
        })
        .always(function () {
          setLoading(false);
        });
    };

    reader.onerror = function () {
      setLoading(false);
      showError();
    };

    reader.readAsDataURL(currentFile);
  });
}

$(document).ready(function () {
  $("#error").addClass("hidden");
  $("#results").addClass("hidden");
  init();
});
