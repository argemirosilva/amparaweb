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
    const isRoadLabel = id.includes("road") && isLabel;

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

        // Force road/street labels visible with larger text
        if (isRoadLabel) {
          map.setLayoutProperty(id, "visibility", "visible");
          map.setLayoutProperty(id, "text-size", [
            "interpolate", ["linear"], ["zoom"],
            10, 9,
            13, 11,
            15, 13,
            18, 15,
          ]);
          map.setPaintProperty(id, "text-halo-width", 2);
          map.setPaintProperty(id, "text-halo-color", "rgba(255,255,255,0.95)");
          map.setPaintProperty(id, "text-halo-blur", 0.5);
          map.setPaintProperty(id, "text-opacity", 1);
        } else {
          // Larger, bolder text for other labels
          map.setLayoutProperty(id, "text-size", [
            "interpolate", ["linear"], ["zoom"],
            10, 10,
            13, 12,
            16, 14,
          ]);
          map.setPaintProperty(id, "text-halo-width", 1.5);
          map.setPaintProperty(id, "text-halo-color", "rgba(255,255,255,0.9)");
          map.setPaintProperty(id, "text-halo-blur", 0.5);
        }
      } catch {}
    }
  }
}
