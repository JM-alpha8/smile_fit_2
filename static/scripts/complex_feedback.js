// complex_feedback.js (SPA 대응 개선 버전) - 기준 이미지와의 일치율 기반 평가
const Chart = window.Chart;
const FaceMesh = window.FaceMesh;

// ✅ 표정별 관련 랜드마크 인덱스 정의

const MAX_CHANGES = {
  "전두근": 0.04,
  "안륜근": 0.013,
  "추미근": 0.04,
  "상순비익거근": 0.026,
  "대관골근": 0.06,
  "익돌근": 0.25,
  "상순절치근": 0.036,
  "협근": 0.026,
};

const MUSCLE_TO_ACTION = {
  "전두근": "눈썹 올리기",
  "안륜근": "눈 강하게 감기",
  "추미근": "미간 조이기",
  "상순비익거근": "찡그리기",
  "대관골근": "입꼬리 올리기",
  "익돌근": "입 벌리기",
  "상순절치근": "입술 오므리기",
  "협근": "보조개 만들기"
};

// 근육별 제어 기준 정의
const MUSCLE_RULES = {
  "전두근": { points: [334, 386], direction: "increase" },
  "안륜근": { points: [386, 374], direction: "decrease" },
  "추미근": { points: [107, 336], direction: "decrease" },
  "상순비익거근": { points: [285, 437], direction: "decrease" },
  "대관골근": { points: [291, 446], direction: "decrease" },
  "익돌근": { points: [1, 152], direction: "increase" },
  "상순절치근": { points: [61, 291], direction: "decrease" },
  "협근": { points: [61, 291], direction: "increase", stable: [13, 14] }  // AND 조건
};

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

async function extractLandmarksFromImages(imageList) {
  const result = [];
  for (let src of imageList) {
    const vector = await extractLandmarks(src);
    result.push(vector || []);
  }
  return result;
}

    // 거리 계산 유틸 함수
  function computeDist(landmarks, [i1, i2]) {
    const [x1, y1] = landmarks[i1];
    const [x2, y2] = landmarks[i2];
    return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
  }

function evaluateRoundScores(refLandmarks, userLandmarks) {
  const roundScores = [];

  for (let i = 1; i < userLandmarks.length; i++) {
    const perMuscleScores = [];

    for (let muscle in MUSCLE_RULES) {
      const rule = MUSCLE_RULES[muscle];
      const [p1, p2] = rule.points;

      const D_ref_neutral = computeDist(refLandmarks[0], [p1, p2]);
      const D_ref_expr = computeDist(refLandmarks[i], [p1, p2]);
      const D_user_neutral = computeDist(userLandmarks[0], [p1, p2]);
      const D_user_expr = computeDist(userLandmarks[i], [p1, p2]);

      const delta_ref = D_ref_expr - D_ref_neutral;
      const delta_user = D_user_expr - D_user_neutral;

      const sameDirection =
        (delta_ref >= 0 && delta_user >= 0) ||
        (delta_ref < 0 && delta_user < 0);

      const R_ref = Math.min(D_ref_expr, D_ref_neutral) / Math.max(D_ref_expr, D_ref_neutral);
      const R_user = Math.min(D_user_expr, D_user_neutral) / Math.max(D_user_expr, D_user_neutral);

      let score = (Math.min(R_ref, R_user) / Math.max(R_ref, R_user)) * 100;

      // if (!sameDirection) score = 0;

      // ✅ 예외 처리
      if (muscle === "협근" && rule.stable) {
        const refStable = Math.abs(computeDist(refLandmarks[i], rule.stable) - computeDist(refLandmarks[0], rule.stable));
        const userStable = Math.abs(computeDist(userLandmarks[i], rule.stable) - computeDist(userLandmarks[0], rule.stable));
        if (refStable > 0.01 || userStable > 0.01) {
          score = 0;
        }
      }

      if (muscle === "상순절치근") {
        const refChange = computeDist(refLandmarks[i], [14, 1]) - computeDist(refLandmarks[0], [14, 1]);
        const userChange = computeDist(userLandmarks[i], [14, 1]) - computeDist(userLandmarks[0], [14, 1]);
        const maxJaw = computeDist(userLandmarks[0], [1, 152]);
        if (Math.abs(refChange) > maxJaw / 3 || Math.abs(userChange) > maxJaw / 3) {
          score = 0;
        }
      }

      if (muscle === "대관골근") {
        const refVertical = computeDist(refLandmarks[i], [13, 14]) - computeDist(refLandmarks[0], [13, 14]);
        const userVertical = computeDist(userLandmarks[i], [13, 14]) - computeDist(userLandmarks[0], [13, 14]);
        if (refVertical < 0.01 || userVertical < 0.01) {
          score = 0;
        }
      }

      console.log(`라운드 ${i} - ${muscle}`);
      console.log(`  R_ref: ${R_ref.toFixed(3)}`);
      console.log(`  R_user: ${R_user.toFixed(3)}`);
      console.log(`  score: ${score.toFixed(1)}%`);

      perMuscleScores.push(score);
    }

    const roundAvg = perMuscleScores.reduce((a, b) => a + b, 0) / perMuscleScores.length;
    roundScores.push(roundAvg);
    console.log(`라운드 ${i} 평균 점수:`, roundAvg);
console.log(`  perMuscleScores:`, perMuscleScores);
  }

  return roundScores;
}


function renderChart(values) {
  const ctx = document.getElementById("chart").getContext("2d");
  new Chart(ctx, {
    type: "bar",
    data: {
      labels: values.map((_, i) => `라운드 ${i + 1}`),
      datasets: [{
        label: "일치율 (%)",
        data: values.map(v => Math.round(v)),
        backgroundColor: "rgba(54, 162, 235, 0.5)",
        borderColor: "rgba(54, 162, 235, 1)",
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          max: 100
        }
      }
    }
  });
}

function generateSummaryFeedback(avgScore, usedMusclesCount) {
  const lines = [];

  lines.push("오늘도 얼굴 운동 하느라 수고 많았어요! 😊");

  if (usedMusclesCount >= 5) {
    lines.push("다양한 근육들을 골고루 사용하셨습니다. 👏");
  } else {
    lines.push("다음에는 더 다양한 근육들을 운동해 보아요! 💪");
  }

  if (avgScore >= 80) {
    lines.push("선생님의 사진을 매우 잘 따라했습니다. 👍");
  } else {
    lines.push("다음에는 선생님을 더 비슷하게 따라해 보아요! 😊");
  }

  lines.push("항상 스마일핏과 함께 즐겁고 활기찬 운동 되시길 바랍니다! 🌟");

  return lines.join("<br><br>");
}

const pieColors = [
  "#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0", "#9966FF", "#CCCCCC"
];


export async function init() {
  document.body.classList.add("loaded");
  document.getElementById("analyze-btn").addEventListener("click", async () => {
    const analyzeBtn = document.getElementById("analyze-btn");
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = "분석 중...";

  try {
  const dateSpan = document.getElementById("report-date");
  const nameInput = document.getElementById("user-name");

  const today = new Date().toLocaleDateString("ko-KR");
  const name = nameInput?.value.trim() || "";
  
  dateSpan.textContent = name ? `${today} - ${name}` : today;
    
    const teacher = sessionStorage.getItem("selectedTeacher");
    const refImages = [`/static/images/teachers/${teacher}/neutral.png`];
    for (let i = 1; i <= 10; i++) refImages.push(`/static/images/teachers/${teacher}/${teacher}${i}.png`);


    const userNeutral = JSON.parse(sessionStorage.getItem("neutralImage"));
    const userImages = JSON.parse(sessionStorage.getItem("capturedImages") || "[]");
    const userAll = [userNeutral, ...userImages];
    
    const refLandmarks = await extractLandmarksFromImages(refImages);
    const fake = await extractLandmarks(userNeutral)
    const userLandmarks = await extractLandmarksFromImages(userAll);

    const similarityScores = evaluateRoundScores(refLandmarks, userLandmarks);
    const avgScore = similarityScores.reduce((a, b) => a + b, 0) / similarityScores.length;
    
    renderChart(similarityScores);

    const refContainer = document.getElementById("reference-images");
    refImages.slice(1).forEach(src => {
      const img = document.createElement("img");
      img.src = src;
      refContainer.appendChild(img);
    });

    const userContainer = document.getElementById("user-images");
    userImages.forEach(src => {
      const img = document.createElement("img");
      img.src = src;
      userContainer.appendChild(img);
    });

    // 결과 출력
    const topMusclesFull = Object.entries(MUSCLE_RULES).map(([muscle, rule]) => {
      let usage = 0;
      const scale0 = computeDist(userLandmarks[0], [133, 362]);

      for (let i = 1; i < userLandmarks.length; i++) {

        const scale = computeDist(userLandmarks[i], [133, 362]);
        const neutralDist = computeDist(userLandmarks[0], rule.points);
        const exprDist = computeDist(userLandmarks[i], rule.points);
        const diff = (exprDist/scale) - (neutralDist/scale0);

        let activated = false;
        if (rule.direction === "increase" && diff > 0) activated = true;
        if (rule.direction === "decrease" && diff < 0) activated = true;

        if (muscle === "협근") {
          const lipChange = computeDist(userLandmarks[0], rule.stable) - computeDist(userLandmarks[i], rule.stable);
          if (Math.abs(lipChange) > 0.01) activated = false;
        }

        if (muscle === "상순절치근") {
          const verticalChange = computeDist(userLandmarks[0], [14, 1]) - computeDist(userLandmarks[i], [14, 1]);
          const maxJaw = MAX_CHANGES["익돌근"] || 1;
          if (Math.abs(verticalChange) > maxJaw / 3) activated = false;
        }

        if (muscle === "대관골근") {
          const verticalChange = computeDist(userLandmarks[i], [13, 14]) - computeDist(userLandmarks[0], [13, 14]);
          if (verticalChange < 0.01) activated = false;
}

        const ratio = Math.abs(diff) / MAX_CHANGES[muscle];

        console.log(`▶️ 라운드 ${i}, 근육 ${muscle}`);
        console.log(`   - 중립 거리: ${neutralDist.toFixed(4)}`);
        console.log(`   - 표현 거리: ${exprDist.toFixed(4)}`);
        console.log(`   - 변화량: ${diff.toFixed(4)}`);
        console.log(`   - 사용 여부: ${activated}`);
        console.log(`   - 사용량 비율(ratio): ${ratio.toFixed(4)}`);

        if (activated) usage += ratio;
      }
      return { expr: muscle, usage };
    }).sort((a, b) => b.usage - a.usage);

const gptReqBody = {
  score: Math.round(avgScore),
  topMuscles: topMusclesFull.filter(m => m.usage > 0).slice(0, 3).map(m => m.expr),
  muscleCount: topMusclesFull.filter(m => m.usage > 0).length
};

fetch("/api/gemini_feedback", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(gptReqBody)
})
  .then(async res => {
    const data = await res.json();
    if (!data.feedback) throw new Error("피드백 없음");
    document.getElementById("summary-text").innerHTML = data.feedback.replace(/\n/g, "<br>");
  })
  .catch(err => {
    console.error("Gemini 피드백 실패:", err);
    document.getElementById("summary-text").innerHTML = "피드백을 불러오지 못했어요. 😢";
  });

  
    // ✅ Pie chart용 데이터 준비
    const totalUsage = topMusclesFull.reduce((sum, m) => sum + m.usage, 0);
    const pieData = [];
    const pieLabels = [];

    topMusclesFull.slice(0, 5).forEach(m => {
      const percent = (m.usage / totalUsage) * 100;
      pieLabels.push(m.expr);
      pieData.push(percent);
    });

    const othersUsage = topMusclesFull.slice(5).reduce((sum, m) => sum + m.usage, 0);
    if (othersUsage > 0) {
      const othersPercent = (othersUsage / totalUsage) * 100;
      pieLabels.push("기타");
      pieData.push(othersPercent);
    }

    document.getElementById("report").style.display = "block";

    // ✅ 원형 차트 렌더링
    const pieCtx = document.getElementById("topMusclePieChart").getContext("2d");
    new Chart(pieCtx, {
      type: "pie",
      data: {
        labels: pieLabels,
        datasets: [{
          data: pieData.map(v => parseFloat(v.toFixed(1))),
          backgroundColor: [
            "#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0", "#9966FF", "#CCCCCC"
          ]
        }]
      },
      options: {
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function(context) {
                const label = context.label || '';
                const value = context.parsed;
                return `${label}: ${value.toFixed(1)}%`;
              }
            }
          }
        }
      }
    });

    const labelContainer = document.getElementById("pie-labels");
    labelContainer.innerHTML = "";

    pieLabels.forEach((label, i) => {
      const percent = pieData[i].toFixed(1);
      const color = pieColors[i];  // 차트 색상 배열

      const li = document.createElement("li");
      li.style.display = "flex";
      li.style.alignItems = "center";
      li.style.marginBottom = "8px";

      li.innerHTML = `
        <span style="display:inline-block; width: 12px; height: 12px; background-color: ${color}; margin-right: 8px; border-radius: 2px;"></span>
        <strong style="margin-right: 6px;">${label}</strong>
        <span style="font-size: 14px; color: #555;">${percent}%</span>
      `;

      document.getElementById("pie-labels").appendChild(li);
    });

    const exprList = document.getElementById("top-expression-list");
    exprList.innerHTML = "";  // 기존 내용 초기화

    Object.entries(MUSCLE_RULES).forEach(([muscle, rule]) => {
      let activatedOnce = false;

      for (let i = 1; i < userLandmarks.length; i++) {
        const neutralDist = computeDist(userLandmarks[0], rule.points);
        const exprDist = computeDist(userLandmarks[i], rule.points);
        const diff = exprDist - neutralDist;

        let activated = false;
        if (rule.direction === "increase" && diff > 0) activated = true;
        if (rule.direction === "decrease" && diff < 0) activated = true;

        // 볼근 조건
        if (muscle === "협근") {
          const lipChange = computeDist(userLandmarks[0], rule.stable) - computeDist(userLandmarks[i], rule.stable);
          if (Math.abs(lipChange) > 0.01) activated = false;
        }

        // 구륜근 조건
        if (muscle === "상순절치근") {
          const verticalChange1 = computeDist(userLandmarks[0], [14, 1]) - computeDist(userLandmarks[i], [14, 1]);
          const maxJaw = MAX_CHANGES["익돌근"] || 1;
          if (Math.abs(verticalChange1) > maxJaw / 5) activated = false;
        }

        if (muscle === "대관골근") {
          const verticalChange2 = computeDist(userLandmarks[i], [13, 14]) - computeDist(userLandmarks[0], [13, 14]);
          if (verticalChange2 < 0.01) activated = false;
        }

        if (activated) {
          activatedOnce = true;
          break;
        }
      }

      if (activatedOnce) {
        const li = document.createElement("li");
        const action = MUSCLE_TO_ACTION[muscle] || "-";
        li.innerHTML = `<strong>${muscle}</strong> – ${action}`;
        li.style.marginBottom = "6px";
        exprList.appendChild(li);
      }
    });
    
      analyzeBtn.textContent = "분석 완료 ✅";
    } catch (err) {
      analyzeBtn.textContent = "분석 실패 ❌";
      console.error(err);
    } finally {
      analyzeBtn.disabled = false;
    }
  });
}