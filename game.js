import * as STEREO from "./autostereogram.js";
import * as THREE from "https://threejsfundamentals.org/threejs/resources/threejs/r115/build/three.module.js";

import { GLTFLoader } from "https://threejsfundamentals.org/threejs/resources/threejs/r115/examples/jsm/loaders/GLTFLoader.js";

var renderer, scene, camera;
var clock = new THREE.Clock();

var aStereo, gui;

var gltfLoader, mixer;

var models = {
  icosahedron: {
    model: new THREE.Mesh(
      new THREE.IcosahedronGeometry(2.5, 0),
      new THREE.MeshStandardMaterial()
    ),
    position: new THREE.Vector3(0, 0, -4),
  },
  horse: {
    file: "Horse.glb",
    scale: 5,
    position: new THREE.Vector3(0, -0.2, -1.5),
  },
  flamingo: {
    file: "Flamingo.glb",
    scale: 5,
    position: new THREE.Vector3(0, 0, -2),
  },
  parrot: {
    file: "Parrot.glb",
    scale: 3,
    position: new THREE.Vector3(0, 0, -2),
  },
};
var currentModel;

var guiSettings = { model: "", autoRotate: true, show: "stereo" };

function setupScene() {
  renderer = new THREE.WebGLRenderer();

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  document.body.appendChild(renderer.domElement);
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    4
  );

  window.addEventListener("resize", onWindowResize, false);

  gltfLoader = new GLTFLoader();
  loadAnimal("icosahedron");

  aStereo = new STEREO.AutostereogramRenderer(renderer, camera, scene);

  //camera.position.y = 100;
  setupGUI();

  let light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(0, 1, 0);
  scene.add(light);

  let ambient = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambient);
}

function loadAnimal(name) {
  if (models[name] == undefined) return;

  guiSettings.model = name;

  if (currentModel) scene.remove(currentModel);

  if (models[name].model) {
    currentModel = models[name].model;
    currentModel.position.copy(models[name].position);
    scene.add(currentModel);
    return;
  }

  gltfLoader.load("models/" + models[name].file, function (model) {
    currentModel = model.scene.clone();
    currentModel.mixer = new THREE.AnimationMixer(currentModel);
    model.animations.forEach((clip) => {
      currentModel.mixer.clipAction(clip).play();
    });

    let box = new THREE.Box3().setFromObject(currentModel);
    let scale = new THREE.Vector3();
    box.getSize(scale);
    let maxDimension = Math.max(scale.x, scale.y, scale.z);
    currentModel.scale.multiplyScalar(models[name].scale / maxDimension);
    let center = new THREE.Vector3();
    box.getCenter(center);
    for (let c of currentModel.children) {
      c.position.sub(center);
    }

    currentModel.position.copy(models[name].position);
    scene.add(currentModel);
  });
}

function setupGUI() {
  gui = new dat.GUI();
  gui.add(aStereo, "tileScale", 10, 500);
  gui.add(aStereo, "maxStep", 0.01, 0.9);
  gui
    .add(guiSettings, "show", ["original", "depth", "stereo"])
    .onChange((v) => {
      aStereo.show(v);
    });
  gui
    .add(guiSettings, "model", Object.keys(models))
    .onChange((v) => loadAnimal(v));
  gui.add(guiSettings, "autoRotate");
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);

  aStereo.setup();
}

function animate() {
  requestAnimationFrame(animate);

  var delta = clock.getDelta();
  if (currentModel && currentModel.mixer) {
    currentModel.mixer.update(delta);
  }
  if (currentModel && guiSettings.autoRotate) {
    currentModel.rotation.y += delta;
  }

  aStereo.render();
}

setupScene();
animate();
