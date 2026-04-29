const FACE_API_SCRIPT_URL =
  "https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js";
const REMOTE_MODEL_PATH = "https://justadudewhohacks.github.io/face-api.js/models";

let scriptPromise = null;
let modelPromise = null;

const loadFaceApiScript = async () => {
  if (window.faceapi) return window.faceapi;
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = FACE_API_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve(window.faceapi);
    script.onerror = () => reject(new Error("Failed to load face-api.js script."));
    document.body.appendChild(script);
  });

  return scriptPromise;
};

export const ensureFaceModels = async (modelPath = "/face-models") => {
  const faceapi = await loadFaceApiScript();
  if (modelPromise) {
    await modelPromise;
    return faceapi;
  }

  modelPromise = (async () => {
    const sources = Array.from(new Set([modelPath, REMOTE_MODEL_PATH]));
    let lastError = null;
    for (const source of sources) {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(source),
          faceapi.nets.faceLandmark68TinyNet.loadFromUri(source),
          faceapi.nets.faceRecognitionNet.loadFromUri(source)
        ]);
        return;
      } catch (error) {
        lastError = error;
      }
    }
    throw (
      lastError ||
      new Error("Face model files could not be loaded from local or remote source.")
    );
  })();

  try {
    await modelPromise;
  } catch (error) {
    modelPromise = null;
    throw error;
  }
  return faceapi;
};

export const startCamera = async (videoEl) => {
  if (!videoEl) throw new Error("Video element missing.");
  const constraintsToTry = [
    {
      video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false
    },
    {
      video: true,
      audio: false
    }
  ];

  let stream = null;
  let lastError = null;
  for (const constraints of constraintsToTry) {
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (stream) break;
    } catch (error) {
      lastError = error;
    }
  }
  if (!stream) {
    const reason = lastError?.name ? `${lastError.name}: ${lastError.message}` : "Unknown camera error";
    throw new Error(
      `Camera access failed. ${reason}. Check permission, device connection, and browser camera settings.`
    );
  }
  videoEl.srcObject = stream;
  await videoEl.play();
  return stream;
};

export const stopCamera = (stream) => {
  if (!stream) return;
  stream.getTracks().forEach((track) => track.stop());
};

const averagePoint = (points) => {
  if (!points || points.length === 0) return { x: 0, y: 0 };
  const total = points.reduce(
    (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
    { x: 0, y: 0 }
  );
  return { x: total.x / points.length, y: total.y / points.length };
};

const pointDistance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

const eyeAspectRatio = (eye) => {
  if (!eye || eye.length < 6) return 0;
  const a = pointDistance(eye[1], eye[5]);
  const b = pointDistance(eye[2], eye[4]);
  const c = pointDistance(eye[0], eye[3]);
  if (!c) return 0;
  return (a + b) / (2 * c);
};

const estimateHeadTurn = (landmarks) => {
  const leftEyeCenter = averagePoint(landmarks.getLeftEye());
  const rightEyeCenter = averagePoint(landmarks.getRightEye());
  const nose = averagePoint(landmarks.getNose());

  const leftDistance = Math.abs(nose.x - leftEyeCenter.x);
  const rightDistance = Math.abs(rightEyeCenter.x - nose.x);
  if (!leftDistance || !rightDistance) return 0;

  const ratio = leftDistance / rightDistance;
  const normalized = Math.abs(ratio - 1);
  return Number((normalized * 35).toFixed(2));
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const captureFaceEmbeddingWithLiveness = async (videoEl, options = {}) => {
  const faceapi = await ensureFaceModels(options.modelPath || "/face-models");
  const timeoutMs = Number(options.timeoutMs || 6500);
  const startedAt = Date.now();
  const detectorOptions = new faceapi.TinyFaceDetectorOptions({
    inputSize: 224,
    scoreThreshold: 0.5
  });

  let blinkCount = 0;
  let wasEyeClosed = false;
  let maxHeadTurn = 0;
  let latestEmbedding = null;

  while (Date.now() - startedAt < timeoutMs) {
    const detection = await faceapi
      .detectSingleFace(videoEl, detectorOptions)
      .withFaceLandmarks(true)
      .withFaceDescriptor();

    if (detection?.descriptor) {
      latestEmbedding = Array.from(detection.descriptor);
      const landmarks = detection.landmarks;
      const leftEAR = eyeAspectRatio(landmarks.getLeftEye());
      const rightEAR = eyeAspectRatio(landmarks.getRightEye());
      const ear = (leftEAR + rightEAR) / 2;
      const headTurn = estimateHeadTurn(landmarks);
      if (headTurn > maxHeadTurn) maxHeadTurn = headTurn;

      if (ear < 0.21 && !wasEyeClosed) {
        wasEyeClosed = true;
      } else if (ear > 0.26 && wasEyeClosed) {
        blinkCount += 1;
        wasEyeClosed = false;
      }

      if (blinkCount >= 1 && maxHeadTurn >= 12) {
        return {
          embedding: latestEmbedding,
          liveness: {
            passed: true,
            blinkCount,
            headTurnAngle: maxHeadTurn
          }
        };
      }
    }

    await sleep(120);
  }

  if (!latestEmbedding) {
    throw new Error("Face not detected. Please align your face and try again.");
  }

  return {
    embedding: latestEmbedding,
    liveness: {
      passed: false,
      blinkCount,
      headTurnAngle: maxHeadTurn
    }
  };
};

export const captureFaceEmbedding = async (videoEl, options = {}) => {
  const faceapi = await ensureFaceModels(options.modelPath || "/face-models");
  const detectorOptions = new faceapi.TinyFaceDetectorOptions({
    inputSize: 224,
    scoreThreshold: 0.5
  });

  const detection = await faceapi
    .detectSingleFace(videoEl, detectorOptions)
    .withFaceLandmarks(true)
    .withFaceDescriptor();

  if (!detection?.descriptor) {
    throw new Error("No face detected. Keep your face centered and try again.");
  }

  const payload = {
    embedding: Array.from(detection.descriptor),
    score: Number((detection.detection?.score || 0).toFixed(4)),
    box: detection.detection?.box
      ? {
          x: Math.round(detection.detection.box.x),
          y: Math.round(detection.detection.box.y),
          width: Math.round(detection.detection.box.width),
          height: Math.round(detection.detection.box.height)
        }
      : null
  };

  return options.returnMeta ? payload : payload.embedding;
};

export const detectFaceStatus = async (videoEl, options = {}) => {
  const faceapi = await ensureFaceModels(options.modelPath || "/face-models");
  const detectorOptions = new faceapi.TinyFaceDetectorOptions({
    inputSize: 224,
    scoreThreshold: 0.5
  });

  const detection = await faceapi
    .detectSingleFace(videoEl, detectorOptions)
    .withFaceLandmarks(true);

  if (!detection) return { detected: false };
  return {
    detected: true,
    score: Number((detection.detection?.score || 0).toFixed(4)),
    box: detection.detection?.box
      ? {
          x: Math.round(detection.detection.box.x),
          y: Math.round(detection.detection.box.y),
          width: Math.round(detection.detection.box.width),
          height: Math.round(detection.detection.box.height)
        }
      : null
  };
};
