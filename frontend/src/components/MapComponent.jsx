import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { useMemo } from "react";

const createRedIcon = () =>
  L.divIcon({
    className: "",
    html: `<div style="
      width:14px;
      height:14px;
      background:#ef4444;
      border:2px solid #fee2e2;
      border-radius:9999px;
      box-shadow:0 0 6px rgba(239,68,68,0.8);
    "></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7]
  });

const MapComponent = ({ events, center, canEdit, onMove }) => {
  const redIcon = useMemo(() => createRedIcon(), []);

  return (
    <div className="h-full w-full rounded-xl overflow-hidden border border-slate-800">
      <MapContainer center={center} zoom={13} scrollWheelZoom className="h-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {events.map((event) => (
          <Marker
            key={event.id}
            position={[event.location.lat, event.location.lng]}
            icon={redIcon}
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

