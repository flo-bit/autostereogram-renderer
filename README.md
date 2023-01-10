# real time autostereogram renderer

This is a simple real time autostereogram renderer written in javascript using three.js

## Demo

[see a demo here](https://flo-bit.github.io/autostereogram-renderer/) (warning: fast moving images)

## Usage

```javascript
// import three.js and autostereogram renderer
import * as THREE from "https://threejsfundamentals.org/threejs/resources/threejs/r115/build/three.module.js";
import * as STEREO from "./autostereogram.js";

// create your own three.js renderer, scene and camera and add some objects
var renderer = new THREE.WebGLRenderer();

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);
var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  4
);

// create example mesh
let mesh = new THREE.Mesh(
  new THREE.IcosahedronGeometry(2.5, 0),
  new THREE.MeshStandardMaterial()
);
mesh.position.z = -4;
scene.add(mesh);

// create a new autostereogram renderer, pass the three.js renderer, scene and camera
var stereo = new STEREO.AutostereogramRenderer(renderer, camera, scene);

// render the autostereogram
stereo.render();
```

## License

MIT License. See LICENSE file for details.
