import * as THREE from "https://threejsfundamentals.org/threejs/resources/threejs/r115/build/three.module.js";

const postVertShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const postFragShader = `
#include <packing>

varying vec2 vUv;

uniform sampler2D tOriginal;
uniform sampler2D tDepth;
uniform sampler2D tTile;

uniform float u_camnear;
uniform float u_camfar;

uniform float u_showorig;
uniform float u_showdepth;

uniform vec2 u_res;

uniform float tileSize;
uniform float u_maxStep;

float readDepth(sampler2D depthSampler, vec2 coord) {
  float fragCoordZ = texture2D(depthSampler, coord).x;
  float viewZ = perspectiveDepthToViewZ(fragCoordZ, u_camnear, u_camfar);
  return 1.0 - viewZToOrthographicDepth(viewZ, u_camnear, u_camfar);
}
void main() {
  float depth = readDepth(tDepth, vUv);
  
  float maxStep = tileSize * u_maxStep;
  float d = 0.;

  vec2 uv = vUv * u_res;
  for(int count = 0; count < 100; count++) {
    if(uv.x < tileSize) break;

    float d = readDepth(tDepth, uv / u_res);
    uv.x -= tileSize - (d * maxStep);
  }
  float x = mod(uv.x, tileSize) / tileSize;
  float y = mod(uv.y, tileSize) / tileSize;
  
  vec3 stereogram_color = texture2D(tTile, vec2(x,y)).rgb;
  vec3 depth_color = vec3(readDepth(tDepth, vUv));
  vec3 orig_color = texture2D(tOriginal, vUv).rgb;

  gl_FragColor = vec4(mix(stereogram_color, mix(depth_color, orig_color, u_showorig), u_showdepth), 1.0);
}
`;

export class AutostereogramRenderer {
  constructor(renderer, camera, scene, opts) {
    opts = opts || {};
    if (!renderer.extensions.get("WEBGL_depth_texture")) {
      console.error("FATAL ERROR: depth_texture extension not available!");
      return undefined;
    }
    this.renderer = renderer;
    this.camera = camera;
    this.scene = scene;

    this.tileSize = opts.tileSize || 32;
    this.tileCount = opts.tileCount || 20;
    this.tiles = opts.tiles;
    this.palette = opts.palette;

    this.createTiles();
    this.setup();
  }

  setup() {
    // create a render target for the main scene
    if (this.target) this.target.dispose();

    this.target = new THREE.WebGLRenderTarget(
      window.innerWidth,
      window.innerHeight
    );
    this.target.texture.format = THREE.RGBFormat;
    this.target.texture.minFilter = THREE.NearestFilter;
    this.target.texture.magFilter = THREE.NearestFilter;
    this.target.texture.generateMipmaps = false;
    this.target.stencilBuffer = false;
    this.target.depthBuffer = true;
    this.target.depthTexture = new THREE.DepthTexture();
    this.target.depthTexture.format = THREE.DepthFormat;
    this.target.depthTexture.type = THREE.UnsignedShortType;

    // create an extra scene for postprocessing with a
    // quad showing depth texture of the main scene
    this.postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.postMaterial = new THREE.ShaderMaterial({
      vertexShader: postVertShader.trim(),
      fragmentShader: postFragShader.trim(),
      uniforms: {
        u_camnear: { value: this.camera.near },
        u_camfar: { value: this.camera.far },
        u_res: { value: [window.innerWidth, window.innerHeight] },
        u_showorig: { value: 0 },
        u_showdepth: { value: 0 },
        u_maxStep: { value: 0.3 },
        tileSize: { value: 100 },
        tTile: { value: null },
        tDepth: { value: null },
        tOriginal: { value: null },
      },
    });
    this.postScene = new THREE.Scene();
    var postQuad = new THREE.Mesh(
      new THREE.PlaneBufferGeometry(2, 2),
      this.postMaterial
    );
    this.postScene.add(postQuad);

    if (this.shown) this.show(this.shown);
  }

  render() {
    // render depth into depthTexture
    this.renderer.setRenderTarget(this.target);
    this.renderer.render(this.scene, this.camera);

    this.postMaterial.uniforms.tDepth.value = this.target.depthTexture;
    this.postMaterial.uniforms.tOriginal.value = this.target.texture;
    this.postMaterial.uniforms.tTile.value = this.randomTile();

    // render result into screen
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.postScene, this.postCamera);
  }

  createTiles() {
    if (this.tiles) return;

    if (!this.palette) {
      this.palette = AutostereogramRenderer.createRandomPalette(3);
      this.palette.push([0, 0, 0], [255, 255, 255]);
    }

    this.tiles = AutostereogramRenderer.createTexturesFromPalette(
      this.tileCount,
      this.tileSize,
      this.palette
    );
  }
  randomTile() {
    return this.tiles[Math.floor(Math.random() * this.tiles.length)];
  }

  get tileScale() {
    return this.postMaterial.uniforms.tileSize.value;
  }
  set tileScale(value) {
    this.postMaterial.uniforms.tileSize.value = value;
  }

  get maxStep() {
    return this.postMaterial.uniforms.u_maxStep.value;
  }
  set maxStep(value) {
    this.postMaterial.uniforms.u_maxStep.value = value;
  }

  /**
   * sets what to show in the postprocessing quad
   *
   * @param {string} option - valid values: "depth", "stereo", "original"
   */
  show(option) {
    this.shown = option;

    if (option == "depth") {
      this.postMaterial.uniforms.u_showdepth.value = 1.0;
      this.postMaterial.uniforms.u_showorig.value = 0.0;
    } else if (option == "stereo") {
      this.postMaterial.uniforms.u_showdepth.value = 0.0;
      this.postMaterial.uniforms.u_showorig.value = 0.0;
    } else if (option == "original") {
      this.postMaterial.uniforms.u_showdepth.value = 1.0;
      this.postMaterial.uniforms.u_showorig.value = 1.0;
    }
  }
  showDepth() {
    this.show("depth");
  }
  showStereo() {
    this.show("stereo");
  }
  showOriginal() {
    this.show("original");
  }

  static createTextureFromPalette(texSize, palette) {
    var data = new Uint8Array(3 * texSize * texSize);

    for (var i = 0; i < 3 * texSize * texSize; i += 3) {
      var ci = Math.floor(Math.random() * palette.length);
      let c = palette[ci];
      data[i] = c[0];
      data[i + 1] = c[1];
      data[i + 2] = c[2];
    }
    var tileTexture = new THREE.DataTexture(
      data,
      texSize,
      texSize,
      THREE.RGBFormat
    );
    tileTexture.wrapS = THREE.RepeatWrapping;
    tileTexture.wrapT = THREE.RepeatWrapping;
    return tileTexture;
  }
  static createTexturesFromPalette(num, texSize, palette) {
    let textures = [];
    for (let j = 0; j < num; j++) {
      textures.push(
        AutostereogramRenderer.createTextureFromPalette(texSize, palette)
      );
    }
    return textures;
  }
  static createRandomPalette(num) {
    let palette = [];
    for (let i = 0; i < num; i++) {
      var data = new Uint8Array(3);
      data[0] = Math.random() * 256;
      data[1] = Math.random() * 256;
      data[2] = Math.random() * 256;
      palette.push(data);
    }
    return palette;
  }

  /*

  // this is not working TODO fix it
  // current workaround is to call setup() after resize

  changeSize(w, h) {
    this.postMaterial.uniforms.u_res.values = [w, h];
    this.target.setSize(w, h);
    this.postCamera.aspect = w / h;
    this.postCamera.updateProjectionMatrix();
  }
  */
}
