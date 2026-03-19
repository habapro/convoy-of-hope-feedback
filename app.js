const tabs = document.querySelectorAll(".tab");
const views = {
  submit: document.getElementById("submit-view"),
  dashboard: document.getElementById("dashboard-view"),
};

const form = document.getElementById("feedback-form");
const statusText = document.getElementById("form-status");
const feedbackList = document.getElementById("feedback-list");
const totalCount = document.getElementById("total-count");
const averageRating = document.getElementById("average-rating");
const refreshButton = document.getElementById("refresh-feedback");

const config = window.APP_CONFIG || {};
const isConfigured = Boolean(config.supabaseUrl && config.supabaseAnonKey);
const apiBase = isConfigured ? `${config.supabaseUrl}/rest/v1/feedback` : "";
const apiHeaders = isConfigured
  ? {
      apikey: config.supabaseAnonKey,
      Authorization: `Bearer ${config.supabaseAnonKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    }
  : {};

function setActiveTab(tabName) {
  tabs.forEach((tab) => {
    const active = tab.dataset.tab === tabName;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
  });

  Object.entries(views).forEach(([key, view]) => {
    const active = key === tabName;
    view.classList.toggle("is-active", active);
    view.setAttribute("aria-hidden", String(!active));
  });

  if (tabName === "dashboard") {
    loadFeedback();
  }
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function showSetupMessage() {
  feedbackList.innerHTML = '<div class="empty-state">Add your Supabase URL and anon key in config.js to enable feedback.</div>';
  statusText.textContent = "Update config.js with your Supabase details before publishing.";
}

async function loadFeedback() {
  if (!isConfigured) {
    totalCount.textContent = "0";
    averageRating.textContent = "0.0";
    showSetupMessage();
    return;
  }

  feedbackList.innerHTML = '<div class="empty-state">Loading feedback...</div>';

  try {
    const response = await fetch(`${apiBase}?select=category,rating,message,created_at&order=created_at.desc`, {
      headers: apiHeaders,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Unable to load feedback.");
    }

    const items = await response.json();
    totalCount.textContent = String(items.length);
    const average = items.length === 0 ? 0 : items.reduce((sum, item) => sum + Number(item.rating), 0) / items.length;
    averageRating.textContent = average.toFixed(1);

    if (items.length === 0) {
      feedbackList.innerHTML = '<div class="empty-state">No anonymous feedback has been submitted yet.</div>';
      return;
    }

    feedbackList.innerHTML = items
      .map((item) => `
        <article class="feedback-card">
          <h3>${escapeHtml(item.category)}</h3>
          <div class="feedback-meta">
            <span>Rating: ${item.rating}/5</span>
            <span>${new Date(item.created_at).toLocaleString()}</span>
            <span>Sender: Hidden</span>
          </div>
          <p>${escapeHtml(item.message)}</p>
        </article>
      `)
      .join("");
  } catch {
    feedbackList.innerHTML = '<div class="empty-state">Could not load feedback right now.</div>';
  }
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => setActiveTab(tab.dataset.tab));
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!isConfigured) {
    statusText.textContent = "Add your Supabase details in config.js first.";
    return;
  }

  statusText.textContent = "Submitting...";
  const formData = new FormData(form);
  const payload = {
    category: String(formData.get("category")),
    rating: Number(formData.get("rating")),
    message: String(formData.get("message")).trim(),
  };

  if (!payload.category || !payload.rating || !payload.message) {
    statusText.textContent = "Please complete all fields.";
    return;
  }

  try {
    const response = await fetch(apiBase, {
      method: "POST",
      headers: apiHeaders,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error("Submit failed");
    }

    form.reset();
    statusText.textContent = "Feedback submitted anonymously.";
    loadFeedback();
  } catch {
    statusText.textContent = "Could not submit feedback right now.";
  }
});

refreshButton.addEventListener("click", loadFeedback);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {
      // Ignore service worker errors so the app still loads normally.
    });
  });
}

loadFeedback();
