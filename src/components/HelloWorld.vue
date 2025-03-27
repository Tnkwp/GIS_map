<template>
  <div>
    <button @click="triggerFileUpload" id="submit-button">Submit File</button>
    <input
      type="file"
      id="shapefile-input"
      ref="shapefileInput"
      style="display: none"
    />
    <div id="map" style="height: 700px; width: 800px"></div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw";
import "leaflet-draw/dist/leaflet.draw.css";
import "../../node_modules/leaflet-draw/dist/leaflet.draw-src.js"; // Ensure correct path
import proj4 from "proj4";
import axios from "axios";

// Define refs
const shapefileInput = ref(null);

// กำหนดระบบพิกัด (UTM Zone 47N)
const utmProjection = "EPSG:32647";

// แปลงพิกัดจาก UTM ไปเป็น WGS84 (Lat/Lng)
const convertUtmToLatLng = (utmCoords) => {
  try {
    return proj4(utmProjection, "EPSG:4326", utmCoords);
  } catch (error) {
    console.error("Error converting UTM to Lat/Lng:", error);
    return null;
  }
};

const triggerFileUpload = () => {
  shapefileInput.value.click();
};

onMounted(async () => {
  try {
    const mapElement = document.getElementById("map");
    if (!mapElement) {
      console.error("Error: #map element not found.");
      return;
    }

    // ตรวจสอบว่ามีการสร้างแผนที่แล้วหรือยัง
    if (!window.map || !(window.map instanceof L.Map)) {
      console.log("Creating new Leaflet map...");
      window.map = L.map("map").setView([15.87, 100.9925], 6);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(
        window.map
      );
    } else {
      console.log("Using existing Leaflet map:", window.map);
    }

    const map = window.map;
    console.log("Map object:", map);

    // สร้าง Layer Groups
    const drawnItems = new L.FeatureGroup().addTo(map);
    const lineStringLayerGroup = L.layerGroup().addTo(map);
    const multiLineStringLayerGroup = L.layerGroup().addTo(map);
    const polygonLayerGroup = L.layerGroup().addTo(map);
    const multiPolygonLayerGroup = L.layerGroup().addTo(map);
    const pointLayerGroup = L.layerGroup().addTo(map);
    

    // เพิ่ม Layer Control (เปิด/ปิดชั้นข้อมูล)
    const baseLayers = {
      "OSM Map": L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      ),
    };

    const overlayLayers = {
      "Drawn Shapes": drawnItems,
      "LineString Data": lineStringLayerGroup,
      "MultiLineString Data": multiLineStringLayerGroup,
      "Polygon Data": polygonLayerGroup,
      "MultiPolygon Data": multiPolygonLayerGroup,
      "Point Data": pointLayerGroup,
    };

    L.control.layers(baseLayers, overlayLayers).addTo(map);

    // ตั้งค่า Leaflet Draw Control
    const drawControl = new L.Control.Draw({
      draw: {
        polygon: { 
          showArea: false
        },
        polyline: true,
        rectangle: {
          shapeOptions: {
            clickable: false // Fixes strict mode issues[1]
          }
        },
        circle: true,
        marker: true,
      },
      edit: {
        featureGroup: drawnItems,
      },
    }).addTo(map);

    map.on("draw:created", function (e) {
      const layer = e.layer;
      const type = e.layerType; // Type of the shape drawn (polygon, polyline, etc.)

      drawnItems.addLayer(layer); // Add drawn shape to the layer group

      console.log("Drawn Shape Type:", type);
      console.log("Drawn Shape Data:", layer.toGeoJSON());
    });

    // ฟังก์ชันอัปโหลดไฟล์
    const uploadFile = async () => {
      const file = shapefileInput.value.files[0];
      if (!file) {
        console.error("Error: No file selected.");
        return;
      }

      // ส่งไฟล์ไปที่ backend
      const formData = new FormData();
      formData.append("shapefile", file);

      try {
        const response = await axios.post(
          "http://localhost:3000/upload",
          formData,
          {
            headers: { "Content-Type": "multipart/form-data" },
          }
        );
        console.log("API Response Data:", response.data);

        // ตรวจสอบข้อมูลที่ได้กลับมา
        if (!Array.isArray(response.data)) {
          console.error("Error: API response is not an array of geometries.");
          return;
        }

        // วาดข้อมูลลงในแผนที่
        response.data.forEach((item, index) => {
          if (!item || typeof item !== "object") {
            console.warn(
              `Warning: Skipping invalid item at index ${index}`,
              item
            );
            return;
          }

          if (!item.coordinates || !Array.isArray(item.coordinates)) {
            console.warn(
              `Warning: Missing or invalid coordinates at index ${index}`,
              item
            );
            return;
          }

          const coords = item.coordinates;

          // ตรวจสอบประเภทของข้อมูลและเพิ่มลงในแผนที่
          if (item.type === "Point") {
            const latLng = convertUtmToLatLng([coords[0], coords[1]]);
            L.marker([latLng[1], latLng[0]]).addTo(pointLayerGroup);
          } else if (item.type === "MultiLineString") {
            console.log("Processing MultiLineString:", item.coordinates);
            item.coordinates.forEach((line, index) => {
              const latLngLine = line
                .map((coord) => {
                  if (Array.isArray(coord) && coord.length >= 2) {
                    const [x, y] = coord;
                    const latLng = convertUtmToLatLng([x, y]);
                    return [latLng[1], latLng[0]];
                  }
                  return null;
                })
                .filter((coord) => coord !== null);

              if (latLngLine.length > 1) {
                const polyline = L.polyline(latLngLine, {
                  color: "red",
                  weight: 2,
                }).addTo(multiLineStringLayerGroup);

                polyline.bindPopup(
                  `Line ${index + 1}:<br>${latLngLine
                    .map((p) => `[${p[0]}, ${p[1]}]`)
                    .join("<br>")}`
                );
              }
            });
          } else if (item.type === "LineString") {
            console.log("Processing LineString:", item.coordinates);
            const latLngLine = item.coordinates
              .map((coord) => {
                if (Array.isArray(coord) && coord.length >= 2) {
                  const latLng = convertUtmToLatLng([coord[0], coord[1]]);
                  return [latLng[1], latLng[0]];
                }
                return null;
              })
              .filter((coord) => coord !== null);

            if (latLngLine.length > 1) {
              L.polyline(latLngLine, { color: "blue", weight: 2 }).addTo(
                lineStringLayerGroup
              );
            }
          }
          else if (item.type === "Polygon") {
            const latLngPolygon = coords[0] // Polygon coordinates are usually the first set
              .map((coord) => {
                if (
                  Array.isArray(coord) &&
                  Number.isFinite(coord[0]) &&
                  Number.isFinite(coord[1])
                ) {
                  const latLng = convertUtmToLatLng([coord[0], coord[1]]);
                  return [latLng[1], latLng[0]];
                }
                return null;
              })
              .filter((coord) => coord !== null);

            if (latLngPolygon.length > 2) {
              L.polygon(latLngPolygon, {
                color: "green",
                weight: 2,
              }).addTo(polygonLayerGroup);
            }
          } else if (item.type === "MultiPolygon") {
            // Handle MultiPolygon - Array of Polygons
            coords.forEach((polygonCoords, polygonIndex) => {
              const latLngPolygon = polygonCoords
                .map((coord) => {
                  if (
                    Array.isArray(coord) &&
                    Number.isFinite(coord[0]) &&
                    Number.isFinite(coord[1])
                  ) {
                    const latLng = convertUtmToLatLng([coord[0], coord[1]]);
                    return [latLng[1], latLng[0]];
                  }
                  return null;
                })
                .filter((coord) => coord !== null);

              if (latLngPolygon.length > 2) {
                L.polygon(latLngPolygon, {
                  color: "purple", // Polygon border color
                  weight: 10,
                  fillColor: "#ff00ff", // Fill color for polygons
                  fillOpacity: 0.5,
                }).addTo(multiPolygonLayerGroup);
              }
            });
          }
        });
      } catch (error) {
        console.error("Error fetching coordinates:", error);
      }
    };

    shapefileInput.value.addEventListener("change", uploadFile);
  } catch (error) {
    console.error("Error:", error);
  }
});
</script>

<style scoped>
#submit-button {
  background: green;
  margin-bottom: 10px;
}
</style>
