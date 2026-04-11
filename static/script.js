// =========================================================================
// Jacksonville, FL Cafe & Wifi - Frontend Script
// =========================================================================
// This file handles ALL data fetching and DOM rendering.
// The HTML page is a static shell; everything is populated
// by making fetch() calls to the REST API.
//
// API calls used:
//   GET  /api/cafes       - Load all cafes on page load
//   GET  /api/random      - "Feeling Lucky" feature
//   POST /api/add         - Add a new cafe via modal form
//   DELETE /api/delete/:id - Remove a cafe
// =========================================================================


// ── DOM References ──────────────────────────────────────────────────────────

const grid = document.getElementById('grid');
const statsEl = document.getElementById('stats');
const searchInput = document.getElementById('search');
const locationFilter = document.getElementById('locationFilter');
const pills = document.querySelectorAll('.pill[data-filter]');
const toastEl = document.getElementById('toast');

// Stores the full cafe list fetched from the API (used for client-side filtering)
let allCafes = [];

// Tracks which amenity filters are currently active
const activeFilters = new Set();


// ── Initial Load ────────────────────────────────────────────────────────────

/**
 * Fetches all cafes from the API and renders the page.
 * Called once on page load and again after adding/deleting a cafe.
 */
async function loadCafes() {
    try {
        const response = await fetch('/api/cafes');
        const data = await response.json();
        allCafes = data.cafes;

        // Populate the location dropdown from the data itself
        populateLocations();

        // Render the cards and apply any active filters
        applyFilters();
    } catch (err) {
        grid.innerHTML = '<div class="empty"><p>Failed to load cafes. Is the server running?</p></div>';
        console.error('Error loading cafes:', err);
    }
}


// ── Location Dropdown ───────────────────────────────────────────────────────

/**
 * Extracts unique neighbourhood names from the cafe data
 * and populates the location <select> dropdown.
 */
function populateLocations() {
    // Get unique locations, sorted alphabetically
    const locations = [...new Set(allCafes.map(c => c.location))].sort();

    // Keep the "All areas" default option, then add one option per location
    locationFilter.innerHTML = '<option value="">All areas</option>';
    locations.forEach(loc => {
        locationFilter.innerHTML += `<option value="${loc}">${loc}</option>`;
    });
}


// ── Card Rendering ──────────────────────────────────────────────────────────

/**
 * Builds the HTML for a single cafe card.
 * The image uses an onerror fallback: if the URL is dead, the <img> removes
 * itself, revealing the coffe emoji (☕) & gradient underneath (handled by CSS).
 */
function createCard(cafe, index) {
    // Helper to generate an amenity tag with yes/no styling
    const amenityTag = (label, icon, value) =>
        `<span class="amenity ${value ? 'yes' : 'no'}">${icon} ${label}</span>`;

    return `
        <div class="card" style="animation-delay: ${index * 0.03}s">
            <div class="card-img">
                <img src="${cafe.img_url}" alt="${cafe.name}" onerror="this.remove()">
                <span class="location-badge">📍 ${cafe.location}</span>
            </div>
            <div class="card-body">
                <h3>${cafe.name}</h3>
                <div class="amenities">
                    ${amenityTag('Wifi', '☑', cafe.has_wifi)}
                    ${amenityTag('Sockets', '⚡', cafe.has_sockets)}
                    ${amenityTag('Toilet', '🚻', cafe.has_toilet)}
                    ${amenityTag('Calls', '📞', cafe.can_take_calls)}
                    ${cafe.seats ? `<span class="amenity yes">🪑 ${cafe.seats} seats</span>` : ''}
                </div>
                <div class="card-footer">
                    <span class="price">${cafe.coffee_price || '—'}</span>
                    <div class="card-actions">
                        <a href="${cafe.map_url}" target="_blank" rel="noopener">Map ↗</a>
                        <button class="btn-del" onclick="confirmDelete(${cafe.id}, '${cafe.name.replace(/'/g, "\\'")}')">Remove</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}


// ── Filtering (client-side) ─────────────────────────────────────────────────

/**
 * Filters the in-memory cafe list by:
 *   - Search text (matches cafe name)
 *   - Selected neighbourhood
 *   - Active amenity toggles (wifi, sockets, calls)
 * Then re-renders the grid with matching results.
 */
function applyFilters() {
    const query = searchInput.value.toLowerCase();
    const selectedLocation = locationFilter.value;

    const filtered = allCafes.filter(cafe => {
        // Name search
        const matchName = cafe.name.toLowerCase().includes(query);

        // Location filter
        const matchLocation = !selectedLocation || cafe.location === selectedLocation;

        // Amenity filters: each active filter must be true on the cafe
        let matchAmenities = true;
        activeFilters.forEach(field => {
            if (!cafe[field]) matchAmenities = false;
        });

        return matchName && matchLocation && matchAmenities;
    });

    // Render the matching cards into the grid
    if (filtered.length === 0) {
        grid.innerHTML = '<div class="empty"><p>No cafes match your filters.</p></div>';
    } else {
        grid.innerHTML = filtered.map((cafe, i) => createCard(cafe, i)).join('');
    }

    // Update the stats counter
    statsEl.innerHTML = `Showing <strong>${filtered.length}</strong> of <strong>${allCafes.length}</strong> cafes`;
}


// ── Event Listeners: Search & Filters ───────────────────────────────────────

searchInput.addEventListener('input', applyFilters);
locationFilter.addEventListener('change', applyFilters);

// Toggle amenity filter pills on/off
pills.forEach(pill => {
    pill.addEventListener('click', () => {
        const field = pill.dataset.filter;
        pill.classList.toggle('active');
        activeFilters.has(field) ? activeFilters.delete(field) : activeFilters.add(field);
        applyFilters();
    });
});


// ── "Feeling Lucky" Feature ─────────────────────────────────────────────────

/**
 * Calls GET /api/random to fetch a single random cafe,
 * then displays it in a spotlight modal.
 */
document.getElementById('luckyBtn').addEventListener('click', async () => {
    try {
        const response = await fetch('/api/random');
        const data = await response.json();
        const cafe = data.cafe;

        // Helper for amenity tags (reused from card rendering)
        const tag = (label, icon, value) =>
            `<span class="amenity ${value ? 'yes' : 'no'}">${icon} ${label}</span>`;

        // Build the spotlight content
        document.getElementById('luckyContent').innerHTML = `
            <h2>🎲 Your Lucky Pick</h2>
            <img class="lucky-img" src="${cafe.img_url}" alt="${cafe.name}"
                 onerror="this.outerHTML='<div class=\\'lucky-fallback\\'>☕</div>'">
            <div class="lucky-name">${cafe.name}</div>
            <div class="lucky-location">📍 ${cafe.location}</div>
            <div class="amenities">
                ${tag('Wifi', '☑', cafe.has_wifi)}
                ${tag('Sockets', '⚡', cafe.has_sockets)}
                ${tag('Toilet', '🚻', cafe.has_toilet)}
                ${tag('Calls', '📞', cafe.can_take_calls)}
                ${cafe.seats ? `<span class="amenity yes">🪑 ${cafe.seats} seats</span>` : ''}
            </div>
            <div class="lucky-footer">
                <span class="price">${cafe.coffee_price || '—'}</span>
                <a href="${cafe.map_url}" target="_blank" rel="noopener">View on Map ↗</a>
            </div>
        `;

        document.getElementById('luckyOverlay').classList.add('open');
    } catch (err) {
        showToast('Failed to fetch a random cafe.');
        console.error(err);
    }
});

function closeLucky() {
    document.getElementById('luckyOverlay').classList.remove('open');
}

// Close lucky modal when clicking the backdrop
document.getElementById('luckyOverlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeLucky();
});


// ── Add Cafe (Modal + API Call) ─────────────────────────────────────────────

document.getElementById('addBtn').addEventListener('click', openModal);

function openModal() {
    document.getElementById('addModal').classList.add('open');
    // Clear any previous feedback message
    const fb = document.getElementById('addFeedback');
    fb.className = 'feedback';
    fb.textContent = '';
}

function closeModal() {
    document.getElementById('addModal').classList.remove('open');
}

// Close modal when clicking the backdrop
document.getElementById('addModal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
});

/**
 * Handles the Add Cafe form submission.
 * Sends a POST request to /api/add with JSON body,
 * then refreshes the cafe list on success.
 */
document.getElementById('addForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const form = e.target;
    const fb = document.getElementById('addFeedback');

    // Build the JSON payload from form fields
    const payload = {
        name: form.name.value,
        location: form.location.value,
        map_url: form.map_url.value,
        img_url: form.img_url.value,
        coffee_price: form.coffee_price.value.trim(),
        seats: form.seats.value.trim(),
        has_wifi: form.has_wifi.checked,
        has_sockets: form.has_sockets.checked,
        has_toilet: form.has_toilet.checked,
        can_take_calls: form.can_take_calls.checked,
    };

    // ── Client-side validation for price and seats ──

    // Price must be in $X.XX format (e.g. $2.80, $3, $12.50) or left empty
    if (payload.coffee_price && !/^\$\d+(\.\d{1,2})?$/.test(payload.coffee_price)) {
        fb.className = 'feedback error';
        fb.textContent = 'Coffee price must be in $ format (e.g. $2.80).';
        return;
    }

    // Seats must be a number (50) or a range (20-30) or left empty
    if (payload.seats && !/^\d+(-\d+)?$/.test(payload.seats)) {
        fb.className = 'feedback error';
        fb.textContent = 'Seats must be a number (e.g. 50) or range (e.g. 20-30).';
        return;
    }

    try {
        const response = await fetch('/api/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (response.ok) {
            // Show success feedback, reset form, reload the list
            fb.className = 'feedback success';
            fb.textContent = data.response.success;
            form.reset();
            await loadCafes();

            // Close modal after a short delay so the user sees the feedback
            setTimeout(() => closeModal(), 1200);
            showToast(`☕ ${payload.name} added!`);
        } else {
            // Show API error message
            const errMsg = Object.values(data.error)[0];
            fb.className = 'feedback error';
            fb.textContent = errMsg;
        }
    } catch (err) {
        fb.className = 'feedback error';
        fb.textContent = 'Network error. Is the server running?';
        console.error(err);
    }
});


// ── Delete Cafe (Confirmation + API Call) ────────────────────────────────────

let pendingDeleteId = null;

/**
 * Opens the delete confirmation dialog.
 * Stores the cafe ID so the confirm button knows what to delete.
 */
function confirmDelete(id, name) {
    pendingDeleteId = id;
    document.getElementById('confirmText').textContent = `"${name}" will be permanently removed.`;
    document.getElementById('confirmOverlay').classList.add('open');
}

function closeConfirm() {
    document.getElementById('confirmOverlay').classList.remove('open');
    pendingDeleteId = null;
}

// Close confirm dialog when clicking the backdrop
document.getElementById('confirmOverlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeConfirm();
});

/**
 * Sends DELETE /api/delete/<id> when the user confirms removal.
 * Reloads the full cafe list on success.
 */
document.getElementById('confirmYes').addEventListener('click', async () => {
    if (!pendingDeleteId) return;

    try {
        const response = await fetch(`/api/delete/${pendingDeleteId}`, {
            method: 'DELETE',
        });

        const data = await response.json();

        if (response.ok) {
            showToast(data.response.success);
            await loadCafes();
        } else {
            const errMsg = Object.values(data.error)[0];
            showToast(errMsg);
        }
    } catch (err) {
        showToast('Network error during deletion.');
        console.error(err);
    }

    closeConfirm();
});


// ── Toast Notifications ─────────────────────────────────────────────────────

/**
 * Shows a brief toast message at the bottom of the screen.
 * Auto-hides after 3 seconds.
 */
function showToast(message) {
    toastEl.textContent = message;
    toastEl.classList.add('show');
    setTimeout(() => toastEl.classList.remove('show'), 3000);
}


// ── Kick it off ─────────────────────────────────────────────────────────────

loadCafes();
