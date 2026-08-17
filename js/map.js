export class SettlementMap {
  constructor(containerId) {
    // Map container element ID (it maps to 'map-container' in index.html)
    const targetId = containerId === 'map-canvas' ? 'map-container' : containerId;
    
    // Bounds to restrict panning (Israel bounds in Lat/Lon)
    this.minLat = 29.35;
    this.maxLat = 33.35;
    this.minLon = 34.10;
    this.maxLon = 35.95;
    this.bounds = L.latLngBounds(L.latLng(this.minLat, this.minLon), L.latLng(this.maxLat, this.maxLon));

    // Initialize Leaflet Map
    this.map = L.map(targetId, {
      center: [31.4, 35.0], // Center of Israel
      zoom: 7.5,
      minZoom: 7.2,
      maxZoom: 12,
      zoomControl: false, // Hide default zoom controls to keep it minimal
      attributionControl: false, // Hide Leaflet logo for game immersion
      maxBounds: this.bounds,
      maxBoundsViscosity: 0.8
    });

    // Add CartoDB Light NoLabels Tile Layer (bright, high contrast, zero cities labeled)
    const tileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
      maxZoom: 12,
      subdomains: 'abcd'
    }).addTo(this.map);

    this.markers = [];
    this.connections = [];

    // Ensure resizing handles map update
    window.addEventListener('resize', () => this.resize());
    
    // Force a small delay to draw map correctly on init
    setTimeout(() => this.resize(), 100);
  }

  resize() {
    if (this.map) {
      this.map.invalidateSize();
    }
  }

  resetView() {
    this.map.closePopup();
    this.map.setView([31.4, 35.0], 7.5, { animate: true, duration: 1.0 });
  }

  clear() {
    // Remove all markers from Leaflet map
    this.markers.forEach(m => this.map.removeLayer(m));
    this.markers = [];

    // Remove all connections from Leaflet map
    this.connections.forEach(c => this.map.removeLayer(c));
    this.connections = [];
  }

  addMarker(lat, lon, options = {}) {
    const color = options.color || '#ff0055';
    const label = options.label || '';
    const pulse = options.pulse !== undefined ? options.pulse : true;
    
    // Custom glowing HTML structure for Leaflet marker
    const markerHtml = `
      <div class="custom-glow-marker" style="--color-marker: ${color}">
        ${pulse ? '<div class="marker-pulse"></div>' : ''}
        <div class="marker-node"></div>
        ${label ? `<div class="marker-label">${label}</div>` : ''}
      </div>
    `;

    const customIcon = L.divIcon({
      html: markerHtml,
      className: 'leaflet-custom-marker-holder',
      iconSize: [30, 30],
      iconAnchor: [15, 15] // Center marker
    });

    const marker = L.marker([lat, lon], { icon: customIcon }).addTo(this.map);
    
    if (options.onClick) {
      marker.on('click', options.onClick);
    }
    
    this.markers.push(marker);
    return marker;
  }

  addConnection(fromCoords, toCoords, color = 'rgba(239, 68, 68, 0.6)') {
    const polyline = L.polyline([[fromCoords.lat, fromCoords.lon], [toCoords.lat, toCoords.lon]], {
      color: color,
      weight: 3,
      dashArray: '6, 6',
      opacity: 0.8
    }).addTo(this.map);
    
    this.connections.push(polyline);
  }

  focusOnCoordinates(coords, customZoom = null) {
    if (!coords || coords.length === 0) return;

    if (coords.length === 1) {
      // Focus on a single coordinate smoothly
      const zoomLevel = customZoom !== null ? customZoom : 10.0;
      this.map.setView([coords[0].lat, coords[0].lon], zoomLevel, { 
        animate: true, 
        pan: { duration: 1.0 } 
      });
    } else {
      // Fit all coordinates inside visible window
      const latLngs = coords.map(c => L.latLng(c.lat, c.lon));
      const fitBounds = L.latLngBounds(latLngs);
      
      this.map.fitBounds(fitBounds, {
        padding: [40, 40], // Padding inside map view
        animate: true,
        pan: { duration: 1.2 }
      });
    }
  }
}
