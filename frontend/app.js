// Application Context
const state = {
    locations: [],
    currentResults: [],
    offset: 0,
    limit: 10,
    map: null,
    markers: [],
    routeLine: null,
    routingControl: null, // Leaflet Routing Machine control
    currentRestaurantCoords: null, // Store active coords for routing
    userLocation: null,   // {lat, lng}
    userId: 'guest_user_' + Math.floor(Math.random() * 10000), // Simple mock user ID
    isGpsMode: false
};

const API_BASE = 'https://gourmet-map-a-restaurant-recommendation.onrender.com/api';

// DOM Elements
const els = {
    countrySelect: document.getElementById('country-select'),
    citySelect: document.getElementById('city-select'),
    localitySelect: document.getElementById('locality-select'),
    searchBtn: document.getElementById('search-btn'),
    gpsBtn: document.getElementById('gps-btn'),
    applyFiltersBtn: document.getElementById('apply-filters-btn'),

    // Filters
    vegToggle: document.getElementById('veg-toggle'),
    cuisineFilter: document.getElementById('cuisine-filter'),
    priceFilter: document.getElementById('price-filter'),
    ratingFilter: document.getElementById('rating-filter'),
    priceValue: document.getElementById('price-value'),
    ratingValue: document.getElementById('rating-value'),

    // Views
    navSearch: document.getElementById('nav-search'),
    navHistory: document.getElementById('nav-history'),
    viewSearch: document.getElementById('view-search'),
    viewHistory: document.getElementById('view-history'),

    // Grids & Content
    restaurantGrid: document.getElementById('restaurant-grid'),
    historyGrid: document.getElementById('history-grid'),
    mainLoader: document.getElementById('main-loader'),
    loadMoreBtn: document.getElementById('load-more-btn'),
    resultsMetaText: document.getElementById('results-meta-text'),
};

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    fetchLocations();
    setupEventListeners();

    // Default search parameters if we want to show something initially
    // fetchRecommendations();
});

function initMap() {
    // Default to a central view (e.g. New Delhi as it has many Zomato entries)
    state.map = L.map('map-container').setView([28.6139, 77.2090], 11);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap - Gourmet Map'
    }).addTo(state.map);
}

// Fetch Location Data from API
async function fetchLocations() {
    try {
        const response = await fetch(`${API_BASE}/locations`);
        if (!response.ok) throw new Error("Failed to fetch locations");
        const data = await response.json();
        state.locations = data;

        // Extract unique countries
        const countries = [...new Set(data.map(item => item.Country))].filter(Boolean).sort();
        countries.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c;
            opt.textContent = c;
            els.countrySelect.appendChild(opt);
        });
    } catch (e) {
        console.error(e);
        els.resultsMetaText.textContent = "Error loading location data. Is the backend running?";
        els.resultsMetaText.style.color = "red";
    }
}

// Event Listeners
function setupEventListeners() {
    // Navigation
    els.navSearch.addEventListener('click', (e) => switchView(e, 'search'));
    els.navHistory.addEventListener('click', (e) => switchView(e, 'history'));
    document.getElementById('nav-map').addEventListener('click', (e) => switchView(e, 'map'));

    // Location Cascading Dropdowns
    els.countrySelect.addEventListener('change', (e) => {
        const country = e.target.value;
        els.citySelect.innerHTML = '<option value="">Select City</option>';
        els.localitySelect.innerHTML = '<option value="">Select Locality</option>';
        els.localitySelect.disabled = true;

        if (country) {
            const cities = [...new Set(state.locations.filter(l => l.Country === country).map(l => l.City))].filter(Boolean).sort();
            cities.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c;
                opt.textContent = c;
                els.citySelect.appendChild(opt);
            });
            els.citySelect.disabled = false;
        } else {
            els.citySelect.disabled = true;
        }
    });

    els.citySelect.addEventListener('change', (e) => {
        const city = e.target.value;
        const country = els.countrySelect.value;
        els.localitySelect.innerHTML = '<option value="">Select Locality</option>';

        if (city) {
            const localities = [...new Set(state.locations.filter(l => l.Country === country && l.City === city).map(l => l.Locality))].filter(Boolean).sort();
            localities.forEach(l => {
                const opt = document.createElement('option');
                opt.value = l;
                opt.textContent = l;
                els.localitySelect.appendChild(opt);
            });
            els.localitySelect.disabled = false;
        } else {
            els.localitySelect.disabled = true;
        }
    });

    // Filters UI
    els.priceFilter.addEventListener('input', (e) => els.priceValue.textContent = e.target.value);
    els.ratingFilter.addEventListener('input', (e) => els.ratingValue.textContent = parseFloat(e.target.value).toFixed(1));

    // Actions
    els.searchBtn.addEventListener('click', () => {
        state.isGpsMode = false;
        state.offset = 0;
        fetchRecommendations();
    });

    els.applyFiltersBtn.addEventListener('click', () => {
        state.offset = 0;
        fetchRecommendations();
    });

    els.gpsBtn.addEventListener('click', useGPS);

    els.loadMoreBtn.addEventListener('click', () => {
        state.offset += state.limit;
        fetchRecommendations(true);
    });

    document.getElementById('show-directions-btn').addEventListener('click', calculateRoutes);
}

function switchView(e, viewName) {
    if (e) e.preventDefault();
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));

    const rightPanel = document.querySelector('.right-panel');
    const mapContainer = document.getElementById('map-container');

    // Remove active class to reset
    if (rightPanel) rightPanel.classList.remove('large-map-active');

    // Normal radius
    if (mapContainer) {
        mapContainer.style.borderTopLeftRadius = '24px';
        mapContainer.style.borderBottomLeftRadius = '24px';
        mapContainer.style.borderRadius = 'var(--radius)';
    }

    if (viewName === 'search') {
        els.navSearch.classList.add('active');
        els.viewSearch.classList.add('active');
        setTimeout(() => state.map.invalidateSize(), 50);
        setTimeout(() => state.map.invalidateSize(), 150);
        setTimeout(() => state.map.invalidateSize(), 350);

    } else if (viewName === 'history') {
        els.navHistory.classList.add('active');
        els.viewHistory.classList.add('active');
        fetchHistory();
        setTimeout(() => state.map.invalidateSize(), 50);
        setTimeout(() => state.map.invalidateSize(), 150);
        setTimeout(() => state.map.invalidateSize(), 350);

    } else if (viewName === 'map') {
        document.getElementById('nav-map').classList.add('active');
        els.viewSearch.classList.add('active'); // Keep search view underneath

        if (rightPanel) rightPanel.classList.add('large-map-active');

        if (mapContainer) {
            mapContainer.style.borderRadius = '0';
        }

        // Invalidate map size so Leaflet recalculates dimensions during and after animation
        setTimeout(() => state.map.invalidateSize(), 50);
        setTimeout(() => state.map.invalidateSize(), 150);
        setTimeout(() => state.map.invalidateSize(), 350); // After transition finishes
    }
}

function useGPS() {
    if ("geolocation" in navigator) {
        els.gpsBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Locating...';
        navigator.geolocation.getCurrentPosition(
            (position) => {
                state.userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                state.isGpsMode = true;
                state.offset = 0;

                // Add user marker
                L.marker([state.userLocation.lat, state.userLocation.lng], {
                    icon: L.icon({
                        iconUrl: 'https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
                        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                        iconSize: [25, 41],
                        iconAnchor: [12, 41],
                        popupAnchor: [1, -34],
                        shadowSize: [41, 41]
                    })
                }).addTo(state.map).bindPopup('You are here!').openPopup();

                state.map.setView([state.userLocation.lat, state.userLocation.lng], 13);

                els.gpsBtn.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i> Use GPS';
                fetchRecommendations();
            },
            (error) => {
                alert("GPS Error: " + error.message);
                els.gpsBtn.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i> Use GPS';
            }
        );
    } else {
        alert("Geolocation not supported by your browser");
    }
}

async function fetchRecommendations(append = false) {
    els.mainLoader.style.display = 'block';

    if (!append) {
        els.restaurantGrid.innerHTML = '';
        els.restaurantGrid.appendChild(els.mainLoader);
        els.loadMoreBtn.style.display = 'none';
    }

    // Build Query Params
    const params = new URLSearchParams();

    if (state.isGpsMode && state.userLocation) {
        params.append('lat', state.userLocation.lat);
        params.append('lon', state.userLocation.lng);
        els.resultsMetaText.textContent = "Showing top rated restaurants near your GPS location.";
    } else {
        const country = els.countrySelect.value;
        const city = els.citySelect.value;
        const locality = els.localitySelect.value;

        if (country) params.append('country', country);
        if (city) params.append('city', city);
        if (locality) params.append('locality', locality);

        els.resultsMetaText.textContent = `Showing restaurants in ${locality || city || country || 'all locations'}.`;
    }

    // Apply filters
    if (els.vegToggle.checked) params.append('is_veg', 'Yes');
    if (els.cuisineFilter.value) params.append('target_cuisines', els.cuisineFilter.value);
    if (els.priceFilter.value < 5000) params.append('max_cost', els.priceFilter.value);
    if (els.ratingFilter.value > 0) params.append('min_rating', els.ratingFilter.value);

    params.append('limit', state.limit);
    params.append('offset', state.offset);

    try {
        const res = await fetch(`${API_BASE}/recommend?${params.toString()}`);
        if (!res.ok) throw new Error("API Error");
        const data = await res.json();

        els.mainLoader.style.display = 'none';

        if (!append) {
            state.currentResults = data.results;
            clearMapMarkers();
        } else {
            state.currentResults = [...state.currentResults, ...data.results];
        }

        renderRestaurants(data.results, els.restaurantGrid);
        updateMapMarkers(data.results);

        if (data.results.length === state.limit) {
            els.loadMoreBtn.style.display = 'inline-flex';
        } else {
            els.loadMoreBtn.style.display = 'none';
        }

        if (state.currentResults.length === 0 && !append) {
            els.restaurantGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: var(--text-muted);">No restaurants found matching your criteria.</div>';
        }

    } catch (err) {
        console.error(err);
        els.mainLoader.style.display = 'none';
        if (!append) {
            els.restaurantGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: red;">Failed to load data. Ensure backend is running.</div>';
        }
    }
}

function renderRestaurants(restaurants, container) {
    restaurants.forEach(r => {
        const ratingClass = getRatingClass(r['Rating text']);
        const isVeg = r['Is_Veg'] === 'Yes';

        const card = document.createElement('div');
        card.className = 'restaurant-card';
        card.innerHTML = `
            <div class="card-header">
                <div>
                    <h3 class="card-title">${r['Restaurant Name']}</h3>
                    <div class="card-subtitle">${r['Locality Verbose']}</div>
                </div>
                <div class="rating-badge ${ratingClass}">
                    ${r['Aggregate rating']} <i class="fa-solid fa-star" style="font-size:0.75rem"></i>
                </div>
            </div>
            
            <div class="tags">
                ${r['Cuisines'].split(',').map(c => `<span class="tag">${c.trim()}</span>`).slice(0, 3).join('')}
                ${isVeg ? '<span class="tag veg"><i class="fa-solid fa-leaf"></i> Veg</span>' : ''}
            </div>
            
            <div class="card-body">
                <div class="info-row">
                    <i class="fa-solid fa-money-bill-wave"></i>
                    <span><b>${r['Currency']} ${r['Average Cost for two']}</b> for two people</span>
                </div>
                <div class="info-row">
                    <i class="fa-solid fa-thumbs-up"></i>
                    <span>${r['Votes']} votes (${r['Rating text']})</span>
                </div>
                ${r.Distance_km ? `
                <div class="info-row" style="color: var(--secondary); font-weight: 500;">
                    <i class="fa-solid fa-location-arrow"></i>
                    <span>${r.Distance_km.toFixed(2)} km away</span>
                </div>
                ` : ''}
            </div>
        `;

        // Add click listener to save history and focus on map
        card.addEventListener('click', () => {
            saveHistory(r['Restaurant ID']);
            focusMap(r);
        });

        container.appendChild(card);
    });
}

function getRatingClass(ratingText) {
    if (!ratingText) return 'rating-none';
    const text = ratingText.toLowerCase();
    if (text === 'excellent') return 'rating-excellent';
    if (text === 'very good') return 'rating-very-good';
    if (text === 'good') return 'rating-good';
    if (text === 'average') return 'rating-average';
    if (text === 'poor') return 'rating-poor';
    return 'rating-none';
}

function clearMapMarkers() {
    state.markers.forEach(m => state.map.removeLayer(m));
    state.markers = [];
    if (state.routeLine) {
        state.map.removeLayer(state.routeLine);
        state.routeLine = null;
    }
    if (state.routingControl) {
        state.map.removeControl(state.routingControl);
        state.routingControl = null;
    }
    document.getElementById('routing-info').style.display = 'none';
}

function updateMapMarkers(restaurants) {
    if (!restaurants || restaurants.length === 0) return;

    // Custom icon for resturants
    const redIcon = L.icon({
        iconUrl: 'https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    });

    const bounds = [];

    restaurants.forEach(r => {
        if (r.Latitude && r.Longitude && r.Latitude !== 0 && r.Longitude !== 0) {
            const marker = L.marker([r.Latitude, r.Longitude], { icon: redIcon })
                .bindPopup(`<b>${r['Restaurant Name']}</b><br>${r['Cuisines']}<br>Rating: ${r['Aggregate rating']}`);
            marker.addTo(state.map);
            state.markers.push(marker);
            bounds.push([r.Latitude, r.Longitude]);
        }
    });

    // Fit bounds if we have points and not in GPS mode (if GPS mode, we already focused on user)
    if (bounds.length > 0 && !state.isGpsMode) {
        state.map.fitBounds(bounds, { padding: [50, 50] });
    }
}

function focusMap(restaurant) {
    if (restaurant.Latitude && restaurant.Longitude && restaurant.Latitude !== 0) {
        state.map.setView([restaurant.Latitude, restaurant.Longitude], 16);
        state.currentRestaurantCoords = L.latLng(restaurant.Latitude, restaurant.Longitude);

        // Show directions button if GPS is active
        if (state.isGpsMode && state.userLocation) {
            document.getElementById('routing-info').style.display = 'block';
            document.getElementById('routing-stats').innerHTML = '';

            // Draw a simple straight line immediately
            if (state.routeLine) state.map.removeLayer(state.routeLine);
            state.routeLine = L.polyline([
                [state.userLocation.lat, state.userLocation.lng],
                [restaurant.Latitude, restaurant.Longitude]
            ], { color: 'red', weight: 4, opacity: 0.7, dashArray: '10, 10' }).addTo(state.map);

            state.map.fitBounds(state.routeLine.getBounds(), { padding: [50, 50] });
        }
    }
}

function calculateRoutes() {
    if (!state.isGpsMode || !state.userLocation || !state.currentRestaurantCoords) return;

    // Clear basic route line
    if (state.routeLine) {
        state.map.removeLayer(state.routeLine);
        state.routeLine = null;
    }

    // Clear previous routing control
    if (state.routingControl) {
        state.map.removeControl(state.routingControl);
    }

    document.getElementById('show-directions-btn').innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading...';

    const start = L.latLng(state.userLocation.lat, state.userLocation.lng);
    const end = state.currentRestaurantCoords;

    // Initialize Routing Control (Defaults to driving via OSRM)
    state.routingControl = L.Routing.control({
        waypoints: [start, end],
        routeWhileDragging: false,
        addWaypoints: false,
        show: false, // Hide the turn-by-turn text box on map
        lineOptions: {
            styles: [{ color: 'var(--primary)', opacity: 0.8, weight: 6 }]
        }
    }).addTo(state.map);

    state.routingControl.on('routesfound', function (e) {
        const routes = e.routes;
        const summary = routes[0].summary;
        // Total time in seconds
        const drivingTime = summary.totalTime;

        // Simple heuristic estimations for demo: 
        // Driving = 1x, Two Wheeler usually faster in city ~0.8x, Walking ~ 12x slower
        const minsDrive = Math.round(drivingTime / 60);
        const minsBike = Math.round(minsDrive * 0.8);
        const minsWalk = Math.round(minsDrive * 12);

        document.getElementById('routing-stats').innerHTML = `
            <div style="margin-bottom: 5px; color: var(--text-muted); font-size: 0.8rem;">Travel Estimates:</div>
            <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg); padding:8px; border-radius:var(--radius); margin-bottom: 5px;">
                <span><i class="fa-solid fa-car" style="color:var(--primary); width:20px;"></i> Car</span>
                <b>${minsDrive} min</b>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg); padding:8px; border-radius:var(--radius); margin-bottom: 5px;">
                <span><i class="fa-solid fa-motorcycle" style="color:var(--secondary); width:20px;"></i> 2-Wheeler</span>
                <b>${minsBike} min</b>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg); padding:8px; border-radius:var(--radius);">
                <span><i class="fa-solid fa-person-walking" style="color:var(--accent); width:20px;"></i> Walking</span>
                <b>${minsWalk > 60 ? Math.floor(minsWalk / 60) + ' hr ' + minsWalk % 60 + ' min' : minsWalk + ' min'}</b>
            </div>
        `;
        document.getElementById('show-directions-btn').innerHTML = '<i class="fa-solid fa-route"></i> Update Directions';
    });

    state.routingControl.on('routingerror', function () {
        document.getElementById('routing-stats').innerHTML = '<div style="color:red;">Error fetching route.</div>';
        document.getElementById('show-directions-btn').innerHTML = '<i class="fa-solid fa-route"></i> Show Directions';
    });
}

// History API
async function saveHistory(restaurantId) {
    try {
        await fetch(`${API_BASE}/history`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: state.userId,
                restaurant_id: Number(restaurantId)
            })
        });
    } catch (e) {
        console.error("Failed to save history", e);
    }
}

async function fetchHistory() {
    els.historyGrid.innerHTML = '<div class="loading-spinner"><i class="fa-solid fa-circle-notch fa-spin"></i></div>';

    try {
        const res = await fetch(`${API_BASE}/history?user_id=${state.userId}`);
        const data = await res.json();

        els.historyGrid.innerHTML = '';
        if (data.history && data.history.length > 0) {
            renderRestaurants(data.history, els.historyGrid);
        } else {
            els.historyGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 3rem;">Your history is empty. Go browse some restaurants!</div>';
        }
    } catch (e) {
        els.historyGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: red;">Failed to load history.</div>';
    }
}
