
import { initAR } from './ar.js';
import { showUnsupported } from './ui.js';

async function start() {
  // Feature detect WebXR AR before touching the renderer
  if (!navigator.xr) {
    showUnsupported();
    return;
  }

  let supported = false;
  try {
    supported = await navigator.xr.isSessionSupported('immersive-ar');
  } catch {
    supported = false;
  }

  if (!supported) {
    showUnsupported();
    return;
  }

  // Remove any leftover Vite scaffold element
  const app = document.getElementById('app');
  if (app) app.remove();

  initAR(document.body);
}

start();
