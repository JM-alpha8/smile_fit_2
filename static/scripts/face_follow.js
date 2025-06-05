// face_follow.js - 표정 따라하기 모드 JS (MediaPipe 기반)

let currentSessionTotalScore = 0;
let currentImageIndex = 1;
const totalImages = 50;
const baseImagePath = "/static/images/f_game/";

let faceMesh = null;
let teacherA = [], teacherB = [], userA = [], userB = [];

export function init() {
  loadUnityGame();
  setTimeout(() => setupFollowMode(), 300);
}

function drawGuideEllipse(canvas, video) {
  const ctx = canvas.getContext("2d");
  canvas.width = video.clientWidth;
  canvas.height = video.clientHeight;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "rgba(0, 255, 0, 0.6)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(canvas.width / 2, canvas.height / 2, canvas.width * 0.25, canvas.height * 0.38, 0, 0, 2 * Math.PI);
  ctx.stroke();
}

async function startFollowCamera(videoElement, callbackWhenReady) {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  videoElement.srcObject = stream;
  videoElement.onloadedmetadata = () => {
    videoElement.play();
    callbackWhenReady?.();
  };
}

function waitForImageLoad(img) {
  return new Promise((resolve) => {
    if (img.complete && img.naturalWidth > 0) {
      resolve();
    } else {
      img.onload = () => resolve();
      img.onerror = () => resolve(); // 실패해도 resolve해서 안 멈추게
    }
  });
}

export async function setupFollowMode() {
  console.log("[FollowMode] Initializing follow mode...");

  const imageA = document.getElementById("follow-imageA");
  const imageB = document.getElementById("follow-imageB");
  const video = document.getElementById("follow-video");
  const canvas = document.getElementById("follow-guideCanvas");
  const captureABtn = document.getElementById("follow-captureA_Btn");
  const captureBBtn = document.getElementById("follow-captureB_Btn");

  if (!imageA || !imageB || !video || !canvas || !captureABtn || !captureBBtn) {
    console.error("[FollowMode] 필수 요소가 누락되었습니다.");
    return;
  }

  faceMesh = new FaceMesh({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}` });
  faceMesh.setOptions({ maxNumFaces: 1, refineLandmarks: true, minDetectionConfidence: 0.5 });
  await faceMesh.initialize();

  await setReferenceImages();

  await waitForImageLoad(imageA);
  await waitForImageLoad(imageB);

  teacherA = await extractLandmarks(imageA);
  teacherB = await extractLandmarks(imageB);

  captureABtn.disabled = false;
  captureBBtn.disabled = true;

  captureABtn.onclick = async () => {
    userA = await captureAndExtract(video);
    captureABtn.disabled = true;
    captureBBtn.disabled = false;
  };

  captureBBtn.onclick = async () => {
    userB = await captureAndExtract(video);
    captureBBtn.disabled = true;
    calculateScore();
  };
}

function waitForVideoReady(video, callback) {
  const check = () => {
    if (video.readyState >= 2) {
      callback();
    } else {
      setTimeout(check, 100);
    }
  };
  check();
}

async function setReferenceImages() {
  const imageA = document.getElementById("follow-imageA");
  const imageB = document.getElementById("follow-imageB");
  imageA.src = `${baseImagePath}${currentImageIndex}.png`;
  imageB.src = `${baseImagePath}${currentImageIndex + 1}.png`;
}

function calculateScore() {
  const normTeacherA = normalizeLandmarksByMidpoint(teacherA);
  const normTeacherB = normalizeLandmarksByMidpoint(teacherB);
  const normUserA = normalizeLandmarksByMidpoint(userA);
  const normUserB = normalizeLandmarksByMidpoint(userB);

  const landmarkPairs = {
    "입꼬리(우)": [291, 446],
    "입꼬리(좌)": [61, 226],
    "입벌림": [1, 152],
    "눈썹(우)": [334, 386],
    "눈썹(좌)": [105, 159],
    "눈감기(우)": [386, 374],
    "눈감기(좌)": [159, 145],
    "찡그리기(우)": [285, 437],
    "찡그리기(좌)": [217, 55],
    "입술오므리기": [61, 291],
  };

  const epsilon = 0.001;
  let totalScore = 0;
  let count = 0;

  for (const [name, [i1, i2]] of Object.entries(landmarkPairs)) {
      if (
        !normTeacherA[i1] || !normTeacherA[i2] ||
        !normTeacherB[i1] || !normTeacherB[i2] ||
        !normUserA[i1] || !normUserA[i2] ||
        !normUserB[i1] || !normUserB[i2]
      ) {
        console.warn(`[${name}] 랜드마크 누락 - 건너뜀`);
        continue;
      }
    const teacherDist = calcDistance(normTeacherB[i1], normTeacherB[i2]) - calcDistance(normTeacherA[i1], normTeacherA[i2]);
    const userDist = calcDistance(normUserB[i1], normUserB[i2]) - calcDistance(normUserA[i1], normUserA[i2]);

    const diff = Math.abs(teacherDist - userDist);
    const sim = 1 - diff / ((Math.abs(teacherDist) + epsilon) * 3);
    const score = Math.max(0, Math.min(1, sim)) * 10;

    totalScore += score;
    count++;
  }

  const avgScore = Math.round(totalScore / count);

  currentSessionTotalScore += avgScore;

  const scoreDisplay = document.getElementById("follow-scoreDisplay");
  const totalScoreDisplay = document.getElementById("session-total-score-display-follow");
  if (scoreDisplay) scoreDisplay.innerHTML = `이번 점수: <b>${avgScore} / 10</b>`;
  if (totalScoreDisplay) totalScoreDisplay.innerText = `총 점수: ${currentSessionTotalScore}`;

  currentImageIndex += 2;
  setTimeout(() => setupFollowMode(), 1000);
}

function calcDistance(pt1, pt2) {
  return Math.hypot(pt1[0] - pt2[0], pt1[1] - pt2[1]);
}

function normalizeLandmarksByMidpoint(landmarks) {
  if (!landmarks || landmarks.length < 200) return landmarks; // fallback
  const left = landmarks[168];
  const right = landmarks[5];
  const baseDist = calcDistance(left, right) || 1;
  return landmarks.map(([x, y]) => [x / baseDist, y / baseDist]);
}


async function extractLandmarks(imgElement) {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width = imgElement.naturalWidth || 300;
    canvas.height = imgElement.naturalHeight || 225;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(imgElement, 0, 0);

    faceMesh.onResults((results) => {
      if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        const landmarks = results.multiFaceLandmarks[0].map(pt => [pt.x, pt.y]);
        resolve(landmarks);
      } else {
        resolve([]);
      }
    });

    faceMesh.send({ image: canvas });
  });
}

async function captureAndExtract(videoElement) {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(videoElement, 0, 0);

    faceMesh.onResults((results) => {
      if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        const landmarks = results.multiFaceLandmarks[0].map(pt => [pt.x, pt.y]);
        resolve(landmarks);
      } else {
        resolve([]);
      }
    });

    faceMesh.send({ image: canvas });
  });
}

import { loadUnityGame } from "./unity_loader.js";

    export async function ShowFacialRecognitionUI_JS(modeFromUnity, attempt = 1) {
      console.log(`[follow] ShowFacialRecognitionUI_JS called. Mode: ${modeFromUnity}, Attempt: ${attempt}`);

       // 점수 초기화
      currentSessionTotalScore = 0;
      let sessionTotalScoreDisplayElement = document.getElementById('session-total-score-display-follow');
      if (sessionTotalScoreDisplayElement) sessionTotalScoreDisplayElement.innerText = '총 점수: 0';

      const modal = document.getElementById('facial-recognition-modal');
      const followVideo = document.getElementById("follow-video");
      const followGuideCanvas = document.getElementById("follow-guideCanvas");
      const followModeUI = document.getElementById('follow-mode-ui');
      const guideCanvas = document.getElementById('follow-guideCanvas');
      if (!modal || !followModeUI) return;

      modal.style.display = 'flex';
      followModeUI.style.display = 'block';
      if (guideCanvas) guideCanvas.style.display = 'block';

      // 캠 시작
      await startFollowCamera(followVideo, () => {
        console.log("팔로우 모드 캠 시작됨");

        // 🎯 비디오가 제대로 그려진 뒤 캔버스 가이드라인 그리기
        waitForVideoReady(followVideo, () => {
          drawGuideEllipse(followGuideCanvas, followVideo);
        });
      });

      // 첫 표정 세팅
      await setReferenceImages();

      const btn = document.getElementById('follow-captureBtn');
      btn?.removeEventListener('click', handleFollowCapture);
      btn?.addEventListener('click', handleFollowCapture);
    }

    export function closeFacialModal(mode = null, reason = "manual_close") {
      const modal = document.getElementById("facial-recognition-modal");
      if (modal) modal.style.display = "none";

      const score = currentSessionTotalScore ?? 0;

      // ✅ Unity로 점수 또는 중단 메시지 전송
      if (window.unityGameInstance) {
        if (reason.startsWith("session_ended_by_unity")) {
          console.log("✅ Unity로 최종 점수 전송:", score);
          window.unityGameInstance.SendMessage('CostManagerObject', 'ReceiveFacialScore', score);
        } else {
          console.log("🛑 Unity에 운동 중단 알림 전송");
          window.unityGameInstance.SendMessage('CostManagerObject', 'FacialExerciseAborted', 0);
        }
      }

      // ✅ 캠 스트림 정리
      const video = (mode === 'follow_expression')
        ? document.getElementById("emotion-video")
        : document.getElementById("follow-video");

      if (video && video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
        video.srcObject = null;
      }

      // ✅ 점수 초기화
      currentSessionTotalScore = 0;
    }

// Unity에서 호출 가능하도록 등록
window.ShowFacialRecognitionUI_JS = ShowFacialRecognitionUI_JS;
window.closeFacialModal = closeFacialModal;

