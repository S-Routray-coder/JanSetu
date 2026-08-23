/* =====================================================
   JANSETU UNIFIED MAPS ADAPTER
   Hybrid Google Maps JavaScript API with Satellite & Leaflet Fallback
===================================================== */

const JanSetuMaps = {
    apiKey: (typeof localStorage !== "undefined" ? localStorage.getItem("GOOGLE_MAPS_API_KEY") : "") || (typeof window !== "undefined" ? window.GOOGLE_MAPS_API_KEY : "") || "",
    isGoogleLoaded: false,
    googleLoadingPromise: null,

    // Category Color Palette
    CATEGORY_COLORS: {
        "Road & Infrastructure": "#ea580c",
        "Water Supply": "#0284c7",
        "Waste Management": "#16a34a",
        "Street Lighting": "#eab308",
        "Drainage": "#8b5cf6",
        "Health": "#dc2626",
        "Other": "#64748b"
    },

    // Category Icons
    CATEGORY_ICONS: {
        "Road & Infrastructure": "🚧",
        "Water Supply": "💧",
        "Waste Management": "🗑️",
        "Street Lighting": "💡",
        "Drainage": "≋",
        "Health": "🏥",
        "Other": "📋"
    },

    /**
     * UI helper to configure Google Maps API Key directly from dashboard
     */
    promptApiKey() {
        const current = this.apiKey || "";
        const key = prompt(
            "🔑 Configure Google Maps JavaScript API Key:\n\n" +
            "Paste your API key from Google Cloud Console below to activate full Google Maps Satellite, Street View, and Places autocomplete.\n\n" +
            "(Leave blank to use OpenStreetMap / Satellite view)",
            current
        );

        if (key !== null) {
            const trimmed = key.trim();
            localStorage.setItem("GOOGLE_MAPS_API_KEY", trimmed);
            this.apiKey = trimmed;
            if (trimmed) {
                alert("✓ Google Maps API key saved! Reloading dashboard with Google Maps...");
            } else {
                alert("✓ Switched to OpenStreetMap mode. Reloading...");
            }
            window.location.reload();
        }
    },

    /**
     * Load Google Maps JS API dynamically if an API key is available
     */
    async loadGoogleMaps(apiKey = null) {
        if (apiKey) this.apiKey = apiKey;
        if (!this.apiKey && typeof localStorage !== "undefined") {
            this.apiKey = localStorage.getItem("GOOGLE_MAPS_API_KEY") || "";
        }

        if (window.google && window.google.maps) {
            this.isGoogleLoaded = true;
            return true;
        }

        if (!this.apiKey) {
            return false;
        }

        if (this.googleLoadingPromise) {
            return this.googleLoadingPromise;
        }

        this.googleLoadingPromise = new Promise((resolve) => {
            const script = document.createElement("script");
            script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(this.apiKey)}&libraries=places,visualization`;
            script.async = true;
            script.defer = true;
            script.onload = () => {
                this.isGoogleLoaded = true;
                resolve(true);
            };
            script.onerror = () => {
                console.warn("Google Maps failed to load, falling back to OpenStreetMap / Satellite.");
                resolve(false);
            };
            document.head.appendChild(script);
        });

        return this.googleLoadingPromise;
    },

    /**
     * Initialize a Map in a container
     */
    async initMap(containerId, options = {}) {
        const container = document.getElementById(containerId);
        if (!container) return null;

        const defaultLat = options.lat || 20.2961;
        const defaultLng = options.lng || 85.8245;
        const defaultZoom = options.zoom || 13;

        // Try loading Google Maps if key present
        const googleAvailable = await this.loadGoogleMaps();

        if (googleAvailable && window.google && window.google.maps) {
            const map = new google.maps.Map(container, {
                center: { lat: defaultLat, lng: defaultLng },
                zoom: defaultZoom,
                mapTypeControl: true,
                mapTypeControlOptions: {
                    style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
                    position: google.maps.ControlPosition.TOP_RIGHT
                },
                streetViewControl: true,
                fullscreenControl: true
            });

            return {
                engine: "google",
                map: map,
                markers: [],
                hotspots: [],
                infoWindow: new google.maps.InfoWindow(),
                containerId: containerId
            };
        }

        // High-Resolution Direct Google Maps & Satellite Layers (100% Free - No Cloud Console / Payment Required!)
        if (typeof L !== "undefined") {
            const googleStreets = L.tileLayer("https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", {
                maxZoom: 20,
                attribution: "© Google Maps"
            });

            const googleSatellite = L.tileLayer("https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}", {
                maxZoom: 20,
                attribution: "© Google Maps Satellite"
            });

            const googleTerrain = L.tileLayer("https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}", {
                maxZoom: 20,
                attribution: "© Google Maps Terrain"
            });

            const osmStandard = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}.png", {
                maxZoom: 19,
                attribution: "© OpenStreetMap"
            });

            const map = L.map(containerId, {
                zoomControl: true,
                scrollWheelZoom: false,
                layers: [googleStreets]
            }).setView([defaultLat, defaultLng], defaultZoom);

            const baseMaps = {
                "🗺️ Google Streets": googleStreets,
                "🛰️ Google Satellite": googleSatellite,
                "⛰️ Google Terrain": googleTerrain,
                "🌍 OpenStreetMap": osmStandard
            };

            L.control.layers(baseMaps, null, { position: "topright" }).addTo(map);

            return {
                engine: "leaflet",
                map: map,
                markers: [],
                hotspots: [],
                containerId: containerId
            };
        }

        return null;
    },

    /**
     * Add a civic complaint marker to the map
     */
    addGrievanceMarker(mapHandle, point) {
        if (!mapHandle || !point) return;
        const { lat, lng, properties } = point;
        if (!lat || !lng) return;

        const color = this.CATEGORY_COLORS[properties.category] || "#2563eb";
        const iconSymbol = this.CATEGORY_ICONS[properties.category] || "📍";
        const isCritical = (properties.priority || "").toLowerCase() === "critical";

        if (mapHandle.engine === "google") {
            // Google Maps Marker with custom SVG pin
            const marker = new google.maps.Marker({
                position: { lat, lng },
                map: mapHandle.map,
                title: properties.title || `#${properties.ticket_id}`,
                icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: isCritical ? 10 : 8,
                    fillColor: color,
                    fillOpacity: 0.95,
                    strokeWeight: isCritical ? 3 : 2,
                    strokeColor: isCritical ? "#dc2626" : "#ffffff"
                }
            });

            const popupHtml = `
                <div style="font-family: inherit; font-size: 13px; line-height: 1.4; padding: 4px; min-width: 200px;">
                    <div style="font-weight: 700; color: #1e293b; margin-bottom: 2px;">#${properties.ticket_id}</div>
                    <div style="font-size: 13px; color: #0f172a; font-weight: 600; margin-bottom: 4px;">${properties.title}</div>
                    <div style="font-size: 11px; color: #64748b; margin-bottom: 6px;">
                        <span>${iconSymbol} ${properties.category}</span><br>
                        <span>⌖ ${properties.landmark || properties.ward || 'Ward 12'}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #e2e8f0; padding-top: 6px;">
                        <span style="font-size: 11px; font-weight: 700; color: ${properties.status === 'Resolved' ? '#16a34a' : '#ea580c'};">${properties.status}</span>
                        ${properties.onActionClick ? `<button onclick="${properties.onActionClick}('${properties.ticket_id}')" style="background: #2563eb; color: #fff; border: none; padding: 3px 8px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 600;">${properties.actionLabel || 'Track →'}</button>` : ''}
                    </div>
                </div>
            `;

            marker.addListener("click", () => {
                mapHandle.infoWindow.setContent(popupHtml);
                mapHandle.infoWindow.open(mapHandle.map, marker);
            });

            mapHandle.markers.push(marker);
            return marker;

        } else if (mapHandle.engine === "leaflet") {
            // Leaflet Circle Marker
            const marker = L.circleMarker([lat, lng], {
                radius: isCritical ? 10 : 8,
                fillColor: color,
                color: isCritical ? "#dc2626" : "#ffffff",
                weight: isCritical ? 3 : 2,
                opacity: 1,
                fillOpacity: 0.92
            });

            const popupHtml = `
                <div style="font-family: inherit; font-size: 13px; line-height: 1.4; min-width: 190px;">
                    <div style="font-weight: 700; color: #1e293b; margin-bottom: 2px;">#${properties.ticket_id}</div>
                    <div style="font-size: 13px; color: #0f172a; font-weight: 600; margin-bottom: 4px;">${properties.title}</div>
                    <div style="font-size: 11px; color: #64748b; margin-bottom: 6px;">
                        <span>${iconSymbol} ${properties.category}</span><br>
                        <span>⌖ ${properties.landmark || properties.ward || 'Ward 12'}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #e2e8f0; padding-top: 6px;">
                        <span style="font-size: 11px; font-weight: 700; color: ${properties.status === 'Resolved' ? '#16a34a' : '#ea580c'};">${properties.status}</span>
                        ${properties.onActionClick ? `<button onclick="${properties.onActionClick}('${properties.ticket_id}')" style="background: #2563eb; color: #fff; border: none; padding: 3px 8px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 600;">${properties.actionLabel || 'Track →'}</button>` : ''}
                    </div>
                </div>
            `;

            marker.bindPopup(popupHtml);
            marker.addTo(mapHandle.map);
            mapHandle.markers.push(marker);
            return marker;
        }
    },

    /**
     * Add a hotspot cluster circle
     */
    addHotspotCircle(mapHandle, { lat, lng, radius, label }) {
        if (!mapHandle || !lat || !lng) return;

        if (mapHandle.engine === "google") {
            const circle = new google.maps.Circle({
                strokeColor: "#ef4444",
                strokeOpacity: 0.8,
                strokeWeight: 1.5,
                fillColor: "#ef4444",
                fillOpacity: 0.15,
                map: mapHandle.map,
                center: { lat, lng },
                radius: radius || 300
            });
            mapHandle.hotspots.push(circle);
            return circle;

        } else if (mapHandle.engine === "leaflet") {
            const circle = L.circle([lat, lng], {
                radius: radius || 300,
                color: "#ef4444",
                fillColor: "#ef4444",
                fillOpacity: 0.15,
                weight: 1.5,
                dashArray: "4, 4"
            });
            if (label) circle.bindTooltip(label, { sticky: true });
            circle.addTo(mapHandle.map);
            mapHandle.hotspots.push(circle);
            return circle;
        }
    },

    /**
     * Clear all markers and hotspot circles from a map
     */
    clearLayers(mapHandle) {
        if (!mapHandle) return;

        if (mapHandle.engine === "google") {
            mapHandle.markers.forEach(m => m.setMap(null));
            mapHandle.markers = [];
            mapHandle.hotspots.forEach(c => c.setMap(null));
            mapHandle.hotspots = [];
        } else if (mapHandle.engine === "leaflet") {
            mapHandle.markers.forEach(m => mapHandle.map.removeLayer(m));
            mapHandle.markers = [];
            mapHandle.hotspots.forEach(c => mapHandle.map.removeLayer(c));
            mapHandle.hotspots = [];
        }
    },

    /**
     * Fit map bounds to encompass all active coordinates
     */
    fitBounds(mapHandle, latLngList) {
        if (!mapHandle || !latLngList || latLngList.length === 0) return;

        if (mapHandle.engine === "google") {
            const bounds = new google.maps.LatLngBounds();
            latLngList.forEach(([lat, lng]) => bounds.extend({ lat, lng }));
            mapHandle.map.fitBounds(bounds);
        } else if (mapHandle.engine === "leaflet") {
            mapHandle.map.fitBounds(L.latLngBounds(latLngList), { padding: [25, 25], maxZoom: 15 });
        }
    },

    /**
     * Invalidate and resize map container
     */
    invalidateSize(mapHandle) {
        if (!mapHandle) return;
        if (mapHandle.engine === "google") {
            if (window.google && window.google.maps) {
                google.maps.event.trigger(mapHandle.map, "resize");
            }
        } else if (mapHandle.engine === "leaflet") {
            mapHandle.map.invalidateSize();
        }
    },

    /**
     * Create an interactive draggable location pin picker for reporting
     */
    async createLocationPicker(containerId, { initialLat = 20.2961, initialLng = 85.8245, onLocationChange }) {
        const container = document.getElementById(containerId);
        if (!container) return null;

        const googleAvailable = await this.loadGoogleMaps();

        if (googleAvailable && window.google && window.google.maps) {
            const map = new google.maps.Map(container, {
                center: { lat: initialLat, lng: initialLng },
                zoom: 15,
                mapTypeControl: true,
                streetViewControl: false
            });

            const marker = new google.maps.Marker({
                position: { lat: initialLat, lng: initialLng },
                map: map,
                draggable: true,
                title: "Drag to problem location",
                animation: google.maps.Animation.DROP
            });

            const updatePos = (lat, lng) => {
                if (onLocationChange) onLocationChange(lat, lng);
            };

            marker.addListener("dragend", (e) => {
                updatePos(e.latLng.lat(), e.latLng.lng());
            });

            map.addListener("click", (e) => {
                marker.setPosition(e.latLng);
                updatePos(e.latLng.lat(), e.latLng.lng());
            });

            return {
                engine: "google",
                map: map,
                marker: marker,
                setPosition: (lat, lng) => {
                    const pos = { lat, lng };
                    marker.setPosition(pos);
                    map.panTo(pos);
                    updatePos(lat, lng);
                }
            };
        }

        // Free High-Resolution Direct Google Maps & Satellite Layers
        if (typeof L !== "undefined") {
            const googleStreets = L.tileLayer("https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", {
                maxZoom: 20,
                attribution: "© Google Maps"
            });

            const googleSatellite = L.tileLayer("https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}", {
                maxZoom: 20,
                attribution: "© Google Maps Satellite"
            });

            const map = L.map(containerId, {
                zoomControl: true,
                scrollWheelZoom: false,
                layers: [googleStreets]
            }).setView([initialLat, initialLng], 15);

            L.control.layers({ "🗺️ Google Streets": googleStreets, "🛰️ Google Satellite": googleSatellite }, null, { position: "topright" }).addTo(map);

            const marker = L.marker([initialLat, initialLng], {
                draggable: true
            }).addTo(map);

            const updatePos = (lat, lng) => {
                if (onLocationChange) onLocationChange(lat, lng);
            };

            marker.on("dragend", (e) => {
                const pos = e.target.getLatLng();
                updatePos(pos.lat, pos.lng);
            });

            map.on("click", (e) => {
                marker.setLatLng(e.latlng);
                updatePos(e.latlng.lat(), e.latlng.lng());
            });

            return {
                engine: "leaflet",
                map: map,
                marker: marker,
                setPosition: (lat, lng) => {
                    marker.setLatLng([lat, lng]);
                    map.panTo([lat, lng]);
                    updatePos(lat, lng);
                }
            };
        }

        return null;
    }
};

// Export to window
if (typeof window !== "undefined") {
    window.JanSetuMaps = JanSetuMaps;
}
