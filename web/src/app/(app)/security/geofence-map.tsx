'use client';

import { Circle, MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Pin tanpa aset gambar (ikon bawaan Leaflet rusak di bundler): div bulat primary.
const pinIcon = L.divIcon({
  className: 'rs-geofence-pin',
  html: '<span style="display:block;width:18px;height:18px;border-radius:9999px;background:#0f766e;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function ClickToMove({ onMove }: { onMove: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(e) {
      onMove(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

interface Props {
  hospitalId: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  onMove: (latitude: number, longitude: number) => void;
}

/**
 * Pemilih area ala Facebook: klik peta untuk memindah titik, geser pin
 * untuk presisi, lingkaran mengikuti radius meter secara live.
 * Tile OpenStreetMap (perlu internet di browser admin).
 */
export function GeofenceMap({ hospitalId, latitude, longitude, radiusMeters, onMove }: Props) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return (
      <p className="rounded-lg border border-outline-variant bg-surface-container-low p-4 text-body-md text-outline">
        Isi latitude/longitude dulu agar peta bisa diposisikan.
      </p>
    );
  }
  return (
    <MapContainer
      key={hospitalId}
      center={[latitude, longitude]}
      zoom={16}
      scrollWheelZoom
      className="z-0 h-80 w-full rounded-xl border border-outline-variant"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickToMove onMove={onMove} />
      <Circle
        center={[latitude, longitude]}
        radius={Number.isFinite(radiusMeters) && radiusMeters > 0 ? radiusMeters : 0}
        pathOptions={{ color: '#0f766e', weight: 2, fillColor: '#0f766e', fillOpacity: 0.15 }}
      />
      <Marker
        position={[latitude, longitude]}
        icon={pinIcon}
        draggable
        eventHandlers={{
          dragend: (e) => {
            const m = e.target as L.Marker;
            const p = m.getLatLng();
            onMove(p.lat, p.lng);
          },
        }}
      />
    </MapContainer>
  );
}
