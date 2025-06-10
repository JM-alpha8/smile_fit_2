const FaceMesh = window.FaceMesh;

const MAX_CHANGES = {
  "전두근(좌)": 0.04,
  "전두근(우)": 0.04,
  "안륜근(좌)": 0.013,
  "안륜근(우)": 0.013,
  "추미근": 0.04,
  "상순비익거근": 0.026,
  "대관골근(좌)": 0.06,
  "대관골근(우)": 0.06,
  "익돌근": 0.25,
  "상순절치근": 0.036,
  "협근": 0.026,
};

const MUSCLE_RULES = {
  "전두근(좌)": { points: [334, 386], direction: "increase" },
  "전두근(우)": { points: [105, 159], direction: "increase" },
  "안륜근(좌)": { points: [386, 374], direction: "decrease" },
  "안륜근(우)": { points: [159, 145], direction: "decrease" },
  "추미근": { points: [107, 336], direction: "decrease" },
  "상순비익거근": { points: [285, 437], direction: "decrease" },
  "대관골근(좌)": { points: [291, 446], direction: "decrease" },
  "대관골근(우)": { points: [61, 226], direction: "decrease" },
  "익돌근": { points: [1, 152], direction: "increase" },
  "상순절치근": { points: [61, 291], direction: "decrease" },
  "협근": { points: [61, 291], direction: "increase", stable: [13, 14] }
};

const EXERCISE_TARGET_MUSCLES = {
  "eyebrow_raise": ["전두근(좌)", "전두근(우)"],
  "eye_close": ["안륜근(좌)", "안륜근(우)"],
  "smile": ["대관골근(좌)", "대관골근(우)"],
};

const EXERCISE_TARGET_MUSCLES2 = {
  "eyebrow_raise": ["전두근"],
  "eye_close": ["안륜근"],
  "smile": ["대관골근"]
};

const EXERCISE_KOR_NAMES = {
  "eyebrow_raise": "눈썹 올리기",
  "eye_close": "눈 꼭 감기",
  "smile": "미소 짓기",
};

const MUSCLE_KOR_NAMES = {
  "전두근": "1.전두근,2.상암검거근,3.상검판근",  
  "안륜근": "1-1.안륜근(안와부),1-2.안륜근(안검부),2.상안검거근(이완)",    
  "대관골근": "1.대관골근,2.구각거근",
};

function renderExerciseInfo(selectedExercise) {
  const korName = EXERCISE_KOR_NAMES[selectedExercise] || selectedExercise;
  const targets = EXERCISE_TARGET_MUSCLES2[selectedExercise] || [];

  const muscles = targets
    .map(m => (MUSCLE_KOR_NAMES[m] || m).split(",").join("<br>"))
    .join("<br><br>");
  const html = `
    <div style="font-size: 20px; line-height: 1.6;">
        <strong>동작명:</strong>&nbsp; ${korName}<br><br>
        <strong>목표 근육:</strong><br>${muscles}
    </div>
    `;
  document.getElementById("exercise-info").innerHTML = html;
}

let faceMeshInstance = null;

async function setupFaceMesh() {
  if (!faceMeshInstance) {
    faceMeshInstance = new FaceMesh({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
    });
    faceMeshInstance.setOptions({
      staticImageMode: true,
      refineLandmarks: true,
      maxNumFaces: 1,
      minDetectionConfidence: 0.5,
    });
    await faceMeshInstance.initialize();
  }
}

async function extractLandmarks(src) {
  await setupFaceMesh();
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = src;

    img.onload = async () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);

      faceMeshInstance.onResults((results) => {
        if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
          resolve(null);
          return;
        }
        const landmarks = results.multiFaceLandmarks[0].map(pt => [pt.x, pt.y]);
        resolve(landmarks);
      });

      await faceMeshInstance.send({ image: img });
    };

    img.onerror = (err) => reject(err);
  });
}

function computeDist(landmarks, [i1, i2]) {
  const [x1, y1] = landmarks[i1];
  const [x2, y2] = landmarks[i2];
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

// ✅ 메인 함수: 근육별 사용 퍼센트 수치 계산
export function calculateMuscleUsageScores(neutralLandmarks, expressionLandmarksList) {
  const scores = {};
  const scale0 = computeDist(neutralLandmarks, [33, 263]);

  for (const muscle in MUSCLE_RULES) {
    const rule = MUSCLE_RULES[muscle];
    const [p1, p2] = rule.points;
    const maxChange = MAX_CHANGES[muscle] || 1;

    let total = 0;
    let count = 0;

    const base = computeDist(neutralLandmarks, [p1, p2]);

    for (const exprLandmarks of expressionLandmarksList) {
      const dist = computeDist(exprLandmarks, [p1, p2]);
      const scale = computeDist(exprLandmarks, [33, 263]);
      let diff = (dist/scale) - (base/scale0);

      if (rule.direction === "decrease") diff *= -1;
      if (diff <= 0) continue; // 변화 없음 or 역방향
      
      if (muscle.includes("안륜근") && diff < 0.03) continue;

      if (muscle === "협근" && rule.stable) {
        const stableBase = computeDist(neutralLandmarks, rule.stable);
        const stableNow = computeDist(exprLandmarks, rule.stable);
        if (Math.abs(stableNow - stableBase) > 0.01) continue;}
      
      if (muscle === "상순절치근") {
        const jawDiff = computeDist(exprLandmarks, [14, 1]) - computeDist(neutralLandmarks, [14, 1]);
        const jawMax = MAX_CHANGES["익돌근"] || 1;
        if (Math.abs(jawDiff) > jawMax / 3) continue;}

      if (muscle.includes("대관골근")) {
        const centerBase = computeDist(neutralLandmarks, [13, 14]);
        const centerNow = computeDist(exprLandmarks, [13, 14]);
        const centerDiff = centerNow - centerBase;
        if (centerDiff < 0.01) continue;}
        

      const ratio = Math.min(diff / maxChange / 5, 1);
      total += ratio;
      count++;
    }

    const percent = count > 0 ? Math.round((total / count) * 100) : 0;
    scores[muscle] = percent;
  }

  return scores;
}

function calculateSymmetry(muscleScores, selectedExercise) {
  const [left, right] = EXERCISE_TARGET_MUSCLES[selectedExercise] || [];
  return {
    left: muscleScores[left] || 0,
    right: muscleScores[right] || 0,
    diff: Math.abs((muscleScores[left] || 0) - (muscleScores[right] || 0)),
  };
}

function calculateExpressionConsistency(expressionLandmarksList, neutralLandmarks, selectedExercise) {
  const [leftMuscle, rightMuscle] = EXERCISE_TARGET_MUSCLES[selectedExercise] || [];
  const leftRule = MUSCLE_RULES[leftMuscle];
  const rightRule = MUSCLE_RULES[rightMuscle];

  const baseLeft = computeDist(neutralLandmarks, leftRule.points);
  const baseRight = computeDist(neutralLandmarks, rightRule.points);

  const leftDeltas = expressionLandmarksList.map(l => computeDist(l, leftRule.points) - baseLeft);
  const rightDeltas = expressionLandmarksList.map(l => computeDist(l, rightRule.points) - baseRight);

  const leftVar = variance(leftDeltas);
  const rightVar = variance(rightDeltas);
  const avgVar = (leftVar + rightVar) / 2;

  const rawScore = Math.min(avgVar * 10000, 100);  // 0~100
  const consistencyScore = 100 - rawScore;

  return Math.round(consistencyScore);
}

function variance(arr) {
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  return arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length;
}

function calculateTargetActivationRate(expressionLandmarksList, neutralLandmarks, selectedExercise) {
  const [left, right] = EXERCISE_TARGET_MUSCLES[selectedExercise] || [];
  const rules = [MUSCLE_RULES[left], MUSCLE_RULES[right]];
  const maxes = [MAX_CHANGES[left], MAX_CHANGES[right]];

  let count = 0;

  for (let i = 0; i < expressionLandmarksList.length; i++) {
    [0, 1].forEach(j => {
      const rule = rules[j];
      const max = maxes[j];
      const base = computeDist(neutralLandmarks, rule.points);
      const now = computeDist(expressionLandmarksList[i], rule.points);
      let diff = now - base;
      if (rule.direction === "decrease") diff *= -1;
      if (diff > max * 0.2) count++; // 20% 이상 변화시 사용된 것으로 간주
    });
  }

  return Math.round((count / 20) * 100); // 총 20번 시도 중 몇 % 사용
}

function getTopMuscles(muscleScores, topN = 5) {
  return Object.entries(muscleScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN);
}

function generateFeedback(symmetryDiff, activationRate) {
  const lines = [];
  lines.push("집중운동을 성실히 완료했어요. 👏");

  if (symmetryDiff < 15) {
    lines.push("양쪽 근육이 고르게 사용되어 균형이 잘 잡혀 있어요! 🧘‍♂️");
  } else if (symmetryDiff < 30) {
    lines.push("약간의 좌우 차이가 있지만 전체적으로 안정적이에요. 🙂");
  } else {
    lines.push("한쪽 근육의 사용량이 더 많아요. 균형 잡힌 운동을 시도해 보세요! ⚖️");
  }

  if (activationRate >= 80) {
    lines.push("목표 근육을 훌륭하게 사용하셨어요! 💪");
  } else if (activationRate >= 50) {
    lines.push("목표 근육이 적절히 사용되었어요. 계속 연습해볼까요? 🙂");
  } else {
    lines.push("목표 근육 사용이 적었어요. 다음에는 더 집중해서 해보아요! 🔍");
  }

  lines.push("다음 운동도 화이팅입니다! 🌟");
  return lines.join("<br><br>");
}

function findBestPhoto(expressionLandmarksList, neutralLandmarks, selectedExercise) {
  const [left, right] = EXERCISE_TARGET_MUSCLES[selectedExercise] || [];
  const ruleLeft = MUSCLE_RULES[left];
  const ruleRight = MUSCLE_RULES[right];

  const baseLeft = computeDist(neutralLandmarks, ruleLeft.points);
  const baseRight = computeDist(neutralLandmarks, ruleRight.points);

  let maxSum = -Infinity;
  let bestIndex = 0;

  for (let i = 0; i < expressionLandmarksList.length; i++) {
    let dLeft = computeDist(expressionLandmarksList[i], ruleLeft.points) - baseLeft;
    let dRight = computeDist(expressionLandmarksList[i], ruleRight.points) - baseRight;
    if (ruleLeft.direction === "decrease") dLeft *= -1;
    if (ruleRight.direction === "decrease") dRight *= -1;

    const sum = Math.max(dLeft, 0) + Math.max(dRight, 0);
    if (sum > maxSum) {
      maxSum = sum;
      bestIndex = i;
    }
  }

  return bestIndex; // 이 index로 capturedImages[i] + 기준이미지[i] 매칭
}


function renderBarChart(id, labels, data) {
  const ctx = document.getElementById(id).getContext("2d");
  new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "%",
        data,
        backgroundColor: "rgba(54, 162, 235, 0.5)",
        borderColor: "rgba(54, 162, 235, 1)",
        borderWidth: 1
      }]
    },
    options: {
      indexAxis: 'y',
      scales: { x: { min: 0, max: 100 } },
      plugins: { legend: { display: false } }
    }
  });
}

function renderVerticalBarChart(id, labels, data) {
  const ctx = document.getElementById(id).getContext("2d");
  new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "사용량",
        data,
        backgroundColor: "rgba(255, 159, 64, 0.5)",
        borderColor: "rgba(255, 159, 64, 1)",
        borderWidth: 1
      }]
    },
    options: {
      scales: { y: { beginAtZero: true, max: 100 } },
      plugins: { legend: { display: false } }
    }
  });
}

export async function init() {
  document.body.classList.add("loaded");

  document.getElementById("analyze-btn").addEventListener("click", async () => {
    const analyzeBtn = document.getElementById("analyze-btn");
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = "분석 중...";

    const today = new Date().toLocaleDateString("ko-KR");
    const name = document.getElementById("user-name")?.value.trim() || "";

    const selectedExercise = sessionStorage.getItem("selectedExercise");
    const userNeutral = JSON.parse(sessionStorage.getItem("neutralImage"));
    const userImages = JSON.parse(sessionStorage.getItem("capturedImages"));

    const neutralLmk = await extractLandmarks(userNeutral);
    const exprLmks = await Promise.all(userImages.map(img => extractLandmarks(img)));

    const muscleScores = calculateMuscleUsageScores(neutralLmk, exprLmks);
    const symmetry = calculateSymmetry(muscleScores, selectedExercise);
    const consistency = calculateExpressionConsistency(exprLmks, neutralLmk, selectedExercise);
    const activation = calculateTargetActivationRate(exprLmks, neutralLmk, selectedExercise);
    const top5 = getTopMuscles(muscleScores);
    const feedback = generateFeedback(symmetry.diff, activation);
    const bestIdx = findBestPhoto(exprLmks, neutralLmk, selectedExercise);

    renderExerciseInfo(selectedExercise);
    renderBarChart("symmetryChart", ["좌측", "우측"], [symmetry.left, symmetry.right]);
    renderBarChart("consistencyChart", ["일관성"], [consistency]);
    renderBarChart("activationChart", ["목표근육 활성율"], [activation]);
    const scaledTop5 = top5.map(([name, score]) => [name, Math.round(score)]);
    renderVerticalBarChart("top5Chart", scaledTop5.map(m => m[0]), scaledTop5.map(m => m[1]));
    
    const gptSummaryBox = document.getElementById("summary-text");

    const response = await fetch("/api/gemini_focus_feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        symmetry,
        consistency,
        activationRate: activation,
        topMuscles: top5.map(([name, score]) => ({ name, score }))
      })
    });

    if (response.ok) {
      const result = await response.json();
      gptSummaryBox.innerHTML = result.feedback.replace(/\n/g, "<br>");
    } else {
      const error = await response.json();
      gptSummaryBox.innerHTML = `❗ Gemini 피드백 실패: ${error.error}`;
    }

    const refImg = `/static/images/expression/${selectedExercise}/${bestIdx + 1}.png`;
    const userImg = userImages[bestIdx];
    document.getElementById("ref-photo").src = refImg;
    document.getElementById("best-photo").src = userImg;

    for (let i = 1; i <= 2; i++) {
      const img = document.createElement("img");
      img.src = `/static/images/muscles/${selectedExercise}/m${i}.png`;
      img.style.width = "200px";
      img.style.margin = "4px";
      document.getElementById("muscle-image-box").appendChild(img);
    }

    document.getElementById("report-date").textContent =
      name ? `${today} - ${name}` : today;
    document.getElementById("report").style.display = "block";

    analyzeBtn.textContent = "분석 완료 ✅";
    analyzeBtn.disabled = true;
  });
}
