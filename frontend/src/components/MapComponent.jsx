import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet-control-geocoder";
import { useEffect, useMemo } from "react";

const markerColors = {
  fire: { fill: "#ef4444", stroke: "#fee2e2" },
  thw: { fill: "#3b82f6", stroke: "#dbeafe" },
  san: { fill: "#f8fafc", stroke: "#0f172a" },
  command: { fill: "#facc15", stroke: "#fef9c3" },
  flood: { fill: "#0ea5e9", stroke: "#bae6fd" }
};

const createIcon = (color) =>
  L.divIcon({
    className: "",
    html: `<div style="
      width:14px;
      height:14px;
      background:${color.fill};
      border:2px solid ${color.stroke};
      border-radius:9999px;
      box-shadow:0 0 6px rgba(0,0,0,0.35);
    "></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7]
  });

const GeocoderControl = () => {
  const map = useMap();

  useEffect(() => {
    const viewBox = "12.3,49.4,13.6,48.5";
    const geocoder = L.Control.Geocoder.nominatim({
      geocodingQueryParams: {
        viewbox: viewBox,
        bounded: 1,
        countrycodes: "de"
      }
    });

    const control = L.Control.geocoder({
      geocoder,
      position: "topleft",
      defaultMarkGeocode: false
    })
      .on("markgeocode", (e) => {
        const bbox = e.geocode.bbox;
        map.fitBounds(bbox);
      })
      .addTo(map);

    return () => {
      map.removeControl(control);
    };
  }, [map]);

  return null;
};

const MapComponent = ({ events, center, canEdit, onMove }) => {
  const iconCache = useMemo(() => {
    const cache = {};
    Object.entries(markerColors).forEach(([key, value]) => {
      cache[key] = createIcon(value);
    });
    return cache;
  }, []);

  return (
    <div className="h-full w-full rounded-xl overflow-hidden border border-slate-800">
      <MapContainer center={center} zoom={13} scrollWheelZoom className="h-full">
        <GeocoderControl />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {events.map((event) => (
          <Marker
            key={event.id}
            position={[event.location.lat, event.location.lng]}
            icon={iconCache[event.type] || iconCache.command}
            draggable={canEdit}
            eventHandlers={{
              dragend: (e) => {
                const { lat, lng } = e.target.getLatLng();
                onMove(event.id, lat, lng);
              }
            }}
          >
            <Popup>
              <div className="text-sm">
                <div className="font-semibold text-slate-900">{event.title}</div>
                <div className="text-slate-700">Status: {event.status}</div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default MapComponent;

