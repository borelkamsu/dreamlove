const Camera = (() => {
  let stream = null;
  let onCaptureCb = null;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="simple-modal camera-modal">
      <h3>Prendre une photo</h3>
      <video autoplay playsinline muted></video>
      <canvas style="display:none"></canvas>
      <div class="cam-actions">
        <button type="button" class="btn btn-outline" data-action="cancel">Annuler</button>
        <button type="button" class="btn btn-primary" data-action="capture">Capturer</button>
      </div>
    </div>
  `;
  document.addEventListener('DOMContentLoaded', () => document.body.appendChild(overlay));

  function stop() {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
    overlay.classList.remove('show');
  }

  async function open(onCapture) {
    onCaptureCb = onCapture;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 } },
        audio: false,
      });
    } catch (err) {
      showToast("Impossible d'accéder à la caméra");
      return;
    }
    const video = overlay.querySelector('video');
    video.srcObject = stream;
    overlay.classList.add('show');
  }

  overlay.addEventListener('click', (e) => {
    const action = e.target.dataset.action;
    if (action === 'cancel') {
      stop();
    } else if (action === 'capture') {
      const video = overlay.querySelector('video');
      const canvas = overlay.querySelector('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      canvas.toBlob(
        (blob) => {
          stop();
          if (onCaptureCb) onCaptureCb(blob);
        },
        'image/jpeg',
        0.9
      );
    }
  });

  return { open };
})();
