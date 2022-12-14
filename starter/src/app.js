// Copyright 2021 Google LLC

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at

//     https://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { Loader } from '@googlemaps/js-api-loader';

import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';

let map;

const Pubnub = require('pubnub');
const pubnub = new Pubnub({
  subscribeKey: PubnubSubscribeKey,
  userId: "client",
});

const apiOptions = {
  "apiKey": GoogleMapApiKey,
  "version": "beta"
};

const idealZoom = 19;

const mapOptions = {
  "tilt": 60,
  "heading": 90,
  "zoom": 12,
  "center": { lat: 51.1605, lng: 71.4704 },
  "mapId": "4c34c37db05ddaac"
}

let location_data = {
  "latitude": 35.66093428,
  "longitude": 139.7290334,
  "altitude": 0,
  "identifier": null,
  "timestamp": 4875,
  "floorLabel": null,
  "horAccuracy": 2.314,
  "verAccuracy": 0.612,
  "activity": "unknown"
}

function getLatLngAltitudeLiteral(data = location_data) {
  return {
    lat: data.latitude,
    lng: data.longitude,
    altitude: data.altitude
  }
}

const longitudeConst = 40075000.0;
const latitudeConst = 111320.0;

// function getVectorFromLiteral(data) {
//   return new THREE.Vector3(
//       data.lat / 360.0 * Math.cos(data.lat),
//       data.lng,
//       data.altitude);
// }

function getVectorFromLiteral(data) {
  let lat = Math.PI / 2.0 - data.lat;
  return new THREE.Vector3(
      Math.sin(lat) * Math.sin(data.lng),
      Math.cos(lat),
      data.altitude);
}

let webGLOverlayViewInitialized = false;

const pnChannel = "location_channel";
pubnub.subscribe({channels: [pnChannel]});
pubnub.addListener({
  message: function(receiveMessage) {
    location_data = receiveMessage.message;
    if (!webGLOverlayViewInitialized) {
      initWebGLOverlayView(map);
    }
  }
});

async function initMap() {    
  const mapDiv = document.getElementById("map");
  const apiLoader = new Loader(apiOptions);
  await apiLoader.load()
  return new google.maps.Map(mapDiv, mapOptions);
}

// function loadPersonalMark(scene) {
//   let loader = new GLTFLoader();
//   const source = 'pin.gltf';
//   loader.load(
//       source,
//       gltf => {
//         gltf.scene.rotation.x = 180 * Math.PI/180;
//         gltf.scene.rotation.z = 90 * Math.PI/180;
//         // gltf.scene.position.setZ(location_data.verAccuracy * 2);
//         gltf.scene.name = "mark";
//         scene.add(gltf.scene);
//       }
//   );
// }

function getSphere(radius) {
  const geometry = new THREE.SphereBufferGeometry(radius, 15, 15);
  const material = new THREE.MeshPhongMaterial( {color: 0x0000ff} );
  const sphere = new THREE.Mesh( geometry, material );
  sphere.name = "sphere";
  return sphere;
}

function getCylinder(horizontalAccuracy, verticalAccuracy) {
  const radiusTop = horizontalAccuracy;
  const radiusBottom = horizontalAccuracy;
  const height = verticalAccuracy * 2;
  const radialSegments = horizontalAccuracy * 2;
  const geometry = new THREE.CylinderBufferGeometry(radiusTop, radiusBottom, height, radialSegments);
  const material = new THREE.MeshPhongMaterial( {color: 0x0000ff, opacity: 0.3} );
  material.transparent = true;
  const cylinder = new THREE.Mesh( geometry, material );
  cylinder.rotation.x = 90 * Math.PI / 180;
  cylinder.name = "cylinder";
  return cylinder;
}

function initWebGLOverlayView (map) {
  // setup
  webGLOverlayViewInitialized = true;
  let locationHistory = [];
  let lineCoords = [];
  let polylineCoords = [];
  map.setZoom(idealZoom);

  let scene, renderer, camera;
  // WebGLOverlayView code goes here
  const webGLOverlayView = new google.maps.WebGLOverlayView();
  webGLOverlayView.onAdd = () => {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera();
    const ambientLight = new THREE.AmbientLight( 0xffffff, 0.50 ); // soft white light
    scene.add( ambientLight );
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.75);
    directionalLight.position.set(0, 0, 1);
    scene.add(directionalLight);

    // loadPersonalMark(scene);
    scene.add(getSphere(1.5));
    scene.add(getCylinder(location_data.horAccuracy, location_data.verAccuracy));

    map.setCenter(getLatLngAltitudeLiteral());

  };

  webGLOverlayView.onContextRestored = ({gl}) => {
    renderer = new THREE.WebGLRenderer({
      canvas: gl.canvas,
      context: gl,
      ...gl.getContextAttributes(),
    });
    renderer.autoClear = false;
  };

  webGLOverlayView.onDraw = ({gl, transformer}) => {
    const matrix = transformer.fromLatLngAltitude(getLatLngAltitudeLiteral());
    camera.projectionMatrix = new THREE.Matrix4().fromArray(matrix);

    scene.children[3] = getCylinder(location_data.horAccuracy, location_data.verAccuracy);
    const scaleValue = Math.pow(2, idealZoom - Math.min(19, map.getZoom()));
    scene.children[2].scale.set(scaleValue, scaleValue, 1);
    scene.children[3].scale.set(scaleValue, 1, scaleValue);

    let lastLocation = locationHistory.length ? locationHistory[locationHistory.length - 1] : null;
    if (!locationHistory.length || lastLocation.latitude !== location_data.latitude
        || lastLocation.longitude !== location_data.longitude
        || lastLocation.altitude !== location_data.altitude
        || lastLocation.activity !== location_data.activity) {

      if (lastLocation) {
        let latMid = (lastLocation.latitude + location_data.latitude) / 2.0;
        let m_per_deg_lat = 111132.954 - 559.822 * Math.cos(2.0 * latMid) + 1.175 * Math.cos(4.0 * latMid);
        let m_per_deg_lon = (Math.PI / 180) * 6367449 * Math.cos(latMid);
        // console.log(location_data.longitude);
        // console.log(location_data.latitude);
        // console.log("\n");
        let vectorDiff = new THREE.Vector3(
            (lastLocation.longitude - location_data.longitude) * m_per_deg_lon *
            ((location_data.longitude > -1 && location_data.longitude <= 0.0) || location_data.longitude < -90 ? 1 : -1),
            (lastLocation.latitude - location_data.latitude) * m_per_deg_lat,
            (lastLocation.altitude - location_data.altitude)
        );
        for (let i = 0; i < locationHistory.length; i++) {
          lineCoords[i].addVectors(lineCoords[i], vectorDiff);
        }
      }

      locationHistory.push(location_data);
      lineCoords.push(new THREE.Vector3(0, 0, 0));
      polylineCoords.push({lat: location_data.latitude, lng: location_data.longitude});
      const path = new google.maps.Polyline({
        path: polylineCoords,
        geodesic: true,
        strokeColor: 0xff0000,
        strokeOpacity: 1.0,
        strokeWeight: 2,
      });
      path.setMap(map);

      if (locationHistory.length >= 2) {
        let pathMaterial = new THREE.LineBasicMaterial({color: 0x0000ff});
        let tubeGeometry = new THREE.TubeGeometry(
            new THREE.CatmullRomCurve3(lineCoords),
            512,
            0.5,
            8,
            false
        );
        let line = new THREE.Line(tubeGeometry, pathMaterial);
        line.name = "location_path";
        if (scene.getObjectByName(line.name)) {
          scene.children[4] = line;
        } else {
          scene.add(line);
        }
      }

      let marker = new google.maps.Marker({
        position: {
          lat: location_data.latitude,
          lng: location_data.longitude
        },
        map,
        title: "marker" + (location_data.length - 1).toString()
      });
      const contentString =
          '<h2>Identifier: ' + (typeof(location_data.identifier) === 'string' ? location_data.identifier : 'none') + '</h2>' +
          '<h3>Activity: ' + (typeof(location_data.activity) === 'string' ? location_data.activity : 'none') + '</h3>' +
          '<h3>Floor: ' + (!isNaN(location_data.floorLabel) ?  location_data.floorLabel : 'none') + ' </h3>' +
          '<h4>Vertical Accuracy: ' + location_data.verAccuracy + '</h4>' +
          '<h4>Horizontal Accuracy: ' + location_data.horAccuracy + '</h4>';

      const infoWindow = new google.maps.InfoWindow({
        content: contentString,
      });
      marker.addListener("click", () => {
        infoWindow.open({
          anchor: marker,
          map,
          shouldFocus: false,
        });
      });
    }

    webGLOverlayView.requestRedraw();
    renderer.render(scene, camera);
    renderer.resetState();
  };

  webGLOverlayView.setMap(map)
}

(async () => {        
  map = await initMap();
})();