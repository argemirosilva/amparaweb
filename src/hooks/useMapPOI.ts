import mapboxgl from "mapbox-gl";

/**
 * Enhance POI and road-label layers on a Mapbox map:
 * - Force road labels visible from zoom 8 with overlap allowed
 * - Force POI/label visibility from zoom 10
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
    const isRoadLabel = (id.includes("road") || id.includes("path") || id.includes("street")) && isLabel;

    if (!isPoi && !isLabel) continue;

    try {
      map.setLayerZoomRange(id, isRoadLabel ? 8 : 10, 24);
    } catch {}

    if (layer.type === "symbol") {
      try {
        if (isPoi) {
          map.setLayoutProperty(id, "icon-size", [
            "interpolate", ["linear"], ["zoom"],
            10, 0.8, 13, 1.0, 16, 1.4,
          ]);
          map.setLayoutProperty(id, "icon-allow-overlap", true);
        }

        if (isRoadLabel) {
          map.setLayoutProperty(id, "visibility", "visible");
          map.setLayoutProperty(id, "text-allow-overlap", true);
          map.setLayoutProperty(id, "symbol-avoid-edges", false);
          map.setLayoutProperty(id, "text-size", [
            "interpolate", ["linear"], ["zoom"],
            8, 8, 12, 10, 14, 12, 16, 14, 18, 16,
          ]);
          map.setPaintProperty(id, "text-halo-width", 2);
          map.setPaintProperty(id, "text-halo-color", "rgba(255,255,255,0.95)");
          map.setPaintProperty(id, "text-halo-blur", 0.5);
          map.setPaintProperty(id, "text-opacity", 1);
        } else {
          map.setLayoutProperty(id, "text-size", [
            "interpolate", ["linear"], ["zoom"],
            10, 10, 13, 12, 16, 14,
          ]);
          map.setPaintProperty(id, "text-halo-width", 1.5);
          map.setPaintProperty(id, "text-halo-color", "rgba(255,255,255,0.9)");
          map.setPaintProperty(id, "text-halo-blur", 0.5);
        }
      } catch {}
    }
  }
}
