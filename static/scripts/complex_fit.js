let stream = null;

export function init() {
  console.log("✅ complex_fit.js init() 호출됨");

  const video = document.getElementById('video');
  const canvas = document.getElementById('guide-canvas');
  const ctx = canvas.getContext('2d');
  const referenceImg = document.getElementById('reference-img');
  const roundText = document.getElementById('round');
  const checkMark = document.getElementById('check-mark');
  const submitBtn = document.getElementById('submit-btn');

  const TOTAL_ROUNDS = 10;
  let currentRound = 0; // ⭐️ 무표정은 0번 라운드로 간주
  let capturedImages = [];
  let neutralImage = null; // ⭐️ 무표정 이미지 저장용

  const teacher = sessionStorage.getItem('selectedTeacher');
  if (!teacher) {
    alert("선생님 정보가 없습니다. 이전 페이지로 이동합니다.");
    loadPage('complex');
    return;
  }

  // 캠 시작
  navigator.mediaDevices.getUserMedia({ video: true }).then(s => {
    stream = s;
    video.srcObject = stream;
  }).catch(err => {
    console.error("❌ 캠 접근 실패:", err);
    alert("카메라 권한을 허용해주세요.");
  });

  // 가이드 라인
  function drawEllipse() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    ctx.ellipse(canvas.width / 2, canvas.height / 2, 80, 100, 0, 0, 2 * Math.PI);
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.4)';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  setInterval(drawEllipse, 100);

  // 기준 이미지 업데이트
function updateReferenceImage() {
  const referenceImg = document.getElementById("reference-img");
  const refMessage = document.getElementById("ref-message");

  if (currentRound === 0) {
    referenceImg.style.display = "none";
    refMessage.style.display = "block";
    roundText.textContent = "무표정";
  } else {
    referenceImg.src = `/static/images/teachers/${teacher}/${teacher}${currentRound}.png`;
    referenceImg.style.display = "block";
    refMessage.style.display = "none";
    roundText.textContent = currentRound;
  }
}

  // 사진 캡처
  function captureCurrentFrame() {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 160;
    tempCanvas.height = 120;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
    return tempCanvas.toDataURL('image/png');
  }

  // 사진 제출 버튼 클릭
  submitBtn.onclick = () => {
    const dataUrl = captureCurrentFrame();

    if (currentRound === 0) {
      neutralImage = dataUrl; // ⭐️ 무표정 저장
      currentRound++;
      updateReferenceImage();
      return;
    }

    capturedImages.push(dataUrl);
    checkMark.style.display = 'block';
    setTimeout(() => checkMark.style.display = 'none', 1000);

    currentRound++;
    if (currentRound > TOTAL_ROUNDS) {
      submitBtn.textContent = '운동 완료';
      submitBtn.style.backgroundColor = '#8e24aa';
      submitBtn.style.boxShadow = '0 4px 10px rgba(142, 36, 170, 0.4)';
      submitBtn.style.color = 'white';
      submitBtn.onclick = () => {
        console.log("📤 complex_feedback 페이지로 이동 시도 중");
        sessionStorage.setItem('neutralImage', JSON.stringify(neutralImage)); // ⭐️ 저장
        sessionStorage.setItem('capturedImages', JSON.stringify(capturedImages));
        sessionStorage.setItem('selectedTeacher', teacher);
        sessionStorage.setItem('mode', 'complex');
        loadPage('complex_feedback');
      };
    } else {
      updateReferenceImage();
    }
  };

  // 초기화
  document.body.classList.add('loaded');
  updateReferenceImage();
}

export function cleanup() {
  const video = document.getElementById('video');
  if (video && video.srcObject) {
    video.srcObject.getTracks().forEach(track => track.stop());
    video.srcObject = null;
    console.log("📷 캠 스트림 정리 완료");
  }
  stream = null;
}
