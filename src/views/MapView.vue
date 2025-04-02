<template>
  <div id="map" class="h-screen w-full relative" style="position: relative; z-index: 0"></div>
  <div class="" style="
      position: absolute;
      bottom: 10px;
      right: 20%;
      transform: translateX(-50%);
      background-color: white;
      padding: 5px 10px;
      border-radius: 4px;
      border: 2px solid rgba(0, 0, 0, 0.2);
      z-index: 1000;
      font-size: 15px;
    ">
    Lat: <span id="lat">0.000000</span>, Lng: <span id="lng">0.000000</span>
  </div>
</template>

<script setup lang="ts">
import { onMounted, watch, ref } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import '@geoman-io/leaflet-geoman-free'
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css'
import 'leaflet-geometryutil'
import * as shp from 'shpjs'
import proj4 from 'proj4'

const utmProjection = 'EPSG:32647'

type UTMCoordinates = [number, number]

const convertUtmToLatLng = (utmCoords: UTMCoordinates): [number, number] | null => {
  try {
    if (!Array.isArray(utmCoords) || utmCoords.length !== 2) {
      console.error('Invalid UTM coordinates: Expected an array of [easting, northing].')
      return null
    }
    const [easting, northing] = utmCoords

    if (!isFinite(easting) || !isFinite(northing)) {
      return null
    }

    return proj4(utmProjection, 'EPSG:4326', utmCoords) as [number, number]
  } catch (error) {
    console.error('Error converting UTM to Lat/Lng:', error)
    return null
  }
}

interface FeatureGroups {
  point: L.LayerGroup
  lineString: L.LayerGroup
  multipleLineString: L.LayerGroup
  polygon: L.LayerGroup
  multiplePolygon: L.LayerGroup
  drawnItems: L.LayerGroup
}

// Reference for the GeoJSON data

interface ShapeProperties {
  name: string
  type: string
  shape: string
  created: string
}

interface CustomLayer extends L.Layer {
  properties?: ShapeProperties
}

interface ShapeLayer extends CustomLayer {
  properties?: ShapeProperties
}

let map: L.Map

const drawnItems = L.featureGroup()
const lineString = L.featureGroup()
const multipleLineString = L.featureGroup()
const polygon = L.featureGroup()
const multiplePolygon = L.featureGroup()
const point = L.featureGroup()

const test = ref<ShapeLayer[]>([])

onMounted(async () => {
  map = L.map('map').setView([13.7563, 100.5018], 10)

  // Add mousemove event to update coordinates
  map.on('mousemove', (e) => {
    const lat = e.latlng.lat.toFixed(6)
    const lng = e.latlng.lng.toFixed(6)
    document.getElementById('lat')!.textContent = lat
    document.getElementById('lng')!.textContent = lng
  })

  // TOGGLE MAP
  const baseMaps = {
    'Google Streets': L.tileLayer('https://mt0.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      attribution: 'Google',
    }),
    OpenStreetMap: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map),
  }

  // ฟังก์ชันหลักในการโหลด shapefile
  async function loadShapefile(filePath: string, featureGroups: FeatureGroups, filterGroup: L.FeatureGroup): Promise<void> {
    try {
      const response = await fetch(filePath);
      const arrayBuffer = await response.arrayBuffer();
      const rawGeojson = await shp.parseShp(arrayBuffer);

      if (!rawGeojson || !Array.isArray(rawGeojson)) {
        throw new Error(`Invalid GeoJSON data from ${filePath}`);
      }

      const transformedGeojson = {
        type: 'FeatureCollection',
        features: rawGeojson.map((geometry: any) => ({
          type: 'Feature',
          geometry: geometry,
          properties: {},
        })),
      };

      transformedGeojson.features.forEach((feature, index) => {
        const { geometry } = feature;

        if (!geometry || !geometry.type || !geometry.coordinates) {
          return;
        }

        const coords = geometry.coordinates;
        let layer: L.Layer | null = null;

        if (geometry.type === 'Point') {
          const latLng = convertUtmToLatLng([coords[0], coords[1]]);
          if (latLng) {
            layer = L.marker([latLng[1], latLng[0]]);
            layer.addTo(featureGroups.point);
          }
        } else if (geometry.type === 'MultiLineString') {
          coords.forEach((line: any[]) => {
            const latLngLine = line
              .map((coord) => {
                if (Array.isArray(coord) && coord.length >= 2) {
                  const latLng = convertUtmToLatLng([coord[0], coord[1]]);
                  return latLng ? [latLng[1], latLng[0]] : null;
                }
                return null;
              })
              .filter(Boolean);

            if (latLngLine.length > 1) {
              layer = L.polyline(latLngLine, { color: 'red', weight: 2 });
              layer.addTo(featureGroups.multipleLineString);
            }
          });
        } else if (geometry.type === 'LineString') {
          const latLngLine = coords
            .map((coord) => {
              if (Array.isArray(coord) && coord.length >= 2) {
                const latLng = convertUtmToLatLng([coord[0], coord[1]]);
                return latLng ? [latLng[1], latLng[0]] : null;
              }
              return null;
            })
            .filter(Boolean);

          if (latLngLine.length > 1) {
            layer = L.polyline(latLngLine, { color: 'blue', weight: 2 });
            layer.addTo(featureGroups.lineString);
          }
        } else if (geometry.type === 'Polygon') {
          const latLngPolygon = coords[0]
            .map((coord) => {
              if (Array.isArray(coord) && coord.length >= 2) {
                const latLng = convertUtmToLatLng([coord[0], coord[1]]);
                return latLng ? [latLng[1], latLng[0]] : null;
              }
              return null;
            })
            .filter(Boolean);

          if (latLngPolygon.length > 2) {
            layer = L.polygon(latLngPolygon, { color: 'green', weight: 2 });
            layer.addTo(featureGroups.polygon);
          }
        } else if (geometry.type === 'MultiPolygon') {
          coords.forEach((polygonCoords: any[]) => {
            const latLngPolygon = polygonCoords
              .map((coord) => {
                if (Array.isArray(coord) && coord.length >= 2) {
                  const latLng = convertUtmToLatLng([coord[0], coord[1]]);
                  return latLng ? [latLng[1], latLng[0]] : null;
                }
                return null;
              })
              .filter(Boolean);

            if (latLngPolygon.length > 2) {
              layer = L.polygon(latLngPolygon, {
                color: 'purple',
                weight: 2,
                fillColor: '#ff00ff',
                fillOpacity: 0.5,
              });
              layer.addTo(featureGroups.multiplePolygon);
            }
          });
        } else {
          console.warn(`Unsupported geometry type at index ${index}:`, geometry);
        }

        if (layer) {
          layer.addTo(filterGroup);
        }
      });
    } catch (error) {
      console.error(`Error loading shapefile from ${filePath}:`, error);
    }
  }

  const filterAreas = {
    'แปลงที่ดิน_bangsue': L.featureGroup().addTo(map),
    'เส้นรางทางประธาน': L.featureGroup().addTo(map),
    'แนวเขตกรรมสิทธิ์ที่ดินรถไฟ(R.O.W.)': L.featureGroup().addTo(map),
  };

  // Call the function for multiple files
  const shapefiles = [
    {
      path: '/แปลงที่ดิน_bangsue.shp',
      groups: { drawnItems, lineString, multipleLineString, polygon, multiplePolygon, point },
      filterGroup: filterAreas['แปลงที่ดิน_bangsue'],
    },
    {
      path: '/เส้นรางทางประธาน.shp',
      groups: { drawnItems, lineString, multipleLineString, polygon, multiplePolygon, point },
      filterGroup: filterAreas['เส้นรางทางประธาน'],
    },
    {
      path: '/แนวเขตกรรมสิทธิ์ที่ดินรถไฟ(R.O.W.).shp',
      groups: { drawnItems, lineString, multipleLineString, polygon, multiplePolygon, point },
      filterGroup: filterAreas['แนวเขตกรรมสิทธิ์ที่ดินรถไฟ(R.O.W.)'],
    },
  ]

  shapefiles.forEach(({ path, groups, filterGroup }) => loadShapefile(path, groups, filterGroup))

  // Add feature groups to the map
  map.addLayer(drawnItems)
  map.addLayer(lineString)
  map.addLayer(multipleLineString)
  map.addLayer(polygon)
  map.addLayer(multiplePolygon)
  map.addLayer(point)

  Object.values(filterAreas).forEach((filterGroup) => map.addLayer(filterGroup));

  const overlayMaps = {
    Drawn: drawnItems,
    LineString: lineString,
    MultipleLineString: multipleLineString,
    Polygon: polygon,
    MultiplePolygon: multiplePolygon,
    Point: point
  }

  const filterArea = {
    'พื้นที่ A': L.featureGroup().addTo(map),
    'พื้นที่ B': L.featureGroup().addTo(map),
    'แปลงที่ดิน_bangsue': filterAreas['แปลงที่ดิน_bangsue'],
    'เส้นรางทางประธาน': filterAreas['เส้นรางทางประธาน'],
    'แนวเขตกรรมสิทธิ์ที่ดินรถไฟ(R.O.W.)': filterAreas['แนวเขตกรรมสิทธิ์ที่ดินรถไฟ(R.O.W.)'],
  }

  L.control.layers(baseMaps, overlayMaps, { collapsed: false }).addTo(map)

  L.control.layers({}, filterArea, { collapsed: true }).addTo(map)

  // Function to get all saved shapes

  // CONTROL
  map.pm.addControls({
    position: 'topleft',
    drawCircle: true,
    drawCircleMarker: false,
    drawPolyline: true,
    drawPolygon: true,
    drawMarker: true,
    cutPolygon: true,
  })

  map.pm.addControls({
    positions: {
      draw: 'topright',
      edit: 'topleft',
    },
  })
  // END CONTROL

  // CUSTOM TOOLS
  const actions = [
    {
      text: 'สร้าง',
    },
    {
      text: 'กด  alert',
      onClick: () => {
        alert('test')
      },
    },
  ]

  map.pm.Toolbar.copyDrawControl('Rectangle', {
    name: 'RectangleCopy',
    block: 'custom',
    title: 'Display text on hover button',
    actions: actions,
  })

  map.pm.Toolbar.createCustomControl({
    name: 'StarButton',
    block: 'custom',
    title: 'Star Button',
    className: 'fas fa-star',
    actions: actions,
  })

  // SHAPE CREATED
  map.on('pm:create', (e) => {
    const layer = e.layer as CustomLayer;
    let latlng: L.LatLng;

    if (layer instanceof L.Circle || layer instanceof L.Rectangle || layer instanceof L.Polygon) {
      latlng = layer.getBounds().getCenter();
    } else if (layer instanceof L.Marker) {
      latlng = layer.getLatLng();
    } else if (layer instanceof L.Polyline) {
      const latLngs = layer.getLatLngs();
      if (Array.isArray(latLngs) && latLngs.length > 0) {
        const middleIndex = Math.floor(latLngs.length / 2);
        latlng = Array.isArray(latLngs[0])
          ? (latLngs[0] as L.LatLng[])[middleIndex]
          : latLngs[middleIndex] as L.LatLng;
      }
    }

    const popUpCreate = `
    <div>ชื่อพื้นที่</div>
    <input type="text" id="name" />
    <div>ชนิด</div>
    <select id="type">
      <option value="a">A</option>
      <option value="b">B</option>
    </select>
    <button onclick="window.saveShapeData()" style="margin-top: 10px; padding: 5px;">บันทึก</button>
    `

    const popup = L.popup().setContent(popUpCreate)

    window.saveShapeData = () => {
      const name = (document.getElementById('name') as HTMLInputElement)?.value
      const type = (document.getElementById('type') as HTMLSelectElement)?.value

      if (layer.properties && layer.properties.type) {
        const oldGroup =
          layer.properties.type === 'a' ? filterArea['พื้นที่ A'] : filterArea['พื้นที่ B']
        oldGroup.removeLayer(layer)
      }

      layer.properties = {
        name: name || '',
        type: type || '',
        shape: e.shape || '',
        created: new Date().toISOString(),
      }

      const filterGroup = type === 'a' ? filterArea['พื้นที่ A'] : filterArea['พื้นที่ B']
      filterGroup.addLayer(layer)

      const savedPopup = `
      <div>
        <strong>ชื่อพื้นที่:</strong> ${name}<br>
        <strong>ชนิด:</strong> ${type}<br>
        <strong>รูปแบบ:</strong> ${e.shape}
      </div>
      `
      layer.bindPopup(savedPopup)

      map.closePopup(popup)

      console.log('Saved shape data:', layer.properties)

      test.value.push(layer)

      console.log('Saved All Shapes', test.value)
    }

    layer.on('mouseover', (e) => {
      if (!layer.properties) {
        return
      }

      const savedPopup = L.popup().setContent(`
      <div>
        <strong>ชื่อพื้นที่:</strong> ${layer.properties.name}<br>
        <strong>ชนิด:</strong> ${layer.properties.type}<br>
        <strong>รูปแบบ:</strong> ${layer.properties.shape}
      </div>
      `)
      savedPopup.setLatLng(e.latlng).openOn(map)
    })

    layer.on('click', () => {
      if (!layer.properties) {
        popup.setLatLng(latlng).openOn(map)
      } else {
        const editPopup = L.popup().setContent(`
        <div>ชื่อพื้นที่</div>
        <input type="text" id="name" value="${layer.properties.name}" />
        <div>ชนิด</div>
        <select id="type">
          <option value="a" ${layer.properties.type === 'a' ? 'selected' : ''}>A</option>
          <option value="b" ${layer.properties.type === 'b' ? 'selected' : ''}>B</option>
        </select>
        <button onclick="window.saveShapeData()" style="margin-top: 10px; padding: 5px;">บันทึก</button>
        `)
        editPopup.setLatLng(latlng).openOn(map)
      }
    })

    // layer.on('mouseout', () => {
    //   map.closePopup()
    // })

    drawnItems.addLayer(layer)
    lineString.addLayer(layer)
    multipleLineString.addLayer(layer)
    polygon.addLayer(layer)
    multiplePolygon.addLayer(layer)
    point.addLayer(layer)

    popup.setLatLng(latlng).openOn(map)
  })
  // END CLICK WITH POPUP

  // DRAWING START
  map.on('pm:drawstart', (e) => {
    if (e.shape === 'Line' || e.shape === 'Polygon' || e.shape === 'Rectangle') {
      const tempPopup = L.popup()

      map.on('mousemove', (ev) => {
        const { lat, lng } = ev.latlng

        let content = ''
        content += `<b>Position Marker:</b> Lat: ${lat.toFixed(6)}, Lon: ${lng.toFixed(6)}`

        tempPopup.setLatLng(ev.latlng).setContent(content).openOn(map)
      })

      map.on('pm:drawend', () => {
        map.closePopup(tempPopup)
        map.off('mousemove')
      })
    }
  })
  // END DRAWING START
})

watch(
  () => map,
  (newVal) => {
    if (newVal) {
      // Example: Log the current map center whenever the map reference changes
      console.log('Map center:', newVal.getCenter())
    }
  },
  { immediate: true }, // Ensure the watcher runs immediately after component mount
)
</script>

<style scoped>
#map {
  height: 100vh;
}

.coordinate-display {
  position: absolute;
  bottom: 10px;
  right: 20%;
  transform: translateX(-50%);
  background-color: white;
  padding: 5px 10px;
  border-radius: 4px;
  border: 2px solid rgba(0, 0, 0, 0.2);
  z-index: 1000;
  font-size: 15px;
}
</style>
