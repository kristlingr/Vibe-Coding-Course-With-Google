// State management
let allUpdates = [];
let filteredUpdates = [];
let currentFilter = 'all';
let currentSearchQuery = '';

// DOM Elements
const refreshBtn = document.getElementById('refresh-btn');
const refreshIcon = document.getElementById('refresh-icon');
const searchInput = document.getElementById('search-input');
const filterButtons = document.querySelectorAll('.filter-btn');
const statCards = document.querySelectorAll('.stat-card');
const releasesFeed = document.getElementById('releases-feed');
const loadingSpinner = document.getElementById('loading-spinner');
const errorState = document.getElementById('error-state');
const errorMessage = document.getElementById('error-message');
const retryBtn = document.getElementById('retry-btn');
const emptyState = document.getElementById('empty-state');

// Stat values
const statTotal = document.getElementById('stat-total');
const statFeatures = document.getElementById('stat-features');
const statBreaking = document.getElementById('stat-breaking');
const statIssues = document.getElementById('stat-issues');

// Tweet Modal Elements
const tweetModal = document.getElementById('tweet-modal');
const tweetTextarea = document.getElementById('tweet-textarea');
const charCurrent = document.getElementById('char-current');
const charMax = document.getElementById('char-max');
const charWarning = document.getElementById('char-warning');
const closeModalBtn = document.getElementById('close-modal-btn');
const cancelModalBtn = document.getElementById('cancel-modal-btn');
const shareTweetBtn = document.getElementById('share-tweet-btn');

// Page Load
document.addEventListener('DOMContentLoaded', () => {
  fetchReleaseNotes();
  setupEventListeners();
});

// Setup Event Listeners
function setupEventListeners() {
  // Refresh functionality
  refreshBtn.addEventListener('click', fetchReleaseNotes);
  retryBtn.addEventListener('click', fetchReleaseNotes);

  // Search input change
  searchInput.addEventListener('input', (e) => {
    currentSearchQuery = e.target.value.toLowerCase().trim();
    filterAndRender();
  });

  // Category filter buttons
  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      filterButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.type;
      filterAndRender();
    });
  });

  // Stats cards filter triggers
  statCards.forEach(card => {
    card.addEventListener('click', () => {
      const filterType = card.dataset.filter;
      // Sync active button
      filterButtons.forEach(btn => {
        if (btn.dataset.type === filterType) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
      currentFilter = filterType;
      filterAndRender();
    });
  });

  // Modal close listeners
  closeModalBtn.addEventListener('click', hideTweetModal);
  cancelModalBtn.addEventListener('click', hideTweetModal);
  tweetModal.addEventListener('click', (e) => {
    if (e.target === tweetModal) hideTweetModal();
  });

  // Textarea character count
  tweetTextarea.addEventListener('input', () => {
    updateCharacterCount();
  });

  // Share tweet
  shareTweetBtn.addEventListener('click', publishTweet);
}

// Fetch releases from Python backend
async function fetchReleaseNotes() {
  showLoading(true);
  showError(false);
  showEmpty(false);

  try {
    const response = await fetch('/api/releases');
    const data = await response.json();

    if (data.success) {
      processFeedData(data.entries);
      updateStats();
      filterAndRender();
    } else {
      throw new Error(data.error || 'Failed to fetch release notes from API');
    }
  } catch (error) {
    console.error('Error fetching release notes:', error);
    errorMessage.textContent = error.message || 'Check your backend server connection.';
    showError(true);
  } finally {
    showLoading(false);
  }
}

// Show/Hide Spinner & Icons
function showLoading(isLoading) {
  if (isLoading) {
    loadingSpinner.classList.remove('hidden');
    releasesFeed.classList.add('hidden');
    refreshIcon.classList.add('fa-spin');
    refreshBtn.disabled = true;
  } else {
    loadingSpinner.classList.add('hidden');
    releasesFeed.classList.remove('hidden');
    refreshIcon.classList.remove('fa-spin');
    refreshBtn.disabled = false;
  }
}

function showError(show) {
  if (show) {
    errorState.classList.remove('hidden');
    releasesFeed.classList.add('hidden');
  } else {
    errorState.classList.add('hidden');
  }
}

function showEmpty(show) {
  if (show) {
    emptyState.classList.remove('hidden');
  } else {
    emptyState.classList.add('hidden');
  }
}

// Process XML Atom entries into discrete updates
function processFeedData(entries) {
  allUpdates = [];

  entries.forEach(entry => {
    const date = entry.title; // e.g. "June 15, 2026"
    const sourceLink = entry.link;
    const contentHtml = entry.content;

    // Parse sub-items inside each entry's HTML
    const subUpdates = parseEntryContent(contentHtml);
    subUpdates.forEach(sub => {
      allUpdates.push({
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
        date: date,
        type: sub.type, // Feature, Change, Issue, Announcement, Breaking
        html: sub.html,
        text: sub.text,
        sourceLink: sourceLink
      });
    });
  });
}

// Helper to strip HTML tags and format text for tweet
function stripHtml(html) {
  const temp = document.createElement('div');
  temp.innerHTML = html;
  
  // Convert <a> tags to their text + URL format or just extract plain text
  // Replace links with text format
  const links = temp.querySelectorAll('a');
  links.forEach(a => {
    if (a.href) {
      a.replaceWith(`${a.textContent} (${a.href})`);
    }
  });

  return temp.textContent.trim().replace(/\s+/g, ' ');
}

// Parse sub-components from Google Release XML structure
function parseEntryContent(contentHtml) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(contentHtml, 'text/html');
  const updates = [];

  const children = Array.from(doc.body.children);
  
  let currentType = null;
  let currentHtml = '';

  children.forEach(child => {
    if (child.tagName === 'H3') {
      // If we have an active type, save it before starting next
      if (currentType && currentHtml.trim() !== '') {
        updates.push({
          type: currentType,
          html: currentHtml,
          text: stripHtml(currentHtml)
        });
      }
      currentType = child.textContent.trim();
      currentHtml = '';
    } else {
      currentHtml += child.outerHTML;
    }
  });

  // Push last parsed item
  if (currentType && currentHtml.trim() !== '') {
    updates.push({
      type: currentType,
      html: currentHtml,
      text: stripHtml(currentHtml)
    });
  }

  // Fallback if no <h3> tags found
  if (updates.length === 0 && doc.body.innerHTML.trim() !== '') {
    updates.push({
      type: 'Update',
      html: doc.body.innerHTML,
      text: stripHtml(doc.body.innerHTML)
    });
  }

  return updates;
}

// Calculate and render stats in Header cards
function updateStats() {
  const total = allUpdates.length;
  const features = allUpdates.filter(u => u.type.toLowerCase() === 'feature').length;
  const breaking = allUpdates.filter(u => u.type.toLowerCase() === 'breaking').length;
  const issues = allUpdates.filter(u => u.type.toLowerCase() === 'issue').length;

  statTotal.textContent = total;
  statFeatures.textContent = features;
  statBreaking.textContent = breaking;
  statIssues.textContent = issues;
}

// Filter updates based on Sidebar selection + Search queries
function filterAndRender() {
  filteredUpdates = allUpdates.filter(update => {
    // 1. Filter by category type
    const matchesFilter = currentFilter === 'all' || update.type.toLowerCase() === currentFilter;
    
    // 2. Filter by search query
    const matchesSearch = currentSearchQuery === '' || 
      update.type.toLowerCase().includes(currentSearchQuery) || 
      update.date.toLowerCase().includes(currentSearchQuery) || 
      update.text.toLowerCase().includes(currentSearchQuery);

    return matchesFilter && matchesSearch;
  });

  renderUpdates();
}

// Render filtered updates to the DOM
function renderUpdates() {
  releasesFeed.innerHTML = '';
  
  if (filteredUpdates.length === 0) {
    showEmpty(true);
    return;
  }
  
  showEmpty(false);

  // Group by Date for cleaner presentation
  const groupedByDate = {};
  filteredUpdates.forEach(update => {
    if (!groupedByDate[update.date]) {
      groupedByDate[update.date] = [];
    }
    groupedByDate[update.date].push(update);
  });

  // Render grouped items
  for (const date in groupedByDate) {
    // Group Header
    const groupHeader = document.createElement('div');
    groupHeader.className = 'date-group-header';
    groupHeader.innerHTML = `<i class="fa-regular fa-calendar"></i> ${date}`;
    releasesFeed.appendChild(groupHeader);

    // Cards in group
    groupedByDate[date].forEach(update => {
      const card = document.createElement('article');
      card.className = 'release-card';
      
      const badgeClass = getBadgeClass(update.type);
      
      card.innerHTML = `
        <div class="card-header">
          <span class="badge ${badgeClass}">${update.type}</span>
          <span class="release-date">${update.date}</span>
        </div>
        <div class="card-body">
          ${update.html}
        </div>
        <div class="card-actions">
          <a href="${update.sourceLink}" target="_blank" rel="noopener noreferrer" class="source-link">
            <span>Official Docs</span>
            <i class="fa-solid fa-arrow-up-right-from-square"></i>
          </a>
          <button class="btn btn-tweet" onclick="openTweetComposer('${update.id}')">
            <i class="fa-brands fa-x-twitter"></i> Post Update
          </button>
        </div>
      `;
      
      releasesFeed.appendChild(card);
    });
  }
}

// CSS Badge class map helper
function getBadgeClass(type) {
  const lowerType = type.toLowerCase();
  if (lowerType.includes('feature')) return 'badge-feature';
  if (lowerType.includes('change')) return 'badge-change';
  if (lowerType.includes('breaking')) return 'badge-breaking';
  if (lowerType.includes('issue')) return 'badge-issue';
  return 'badge-announcement';
}

// Find single update by ID
function findUpdateById(id) {
  return allUpdates.find(u => u.id === id);
}

// Open tweet composer with pre-filled content
window.openTweetComposer = function(updateId) {
  const update = findUpdateById(updateId);
  if (!update) return;

  // Design a nice clean pre-filled tweet format
  const emoji = getEmojiForType(update.type);
  const header = `BigQuery ${update.type} (${update.date}) ${emoji}\n\n`;
  const footer = `\n\nDocs: ${update.sourceLink}`;
  
  // Calculate remaining characters for the main body description
  const reservedLength = header.length + footer.length;
  const maxBodyLength = 280 - reservedLength - 5; // offset for ellipses
  
  let body = update.text;
  if (body.length > maxBodyLength) {
    body = body.substring(0, maxBodyLength).trim() + '...';
  }

  const defaultTweetText = `${header}"${body}"${footer}`;
  
  tweetTextarea.value = defaultTweetText;
  updateCharacterCount();
  
  tweetModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden'; // block page scrolling
};

function getEmojiForType(type) {
  const lowerType = type.toLowerCase();
  if (lowerType.includes('feature')) return '🚀';
  if (lowerType.includes('change')) return '🔄';
  if (lowerType.includes('breaking')) return '⚠️';
  if (lowerType.includes('issue')) return '🔧';
  return '📢';
}

function hideTweetModal() {
  tweetModal.classList.add('hidden');
  document.body.style.overflow = ''; // restore scrolling
}

// Calculate tweet length and warning state
function updateCharacterCount() {
  const currentLen = tweetTextarea.value.length;
  charCurrent.textContent = currentLen;
  
  const charCounterLabel = document.querySelector('.character-count');
  
  if (currentLen > 280) {
    charCounterLabel.classList.add('warning');
    charWarning.classList.remove('hidden');
    shareTweetBtn.disabled = true;
  } else {
    charCounterLabel.classList.remove('warning');
    charWarning.classList.add('hidden');
    shareTweetBtn.disabled = false;
  }
}

// Open Twitter intent URL to post
function publishTweet() {
  const text = tweetTextarea.value;
  if (text.length > 280) return;
  
  const tweetUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
  window.open(tweetUrl, '_blank', 'noopener,noreferrer,width=550,height=420');
  hideTweetModal();
}
