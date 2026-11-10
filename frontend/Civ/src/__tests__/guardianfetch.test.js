import { afterEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { fetchNewsData, latestOnly, placeMarkers } from "../guardianfetch.jsx";

describe("latestOnly", () => {
  it("lets only the newest request through", () => {
    const requests = latestOnly();
    const first = requests.begin();
    const second = requests.begin();
    expect(first()).toBe(false);   // a slow, older response is discarded
    expect(second()).toBe(true);
  });

  it("discards everything in flight after cancel() (component unmounted)", () => {
    const requests = latestOnly();
    const pending = requests.begin();
    requests.cancel();
    expect(pending()).toBe(false);
  });

  it("simulates the refresh race: slow first fetch, fast second fetch", async () => {
    const requests = latestOnly();
    const drawn = [];
    const load = async (label, delay) => {
      const isCurrent = requests.begin();
      await new Promise((r) => setTimeout(r, delay));
      if (isCurrent()) drawn.push(label);
    };
    await Promise.all([load("old preference", 30), load("new preference", 5)]);
    expect(drawn).toEqual(["new preference"]);
  });
});

describe("placeMarkers", () => {
  const degToRad = (lat, lon) => ({ lat: (lat * Math.PI) / 180, lon: (lon * Math.PI) / 180 });
  const latLonToXYZ = (lat, lon, r) => new THREE.Vector3(r * Math.cos(lat) * Math.cos(lon), r * Math.sin(lat), r * Math.cos(lat) * Math.sin(lon));
  const setup = () => ({
    earth: new THREE.Group(),
    markers: [],
    markerGeometry: new THREE.SphereGeometry(0.04),
    markerMaterial: new THREE.MeshBasicMaterial(),
    degToRad,
    latLonToXYZ,
  });
  const news = [
    { Headline: "A", WebURL: "https://a", Locations: [{ lat: 48.8, lon: 2.3 }, { lat: "bad", lon: 1 }] },
    { Headline: "B", WebURL: "https://b", Locations: [{ lat: 0, lon: 0 }] },
    { Headline: "C", WebURL: "https://c", Locations: null },
  ];

  it("places one marker per valid location and skips bad data", () => {
    const ctx = setup();
    expect(placeMarkers({ news, ...ctx })).toBe(2);
    expect(ctx.earth.children).toHaveLength(2);
    expect(ctx.markers.map((m) => m.userData.headline)).toEqual(["A", "B"]);
  });

  it("replaces old markers instead of stacking duplicates", () => {
    const ctx = setup();
    placeMarkers({ news, ...ctx });
    placeMarkers({ news, ...ctx });
    expect(ctx.earth.children).toHaveLength(2);
    expect(ctx.markers).toHaveLength(2);
  });
});

describe("fetchNewsData", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("throws the server's message so the globe can show it", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ detail: "Guardian API error" }), { status: 502 })));
    await expect(fetchNewsData()).rejects.toThrow("Guardian API error");
  });

  it("returns [] for a non-array body instead of crashing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ unexpected: true }), { status: 200 })));
    await expect(fetchNewsData()).resolves.toEqual([]);
  });
});
