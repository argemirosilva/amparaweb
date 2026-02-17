import mapboxgl from "mapbox-gl";

/**
 * Enhance POI layers on a Mapbox map:
 * - Force visibility from zoom 10
 * - Increase icon and text sizes for better legibility
 * - Boost text contrast with halo
 */
export function enhancePOILayers(map: mapboxgl.Map) {
  const style = map.getStyle();
  if (!style?.layers) return;

  for (const layer of style.layers) {
    const id = layer.id;
    const isPoi = id.includes("poi");
    const isLabel = id.includes("label");

    if (!isPoi && !isLabel) continue;

    try {
      map.setLayerZoomRange(id, 10, 24);
    } catch {}

    // Enhance symbol layers
    if (layer.type === "symbol") {
      try {
        // Larger icons
        if (isPoi) {
          map.setLayoutProperty(id, "icon-size", [
            "interpolate", ["linear"], ["zoom"],
            10, 0.8,
            13, 1.0,
            16, 1.4,
          ]);
          map.setLayoutProperty(id, "icon-allow-overlap", true);
        }

        // Larger, bolder text
        map.setLayoutProperty(id, "text-size", [
          "interpolate", ["linear"], ["zoom"],
          10, 10,
          13, 12,
          16, 14,
        ]);

        // Text halo for contrast
        map.setPaintProperty(id, "text-halo-width", 1.5);
        map.setPaintProperty(id, "text-halo-color", "rgba(255,255,255,0.9)");
        map.setPaintProperty(id, "text-halo-blur", 0.5);
      } catch {}
    }
  }
}
