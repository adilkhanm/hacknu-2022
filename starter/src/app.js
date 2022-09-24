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
  subscribeKey: "sub-c-bd5e7bdb-4007-4ebd-b9c8-1f344613d945",
  userId: "client",
});

const apiOptions = {
  "apiKey": "AIzaSyDOgJ-0ARoatmn6vcen5vCuDimcqS114Lk",
  "version": "beta"
};

const mapOptions = {
  "tilt": 60,
  "heading": 90,
  "zoom": 19,
  "center": { lat: 0, lng: 0 },
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

function getLatLngAltitudeLiteral() {
  return {
    lat: location_data.latitude,
    lng: location_data.longitude,
    altitude: location_data.altitude
  }
}

let webGLOverlayViewInitialized = false;

const pnChannel = "location_channel";
pubnub.subscribe({channels: [pnChannel]});
pubnub.addListener({
  message: function(receiveMessage) {
    location_data = receiveMessage.message;
    if (!webGLOverlayViewInitialized) {
      webGLOverlayViewInitialized = true;
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

function loadPersonalMark(scene) {
  let loader = new GLTFLoader();
  const source = 'pin.gltf';
  loader.load(
      source,
      gltf => {
        gltf.scene.rotation.x = 180 * Math.PI/180;
        gltf.scene.rotation.z = 90 * Math.PI/180;
        // gltf.scene.position.setZ(location_data.verAccuracy * 2);
        gltf.scene.name = "mark";
        scene.add(gltf.scene);
      }
  );
}

function getCylinder(horizontalAccuracy, verticalAccuracy) {
  const radiusTop = horizontalAccuracy;
  const radiusBottom = horizontalAccuracy;
  const height = verticalAccuracy * 2;
  const radialSegments = horizontalAccuracy * 2;
  const geometry = new THREE.CylinderBufferGeometry(radiusTop, radiusBottom, height, radialSegments);
  const material = new THREE.MeshPhongMaterial( {color: 0x0000ff, opacity: 0.5} );
  material.transparent = true;
  const cylinder = new THREE.Mesh( geometry, material );
  cylinder.rotation.x = 90 * Math.PI / 180;
  cylinder.name = "cylinder";
  return cylinder;
}

function initWebGLOverlayView (map) {
  let scene, renderer, camera;
  // WebGLOverlayView code goes here
  const webGLOverlayView = new google.maps.WebGLOverlayView();
  webGLOverlayView.onAdd = () => {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera();
    const ambientLight = new THREE.AmbientLight( 0xffffff, 0.75 ); // soft white light
    scene.add( ambientLight );
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.25);
    directionalLight.position.set(0, 0, 1);
    scene.add(directionalLight);

    loadPersonalMark(scene);
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
    // console.log(scene.children[2].name);

    scene.children[2] = getCylinder(location_data.horAccuracy, location_data.verAccuracy);

    webGLOverlayView.requestRedraw();
    renderer.render(scene, camera);
    renderer.resetState();
  };

  webGLOverlayView.setMap(map)
}



(async () => {        
  map = await initMap();
})();