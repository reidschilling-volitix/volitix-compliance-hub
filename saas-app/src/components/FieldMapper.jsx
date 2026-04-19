import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { X, MapPin, Trash2, Maximize2, Layers, Search, MousePointerClick, Loader2, Eye, EyeOff, ChevronRight, ChevronDown, Upload } from 'lucide-react';
import L from 'leaflet';
import 'leaflet-draw';
import 'leaflet-draw/dist/leaflet.draw.css';

// Shoelace polygon area in sq meters from [lat,lon] points
const polygonAreaSqM = (pts) => {
  if (pts.length < 3) return 0;
  const avgLat = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const mPerDegLat = 111320;
  const mPerDegLon = 111320 * Math.cos(avgLat * Math.PI / 180);
  const projected = pts.map(([lat, lon]) => [(lon - pts[0][1]) * mPerDegLon, (lat - pts[0][0]) * mPerDegLat]);
  let area = 0;
  for (let i = 0; i < projected.length; i++) {
    const j = (i + 1) % projected.length;
    area += projected[i][0] * projected[j][1];
    area -= projected[j][0] * projected[i][1];
  }
  return Math.abs(area) / 2;
};

// Convert polygon points to KML string
const pointsToKml = (polygonPoints) => {
  if (!polygonPoints || polygonPoints.length < 3) return null;
  const coordStr = polygonPoints
    .map(([lat, lon]) => `${lon},${lat},0`)
    .join(' ');
  // Close the ring
  const first = polygonPoints[0];
  const closed = `${coordStr} ${first[1]},${first[0]},0`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Field Boundary</name>
    <Placemark>
      <name>Drawn Field</name>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>${closed}</coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>
  </Document>
</kml>`;
};

// Distinct chemical color palette
const CHEM_COLORS = [
  '#f43f5e', '#3b82f6', '#f59e0b', '#10b981', '#a855f7',
  '#ec4899', '#06b6d4', '#ef4444', '#84cc16', '#6366f1',
  '#f97316', '#14b8a6', '#e879f9', '#22d3ee', '#facc15',
];
const getChemColor = (chemical, colorMap) => {
  if (!chemical) return '#64748b';
  if (colorMap[chemical]) return colorMap[chemical];
  const idx = Object.keys(colorMap).length % CHEM_COLORS.length;
  colorMap[chemical] = CHEM_COLORS[idx];
  return colorMap[chemical];
};

// Parse KML coordinates string into [[lat,lon],...]
const parseKmlCoords = (kml) => {
  if (!kml) return [];
  const all = [];
  const matches = [...kml.matchAll(/<coordinates>([\s\S]*?)<\/coordinates>/gi)];
  matches.forEach((m) => {
    const pts = (m[1] || '').trim().split(/\s+/).map((pair) => {
      const [lonS, latS] = pair.split(',');
      const lat = parseFloat(latS);
      const lon = parseFloat(lonS);
      return (!isNaN(lat) && !isNaN(lon)) ? [lat, lon] : null;
    }).filter(Boolean);
    if (pts.length >= 3) all.push(pts);
  });
  return all;
};

const FieldMapper = ({ open, onClose, onApply, initialLat, initialLon, initialKml, workOrders = [] }) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const drawnItemsRef = useRef(null);
  const editingLayerRef = useRef(null);
  const makeEditableRef = useRef(null);
  const [acreage, setAcreage] = useState(0);
  const [pointCount, setPointCount] = useState(0);
  const [editing, setEditing] = useState(false);
  const [polygonDeleteTargets, setPolygonDeleteTargets] = useState([]); // [{lat, lng, id}]
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [snapping, setSnapping] = useState(false);
  const [snapMode, setSnapMode] = useState(true);
  const [showAllFields, setShowAllFields] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedCustomers, setExpandedCustomers] = useState({});
  const overlayLayersRef = useRef([]);

  // Helper to assign a unique id to each polygon
  const polygonIdRef = useRef(1);

  const recalcAcreage = useCallback(() => {
    if (!drawnItemsRef.current) return;
    let totalArea = 0;
    let pts = 0;
    const newDeleteTargets = [];
    drawnItemsRef.current.eachLayer((layer) => {
      if (layer instanceof L.Polygon) {
        // Assign a unique id if not present
        if (!layer._customId) {
          layer._customId = polygonIdRef.current++;
        }
        const latlngs = layer.getLatLngs()[0];
        const points = latlngs.map((ll) => [ll.lat, ll.lng]);
        totalArea += polygonAreaSqM(points);
        pts += points.length;
        // Find centroid for delete button
        if (latlngs.length > 2) {
          const c = latlngs.reduce((acc, ll) => [acc[0]+ll.lat, acc[1]+ll.lng], [0,0]);
          const centroid = { lat: c[0]/latlngs.length, lng: c[1]/latlngs.length };
          newDeleteTargets.push({ ...centroid, id: layer._customId });
        }
      }
    });
    setPolygonDeleteTargets(newDeleteTargets);
      // Remove a single polygon by id
      const handleDeletePolygon = (id) => {
        if (!drawnItemsRef.current) return;
        drawnItemsRef.current.eachLayer((layer) => {
          if (layer instanceof L.Polygon && layer._customId === id) {
            drawnItemsRef.current.removeLayer(layer);
          }
        });
        setTimeout(recalcAcreage, 10);
      };
    setAcreage(totalArea / 4046.86);
    setPointCount(pts);
  }, []);

  // --- Cloud Function field boundary lookup ---
  // Calls getFieldBoundary which tries county parcel data first, then falls back to USDA CSB
  const FIELD_BOUNDARY_URL = 'https://us-central1-spray-drone-compliance-hub.cloudfunctions.net/getFieldBoundary';

  const handleSnapClick = useCallback(async (lat, lng) => {
    if (!drawnItemsRef.current || !mapInstanceRef.current) return;
    setSnapping(true);
    try {
      const resp = await fetch(`${FIELD_BOUNDARY_URL}?lat=${lat}&lng=${lng}`);
      const data = await resp.json();

      if (!data.found || !data.ring) {
        setSnapping(false);
        return false;
      }

      // ring is [[lon,lat],...] from ArcGIS — convert to Leaflet [lat,lon]
      const latlngs = data.ring.map(([lon, la]) => L.latLng(la, lon));
      const isParcel = data.source === 'county_parcel' || data.source === 'state_parcel' || data.source === 'discovered_parcel';

      const poly = L.polygon(latlngs, {
        color: isParcel ? '#3b82f6' : '#9cd33b',
        weight: 3,
        fillColor: isParcel ? '#3b82f6' : '#9cd33b',
        fillOpacity: 0.2,
      });

      let tooltipHtml;
      if (isParcel) {
        const owner = data.attributes?.OWNER || data.attributes?.OWN_NAME || data.attributes?.OWNER1 || '';
        const parcelId = data.attributes?.PARCEL_ID || data.attributes?.PIN || data.attributes?.APN || data.attributes?.PARCELID || '';
        const ac = data.attributes?.ACRES || data.attributes?.GIS_ACRES || data.attributes?.CALCACRES || '';
        tooltipHtml = `<b>${data.countyName || 'Parcel'}</b>${owner ? ` · ${owner}` : ''}${ac ? ` · ${parseFloat(ac).toFixed(1)} ac` : ''}${parcelId ? `<br><span style="font-size:9px;opacity:0.7">${parcelId}</span>` : ''}<br><span style="font-size:9px;opacity:0.5">County parcel data · ${data.stateName || ''}</span>`;
      } else {
        const cropName = data.crop || 'Unknown';
        const ac = data.acres ? parseFloat(data.acres).toFixed(1) : '?';
        tooltipHtml = `<b>${cropName}</b> · ${ac} ac<br><span style="font-size:9px;opacity:0.7">USDA CSB ${data.year || '2022'} · ${data.csbid || ''}</span>`;
      }
      poly.bindTooltip(tooltipHtml, { sticky: true, className: 'csb-tooltip' });

      if (makeEditableRef.current) makeEditableRef.current(poly);
      drawnItemsRef.current.addLayer(poly);
      recalcAcreage();
      setSnapping(false);
      return true;
    } catch { /* network error */ }
    setSnapping(false);
    return false;
  }, [recalcAcreage]);

  // File import (KML, GeoJSON, Shapefile-as-GeoJSON)
  const fileInputRef = useRef(null);

  const parseGeoJsonPolygons = (geojson) => {
    const rings = [];
    const feats = geojson.type === 'FeatureCollection' ? geojson.features
      : geojson.type === 'Feature' ? [geojson]
      : [{ type: 'Feature', geometry: geojson }];
    for (const f of feats) {
      const g = f?.geometry;
      if (!g) continue;
      if (g.type === 'Polygon') {
        rings.push(g.coordinates[0].map(([lon, lat]) => [lat, lon]));
      } else if (g.type === 'MultiPolygon') {
        for (const poly of g.coordinates) rings.push(poly[0].map(([lon, lat]) => [lat, lon]));
      }
    }
    return rings;
  };

  const handleFileImport = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file || !drawnItemsRef.current || !mapInstanceRef.current) return;
    e.target.value = '';

    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result;
      let polygonSets = [];

      const ext = file.name.toLowerCase().split('.').pop();
      if (ext === 'kml' || ext === 'kmz') {
        // Parse KML
        polygonSets = parseKmlCoords(text);
      } else if (ext === 'geojson' || ext === 'json') {
        // Parse GeoJSON
        try {
          const geojson = JSON.parse(text);
          polygonSets = parseGeoJsonPolygons(geojson);
        } catch { /* invalid JSON */ }
      } else {
        // Try JSON (GeoJSON) first, then KML
        try {
          const geojson = JSON.parse(text);
          polygonSets = parseGeoJsonPolygons(geojson);
        } catch {
          polygonSets = parseKmlCoords(text);
        }
      }

      if (!polygonSets.length) {
        alert('No field boundaries found in file. Supported: KML, GeoJSON.');
        return;
      }

      let bounds = null;
      for (const pts of polygonSets) {
        if (pts.length < 3) continue;
        const latlngs = pts.map(([lat, lon]) => L.latLng(lat, lon));
        const poly = L.polygon(latlngs, {
          color: '#a855f7',
          weight: 3,
          fillColor: '#a855f7',
          fillOpacity: 0.2,
        });
        const sqm = polygonAreaSqM(pts);
        const acres = (sqm / 4046.86).toFixed(1);
        poly.bindTooltip(`<b>Imported boundary</b> · ${acres} ac<br><span style="font-size:9px;opacity:0.7">${file.name}</span>`, { sticky: true, className: 'csb-tooltip' });
        if (makeEditableRef.current) makeEditableRef.current(poly);
        drawnItemsRef.current.addLayer(poly);
        const b = poly.getBounds();
        bounds = bounds ? bounds.extend(b) : b;
      }

      if (bounds) mapInstanceRef.current.fitBounds(bounds, { padding: [60, 60] });
      recalcAcreage();
    };
    reader.readAsText(file);
  }, [recalcAcreage]);

  // Geocode search
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim() || !mapInstanceRef.current) return;
    setSearching(true);
    try {
      const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1&countrycodes=us`, {
        headers: { 'Accept': 'application/json' },
      });
      const data = await resp.json();
      if (data.length > 0) {
        const { lat, lon } = data[0];
        mapInstanceRef.current.setView([parseFloat(lat), parseFloat(lon)], 16);
      }
    } catch { /* ignore */ }
    setSearching(false);
  }, [searchQuery]);

  useEffect(() => {
    if (!open || !mapRef.current) return;

    // Small delay for modal to render
    const timer = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const map = L.map(mapRef.current, {
        zoomControl: true,
        attributionControl: true,
      });

      // Satellite base layer (Esri World Imagery - free with attribution)
      const satellite = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 19,
          crossOrigin: true,
          attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics',
        }
      );

      // Road names + transportation overlay
      const roads = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19, pane: 'overlayPane' }
      );

      // Place names overlay (cities, counties)
      const labels = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19, pane: 'overlayPane' }
      );

      // Street map as alternative
      const streets = L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }
      );

      satellite.addTo(map);
      roads.addTo(map);
      labels.addTo(map);

      L.control.layers(
        { 'Satellite': satellite, 'Street Map': streets },
        { 'Roads': roads, 'Labels': labels },
        { position: 'topright' }
      ).addTo(map);

      // Drawn items layer
      const drawnItems = new L.FeatureGroup();
      map.addLayer(drawnItems);
      drawnItemsRef.current = drawnItems;

      // Draw control
      const drawControl = new L.Control.Draw({
        position: 'topleft',
        draw: {
          polygon: {
            allowIntersection: false,
            shapeOptions: {
              color: '#9cd33b',
              weight: 3,
              fillColor: '#9cd33b',
              fillOpacity: 0.2,
            },
          },
          rectangle: {
            shapeOptions: {
              color: '#9cd33b',
              weight: 3,
              fillColor: '#9cd33b',
              fillOpacity: 0.2,
            },
          },
          polyline: false,
          circle: false,
          circlemarker: false,
          marker: false,
        },
        edit: {
          featureGroup: drawnItems,
          remove: true,
        },
      });
      map.addControl(drawControl);

      // Enable click-to-edit vertices on a polygon layer
      const attachVertexDblClick = (layer) => {
        // After editing is enabled, find vertex markers and add dblclick-to-delete
        const polys = layer.editing._poly || layer;
        const latlngs = polys.getLatLngs()[0];
        if (!layer.editing._markerGroup) return;
        layer.editing._markerGroup.eachLayer((marker) => {
          // Only real vertex markers (not midpoints)
          if (!marker._middleLeft && !marker._middleRight) return;
          // Skip if already attached
          if (marker._dblClickBound) return;
          marker._dblClickBound = true;
          marker.on('dblclick', (e) => {
            L.DomEvent.stopPropagation(e);
            L.DomEvent.preventDefault(e);
            // Need at least 3 vertices to remain a polygon
            const currentLatLngs = layer.getLatLngs()[0];
            if (currentLatLngs.length <= 3) return;
            // Find which vertex index this marker represents
            const idx = currentLatLngs.findIndex(
              (ll) => ll.lat === marker.getLatLng().lat && ll.lng === marker.getLatLng().lng
            );
            if (idx === -1) return;
            currentLatLngs.splice(idx, 1);
            layer.setLatLngs([currentLatLngs]);
            layer.editing.disable();
            layer.editing.enable();
            // Re-attach dblclick on new markers
            setTimeout(() => attachVertexDblClick(layer), 50);
            recalcAcreage();
          });
        });
      };

      const makeEditable = (layer) => {
        // Ensure the editing handler is initialized (leaflet-draw only auto-inits for drawn layers)
        if (!layer.editing) {
          layer.editing = new L.Edit.Poly(layer);
        }
        layer.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          // If already editing this layer, stop editing
          if (editingLayerRef.current === layer) {
            layer.editing.disable();
            layer.setStyle({ weight: 3, dashArray: null });
            editingLayerRef.current = null;
            setEditing(false);
            recalcAcreage();
            return;
          }
          // Stop editing any previous layer
          if (editingLayerRef.current && editingLayerRef.current.editing) {
            editingLayerRef.current.editing.disable();
            editingLayerRef.current.setStyle({ weight: 3, dashArray: null });
          }
          // Enable editing on this one
          layer.editing.enable();
          layer.setStyle({ weight: 2, dashArray: '6 4' });
          editingLayerRef.current = layer;
          setEditing(true);
          // Attach dblclick-to-delete on vertex markers
          setTimeout(() => attachVertexDblClick(layer), 50);
          // Recalc on every vertex drag
          layer.on('edit', () => {
            recalcAcreage();
            // Re-attach after edits (markers get recreated on drag)
            setTimeout(() => attachVertexDblClick(layer), 50);
          });
        });
      };
      makeEditableRef.current = makeEditable;

      // On shape drawn
      map.on(L.Draw.Event.CREATED, (e) => {
        makeEditable(e.layer);
        drawnItems.addLayer(e.layer);
        recalcAcreage();
      });
      map.on(L.Draw.Event.EDITED, () => recalcAcreage());
      map.on(L.Draw.Event.DELETED, () => {
        if (editingLayerRef.current) {
          editingLayerRef.current = null;
          setEditing(false);
        }
        recalcAcreage();
      });

      // Click-to-snap handler
      map.on('click', async (e) => {
        // If currently editing a polygon, dismiss edit mode on background click
        if (editingLayerRef.current) {
          editingLayerRef.current.editing.disable();
          editingLayerRef.current.setStyle({ weight: 3, dashArray: null });
          editingLayerRef.current = null;
          setEditing(false);
          recalcAcreage();
          return;
        }
        // Only snap when not actively drawing
        if (!snapModeRef.current) return;
        const found = await handleSnapClickRef.current(e.latlng.lat, e.latlng.lng);
        if (!found) {
          // Flash a brief "no field found" indicator
          const popup = L.popup({ closeButton: false, autoClose: true, closeOnClick: true })
            .setLatLng(e.latlng)
            .setContent('<div style="font-size:11px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:0.1em">No field boundary found — try drawing manually</div>')
            .openOn(map);
          setTimeout(() => map.closePopup(popup), 2500);
        }
      });

      // Load existing KML boundary if present
      if (initialKml) {
        const matches = [...initialKml.matchAll(/<coordinates>([\s\S]*?)<\/coordinates>/gi)];
        matches.forEach((m) => {
          const pts = (m[1] || '').trim().split(/\s+/).map((pair) => {
            const [lonS, latS] = pair.split(',');
            const lat = parseFloat(latS);
            const lon = parseFloat(lonS);
            return (!isNaN(lat) && !isNaN(lon)) ? L.latLng(lat, lon) : null;
          }).filter(Boolean);
          if (pts.length >= 3) {
            const poly = L.polygon(pts, {
              color: '#9cd33b',
              weight: 3,
              fillColor: '#9cd33b',
              fillOpacity: 0.2,
            });
            makeEditable(poly);
            drawnItems.addLayer(poly);
          }
        });
        if (drawnItems.getLayers().length > 0) {
          map.fitBounds(drawnItems.getBounds(), { padding: [40, 40] });
          recalcAcreage();
        }
      }

      // Set initial view
      const lat = parseFloat(initialLat);
      const lon = parseFloat(initialLon);
      if (!isNaN(lat) && !isNaN(lon)) {
        map.setView([lat, lon], 16);
      } else if (!initialKml || drawnItems.getLayers().length === 0) {
        map.setView([39.82, -98.57], 5);
      }

      mapInstanceRef.current = map;

      // Force map to recalculate size
      setTimeout(() => map.invalidateSize(), 100);
    }, 50);

    return () => {
      clearTimeout(timer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        drawnItemsRef.current = null;
      }
    };
  }, [open, initialLat, initialLon, initialKml, recalcAcreage]);

  // Build chemical color map (stable across renders)
  const chemColorMap = useRef({});
  const customerFields = useMemo(() => {
    const grouped = {};
    chemColorMap.current = {};
    workOrders.forEach((wo) => {
      if (!wo.kmlData || !wo.customer) return;
      const polys = parseKmlCoords(wo.kmlData);
      if (polys.length === 0) return;
      const color = getChemColor(wo.chemical, chemColorMap.current);
      if (!grouped[wo.customer]) grouped[wo.customer] = [];
      grouped[wo.customer].push({ ...wo, polys, color });
    });
    return grouped;
  }, [workOrders]);

  // Render / remove overlay fields on toggle
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    // Remove existing overlays
    overlayLayersRef.current.forEach((l) => map.removeLayer(l));
    overlayLayersRef.current = [];

    if (!showAllFields) return;

    const bounds = L.latLngBounds([]);
    Object.values(customerFields).flat().forEach((wo) => {
      wo.polys.forEach((pts) => {
        const latlngs = pts.map(([lat, lon]) => L.latLng(lat, lon));
        const poly = L.polygon(latlngs, {
          color: wo.color,
          weight: 2,
          fillColor: wo.color,
          fillOpacity: 0.25,
          interactive: true,
        });
        poly.bindTooltip(
          `<div style="font-size:11px"><b>${wo.customer}</b><br/>${wo.chemical || 'No chemical'} · ${wo.acres || '?'} ac<br/><span style="opacity:0.6">${wo.title || ''}</span></div>`,
          { sticky: true }
        );
        poly.addTo(map);
        overlayLayersRef.current.push(poly);
        bounds.extend(poly.getBounds());
      });
    });
    if (bounds.isValid() && overlayLayersRef.current.length > 0) {
      map.fitBounds(bounds, { padding: [60, 60] });
    }
  }, [showAllFields, customerFields]);

  // Keep refs in sync for the map click handler
  const snapModeRef = useRef(snapMode);
  const handleSnapClickRef = useRef(handleSnapClick);
  useEffect(() => { snapModeRef.current = snapMode; }, [snapMode]);
  useEffect(() => { handleSnapClickRef.current = handleSnapClick; }, [handleSnapClick]);

  const handleApply = () => {
    if (!drawnItemsRef.current) return;

    // Finalize any active vertex editing
    if (editingLayerRef.current && editingLayerRef.current.editing) {
      editingLayerRef.current.editing.disable();
      editingLayerRef.current = null;
      setEditing(false);
    }

    const allPoints = [];
    drawnItemsRef.current.eachLayer((layer) => {
      if (layer instanceof L.Polygon) {
        const latlngs = layer.getLatLngs()[0];
        latlngs.forEach((ll) => allPoints.push([ll.lat, ll.lng]));
      }
    });

    if (allPoints.length < 3) {
      onClose();
      return;
    }

    // Get centroid
    const centLat = allPoints.reduce((s, p) => s + p[0], 0) / allPoints.length;
    const centLon = allPoints.reduce((s, p) => s + p[1], 0) / allPoints.length;

    // Build KML from all drawn polygons
    const polygons = [];
    drawnItemsRef.current.eachLayer((layer) => {
      if (layer instanceof L.Polygon) {
        polygons.push(layer.getLatLngs()[0].map((ll) => [ll.lat, ll.lng]));
      }
    });

    let kmlStr;
    if (polygons.length === 1) {
      kmlStr = pointsToKml(polygons[0]);
    } else {
      // Multi-polygon KML
      const placemarks = polygons.map((pts, i) => {
        const coordStr = pts.map(([lat, lon]) => `${lon},${lat},0`).join(' ');
        const first = pts[0];
        const closed = `${coordStr} ${first[1]},${first[0]},0`;
        return `    <Placemark><name>Field ${i + 1}</name><Polygon><outerBoundaryIs><LinearRing><coordinates>${closed}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>`;
      }).join('\n');
      kmlStr = `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2">\n  <Document>\n    <name>Field Boundaries</name>\n${placemarks}\n  </Document>\n</kml>`;
    }

    onApply({
      kmlData: kmlStr,
      kmlFileName: 'drawn-boundary.kml',
      finalLat: centLat.toFixed(6),
      finalLon: centLon.toFixed(6),
      acres: Math.round(acreage * 10) / 10,
    });
    onClose();
  };

  const clearAll = () => {
    if (editingLayerRef.current) {
      editingLayerRef.current.editing.disable();
      editingLayerRef.current = null;
      setEditing(false);
    }
    if (drawnItemsRef.current) {
      drawnItemsRef.current.clearLayers();
      setAcreage(0);
      setPointCount(0);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black animate-fade-in">
      <div className="relative w-full h-full bg-slate-950 overflow-hidden flex flex-col">
        {/* Compact Header — title + search + acreage + close */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-800/60 bg-slate-900/90 backdrop-blur-sm shrink-0">
          <MapPin size={16} className="text-[#9cd33b] shrink-0" />
          <span className="text-[11px] font-black uppercase tracking-widest text-slate-200 shrink-0 hidden sm:inline">Field Mapper</span>
          <div className="flex-1 max-w-md mx-2">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <input
                type="text"
                placeholder="Search location..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-800/60 border border-slate-700/50 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-[#9cd33b]/40 transition-colors"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
          </div>
          <button type="button" onClick={handleSearch} disabled={searching} className="px-3 py-1.5 bg-[#9cd33b] text-[#020617] rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-[#8ac22a] transition-colors disabled:opacity-50 shrink-0">
            {searching ? '...' : 'Go'}
          </button>
          {acreage > 0 && (
            <span className="text-xs font-black text-[#9cd33b] bg-[#9cd33b]/10 border border-[#9cd33b]/20 px-3 py-1 rounded-lg shrink-0 hidden sm:flex items-center gap-1.5">
              {acreage.toFixed(1)} ac
            </span>
          )}
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0 ml-auto">
            <X size={16} />
          </button>
        </div>

        {/* Map + Sidebar container */}
        <div className="flex-1 relative flex overflow-hidden">
          {/* Sidebar - customer fields panel */}
          {sidebarOpen && (
            <div className="w-64 shrink-0 bg-slate-950/95 backdrop-blur-sm border-r border-slate-800/60 flex flex-col z-10 overflow-hidden">
              <div className="px-3 py-2.5 border-b border-slate-800/60 flex items-center justify-between">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Fields by Customer</span>
                <button type="button" onClick={() => setSidebarOpen(false)} className="p-1 rounded text-slate-500 hover:text-white transition-colors">
                  <X size={12} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto scrollbar-thin">
                {Object.keys(customerFields).length === 0 ? (
                  <div className="p-4 text-[10px] text-slate-500 uppercase tracking-widest">No work orders with field boundaries</div>
                ) : (
                  Object.entries(customerFields).map(([customer, fields]) => (
                    <div key={customer} className="border-b border-slate-800/30">
                      <button
                        type="button"
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-slate-800/30 transition-colors"
                        onClick={() => setExpandedCustomers((p) => ({ ...p, [customer]: !p[customer] }))}
                      >
                        {expandedCustomers[customer] ? <ChevronDown size={11} className="text-slate-500 shrink-0" /> : <ChevronRight size={11} className="text-slate-500 shrink-0" />}
                        <span className="text-[10px] font-bold text-slate-200 truncate flex-1">{customer}</span>
                        <span className="text-[9px] text-slate-600 font-bold tabular-nums">{fields.length}</span>
                      </button>
                      {expandedCustomers[customer] && (
                        <div className="pb-1">
                          {fields.map((wo) => (
                            <button key={wo.id} type="button" className="w-full flex items-center gap-2 px-3 py-1.5 pl-7 text-left hover:bg-slate-800/30 transition-colors" onClick={() => { if (!mapInstanceRef.current) return; const pts = wo.polys[0]; if (pts) { mapInstanceRef.current.fitBounds(L.latLngBounds(pts.map(([lat, lon]) => L.latLng(lat, lon))), { padding: [80, 80] }); } }}>
                              <span className="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-white/10" style={{ background: wo.color }} />
                              <div className="flex-1 min-w-0">
                                <div className="text-[9px] font-semibold text-slate-300 truncate">{wo.chemical || 'No chemical'}</div>
                                <div className="text-[8px] text-slate-500 truncate">{wo.title} · {wo.acres || '?'} ac</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
              {/* Chemical legend */}
              {Object.keys(chemColorMap.current).length > 0 && (
                <div className="px-3 py-2.5 border-t border-slate-800/60 shrink-0">
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {Object.entries(chemColorMap.current).map(([chem, color]) => (
                      <span key={chem} className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                        <span className="text-[8px] text-slate-500">{chem}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Map */}
          <div className="flex-1 relative">
            <div ref={mapRef} className="absolute inset-0" />

            {/* Top-left: Snap toggle always visible */}
            <div className="absolute top-2.5 left-2 z-[1000] flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSnapMode((p) => !p)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[9px] font-bold border backdrop-blur-sm shadow-sm transition-all ${
                  snapMode
                    ? 'bg-[#9cd33b]/15 border-[#9cd33b]/30 text-[#9cd33b]'
                    : 'bg-slate-900/80 border-slate-700/60 text-slate-400 hover:text-slate-200'
                }`}
                title={snapMode ? 'Auto-snap ON: Click a field to snap its boundary' : 'Auto-snap OFF: Manual draw only'}
              >
                <MousePointerClick size={12} />
                {snapMode ? 'Snap' : 'Snap'}
              </button>
              {Object.keys(customerFields).length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => { setShowAllFields((p) => !p); if (!showAllFields) setSidebarOpen(true); }}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[9px] font-bold border backdrop-blur-sm transition-all shadow-sm ${
                      showAllFields
                        ? 'bg-blue-500/20 border-blue-400/40 text-blue-300'
                        : 'bg-slate-900/80 border-slate-700/60 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {showAllFields ? <Eye size={12} /> : <EyeOff size={12} />}
                    {showAllFields ? 'Fields ON' : 'All Fields'}
                  </button>
                  {!sidebarOpen && showAllFields && (
                    <button type="button" onClick={() => setSidebarOpen(true)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[9px] font-bold border bg-slate-900/80 border-slate-700/60 text-slate-400 hover:text-slate-200 backdrop-blur-sm shadow-sm">
                      <Layers size={12} /> Legend
                    </button>
                  )}
                </>
              )}
            </div>


            {/* Per-polygon delete buttons (only when editing or polygons exist) */}
            {polygonDeleteTargets.length > 0 && (
              <div className="pointer-events-none">
                {polygonDeleteTargets.map((pt) => (
                  <button
                    key={pt.id}
                    type="button"
                    className="fixed z-[10001] pointer-events-auto bg-red-500/90 hover:bg-red-600 text-white rounded-full p-1.5 shadow-lg border-2 border-white/80 transition-all"
                    style={{
                      position: 'fixed',
                      left: `calc(${pt.lng}vw)`, // placeholder, will update below
                      top: `calc(${pt.lat}vh)`, // placeholder, will update below
                      transform: 'translate(-50%, -50%)',
                      display: editing ? 'block' : 'none',
                    }}
                    title="Delete this boundary"
                    onClick={() => handleDeletePolygon(pt.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                ))}
              </div>
            )}

            {/* Loading indicator */}
            {snapping && (
              <div className="absolute top-2.5 left-1/2 -translate-x-1/2 z-[1000] bg-slate-900/90 backdrop-blur-sm border border-[#9cd33b]/20 rounded-lg px-4 py-2 flex items-center gap-2 shadow-lg">
                <Loader2 size={13} className="text-[#9cd33b] animate-spin" />
                <span className="text-[10px] text-[#9cd33b] font-bold">Querying field boundaries...</span>
              </div>
            )}
            {/* Editing indicator */}
            {editing && !snapping && (
              <div className="absolute top-2.5 left-1/2 -translate-x-1/2 z-[1000] bg-slate-900/90 backdrop-blur-sm border border-amber-500/20 rounded-lg px-4 py-2 shadow-lg">
                <span className="text-[10px] text-amber-400 font-bold">Drag vertices · Double-click to delete · Click map to finish</span>
              </div>
            )}
            {/* Instructions overlay */}
            {pointCount === 0 && !snapping && !editing && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[1000] bg-slate-900/85 backdrop-blur-sm border border-slate-700/40 rounded-lg px-5 py-2.5 pointer-events-none shadow-lg max-w-md">
                <p className="text-[10px] text-slate-300 font-medium text-center leading-relaxed">
                  {snapMode
                    ? <>Click a field to <span className="text-[#9cd33b] font-bold">auto-snap</span>, <span className="text-purple-400 font-bold">import</span> for exact boundaries, or draw manually</>
                    : <><span className="text-purple-400 font-bold">Import</span> for exact boundaries, or use the polygon tool to draw</>}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer — compact inline */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-slate-800/60 bg-slate-900/90 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-3">
            <button type="button" onClick={clearAll} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[9px] font-bold hover:bg-red-500/20 transition-colors">
              <Trash2 size={12} /> Clear All
            </button>
            {pointCount > 0 && (
              <span className="text-[10px] text-slate-500 font-medium tabular-nums">
                {pointCount} pts · {acreage.toFixed(1)} ac
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="px-4 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/50 text-slate-300 text-[10px] font-bold hover:bg-slate-700/60 transition-colors">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={acreage === 0}
              className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-[#9cd33b] to-[#7ab02b] text-[#020617] text-[10px] font-black uppercase tracking-wider hover:shadow-[0_0_15px_rgba(156,211,59,0.3)] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Apply ({acreage.toFixed(1)} ac)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FieldMapper;
