"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { MeshPhongMaterial } from "three";
import type { GlobeMethods } from "react-globe.gl";

const Globe = dynamic(() => import("react-globe.gl"), { ssr: false });

export interface GlobePoint {
  ticker: string;
  name: string;
  exchangeCode: string;
  sector: string | null;
  lat: number;
  lng: number;
  hasInsight: boolean;
}

interface CountryFeature {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry: { type: string; coordinates: unknown };
}

const ACCENT = "#2a78d6";
const ACCENT_DIM = "#93a9c2";
const GLOBE_SURFACE = "#fcfcfb";
const COUNTRY_STROKE = "#c3c2b7";

export function FinanceGlobe({ points }: { points: GlobePoint[] }) {
  const router = useRouter();
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [hovered, setHovered] = useState<GlobePoint | null>(null);
  const [countries, setCountries] = useState<CountryFeature[]>([]);

  const globeMaterial = useMemo(
    () => new MeshPhongMaterial({ color: GLOBE_SURFACE, shininess: 2 }),
    []
  );

  useEffect(() => {
    fetch("/globe/countries.geojson")
      .then((r) => r.json())
      .then((geojson) => setCountries(geojson.features))
      .catch(() => setCountries([]));
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setSize({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;
    globe.pointOfView({ lat: 5, lng: 20, altitude: 2.2 }, 0);
    const controls = globe.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.35;
    controls.enableZoom = true;
    controls.minDistance = 150;
    controls.maxDistance = 500;
  }, [size.width]);

  // Points are packed close together at this zoom level — a rotating globe
  // makes them near-impossible to click, so freeze rotation the moment the
  // pointer is over it and resume once it leaves.
  const setAutoRotate = (value: boolean) => {
    const controls = globeRef.current?.controls();
    if (controls) controls.autoRotate = value;
  };

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full"
      onMouseEnter={() => setAutoRotate(false)}
      onMouseLeave={() => setAutoRotate(true)}
    >
      {size.width > 0 && (
        <Globe
          ref={globeRef}
          width={size.width}
          height={size.height}
          backgroundColor="rgba(0,0,0,0)"
          globeMaterial={globeMaterial}
          showAtmosphere
          atmosphereColor={ACCENT}
          atmosphereAltitude={0.15}
          polygonsData={countries}
          polygonCapColor={() => "rgba(0,0,0,0)"}
          polygonSideColor={() => "rgba(0,0,0,0)"}
          polygonStrokeColor={() => COUNTRY_STROKE}
          polygonAltitude={0.003}
          pointsData={points}
          pointLat="lat"
          pointLng="lng"
          pointAltitude={0.015}
          pointRadius={(d) => ((d as GlobePoint).hasInsight ? 0.55 : 0.4)}
          pointColor={(d) => ((d as GlobePoint).hasInsight ? ACCENT : ACCENT_DIM)}
          pointsMerge={false}
          pointLabel={() => ""}
          onPointHover={(point) => setHovered(point as GlobePoint | null)}
          onPointClick={(point) => router.push(`/company/${(point as GlobePoint).ticker}`)}
          enablePointerInteraction
        />
      )}

      {hovered && (
        <div className="pointer-events-none absolute bottom-6 left-1/2 w-72 -translate-x-1/2 rounded-lg border border-border/60 bg-card/95 px-4 py-3 text-center shadow-lg backdrop-blur">
          <p className="text-sm font-medium">{hovered.name}</p>
          <p className="text-xs text-muted-foreground">
            {hovered.ticker} &middot; {hovered.exchangeCode}
            {hovered.sector ? ` · ${hovered.sector}` : ""}
          </p>
        </div>
      )}
    </div>
  );
}
