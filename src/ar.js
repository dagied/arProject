import * as THREE from 'three';
import { ARButton } from 'three/examples/jsm/webxr/ARButton.js';
import { XREstimatedLight } from 'three/examples/jsm/webxr/XREstimatedLight.js';
import { createObject, baseOffsetY, disposeObject } from './objects.js';
import { setHint, getSelectedShape, initUI } from './ui.js';

const state = {
  hitTestSource: null,
  hitTestSourceRequested: false,
  reticle: null,
  placed: [],
  viewerSpace: null,
  session: null,
};

let renderer, scene, camera, controller;
let hemiLight, dirLight, estimatedLight;
let useEstimatedLight = false;

export function initAR(container) {
  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    0.01,
    20
  );

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  // Default lights (used when light-estimation is unavailable)
  hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
  scene.add(hemiLight);

  dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(0.5, 1.5, 0.5);
  scene.add(dirLight);

  // Reticle – flat ring; matrix is written directly from hit-test pose
  const ringGeo = new THREE.RingGeometry(0.06, 0.075, 32);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
  });
  state.reticle = new THREE.Mesh(ringGeo, ringMat);
  state.reticle.matrixAutoUpdate = false;
  state.reticle.visible = false;
  scene.add(state.reticle);

  // Primary controller – “select” fires on screen tap in immersive-ar
  controller = renderer.xr.getController(0);
  controller.addEventListener('select', onSelect);
  scene.add(controller);

  initUI({
    onUndo: undoLast,
    onClear: clearAll,
  });

  const overlayRoot = document.getElementById('overlay');
  const button = ARButton.createButton(renderer, {
    requiredFeatures: ['hit-test'],
    optionalFeatures: ['dom-overlay', 'light-estimation'],
    domOverlay: { root: overlayRoot },
  });
  document.body.appendChild(button);

  renderer.xr.addEventListener('sessionstart', onSessionStart);
  renderer.xr.addEventListener('sessionend', onSessionEnd);

  window.addEventListener('resize', onResize);

  renderer.setAnimationLoop(render);
  setHint('idle');
}

function onSessionStart() {
  state.session = renderer.xr.getSession();
  setHint('scanning');

  // Try light estimation – XREstimatedLight will only emit events if the
  // feature was granted by the session.
  estimatedLight = new XREstimatedLight(renderer);
  estimatedLight.addEventListener('estimationstart', () => {
    scene.add(estimatedLight);
    scene.remove(hemiLight);
    scene.remove(dirLight);
    useEstimatedLight = true;
  });
  estimatedLight.addEventListener('estimationend', () => {
    scene.add(hemiLight);
    scene.add(dirLight);
    scene.remove(estimatedLight);
    useEstimatedLight = false;
  });
}

function onSessionEnd() {
  if (state.hitTestSource) {
    state.hitTestSource.cancel();
    state.hitTestSource = null;
  }
  state.hitTestSourceRequested = false;
  state.viewerSpace = null;
  state.session = null;
  state.reticle.visible = false;
  setHint('idle');

  if (useEstimatedLight && estimatedLight) {
    scene.remove(estimatedLight);
    scene.add(hemiLight);
    scene.add(dirLight);
    useEstimatedLight = false;
  }
  estimatedLight = null;
}

async function setupHitTest(session) {
  if (state.hitTestSourceRequested) return;
  state.hitTestSourceRequested = true;

  try {
    const refSpace = await session.requestReferenceSpace('viewer');
    state.viewerSpace = refSpace;
    state.hitTestSource = await session.requestHitTestSource({ space: refSpace });
  } catch (err) {
    console.warn('Hit-test source failed:', err);
    state.hitTestSourceRequested = false;
  }
}

function onSelect() {
  if (!state.reticle.visible) return;

  const shape = getSelectedShape();
  const mesh = createObject(shape);

  // Copy reticle pose, then offset so the mesh base rests on the surface
  mesh.position.setFromMatrixPosition(state.reticle.matrix);
  mesh.quaternion.setFromRotationMatrix(state.reticle.matrix);
  mesh.position.y += baseOffsetY(mesh);

  scene.add(mesh);
  state.placed.push(mesh);
  setHint('ready');
}

function undoLast() {
  const mesh = state.placed.pop();
  if (!mesh) return;
  scene.remove(mesh);
  disposeObject(mesh);
}

function clearAll() {
  while (state.placed.length) {
    const mesh = state.placed.pop();
    scene.remove(mesh);
    disposeObject(mesh);
  }
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function render(timestamp, frame) {
  // Gentle continuous rotation of every placed object
  const t = timestamp * 0.001;
  for (const mesh of state.placed) {
    mesh.rotation.y = t * 0.4;
  }

  if (frame) {
    const session = renderer.xr.getSession();
    if (session && !state.hitTestSourceRequested) {
      setupHitTest(session);
    }

    if (state.hitTestSource) {
      const referenceSpace = renderer.xr.getReferenceSpace();
      const hits = frame.getHitTestResults(state.hitTestSource);

      if (hits.length > 0) {
        const pose = hits[0].getPose(referenceSpace);
        if (pose) {
          state.reticle.visible = true;
          state.reticle.matrix.fromArray(pose.transform.matrix);
          setHint('ready');
        }
      } else {
        state.reticle.visible = false;
        if (session) setHint('scanning');
      }
    }
  }

  renderer.render(scene, camera);
}