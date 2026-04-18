# SMILE FIT

안면근육 운동과 표정 훈련을 위한 Flask 기반 웹앱입니다.  
웹캠을 활용해 사용자의 표정 수행을 확인하고, 운동 결과를 시각적으로 보여주며, 일부 결과 페이지에서는 Gemini 기반 피드백을 제공합니다.

## 프로젝트 개요

SMILE FIT은 안면근육 재활 및 표정 훈련을 웹 환경에서 수행할 수 있도록 만든 프로젝트입니다.  
단순한 정적 화면이 아니라, 카메라 입력, 표정 수행 흐름, 결과 피드백, PWA 요소까지 포함한 형태로 구성했습니다.

이 프로젝트에서 중점적으로 다룬 부분은 다음과 같습니다.

- 웹캠 기반 표정 운동/훈련 흐름 구현
- 여러 운동 모드와 결과 페이지 연결
- 프론트엔드 중심 상호작용과 Flask 기반 배포 구조 구성
- Gemini API를 활용한 운동 결과 피드백 생성

## 주요 기능

- 웹앱 메인 진입 화면 제공
- 게임/훈련 모드 진입 및 페이지 전환
- 웹캠 기반 표정 수행 흐름
- 결과 페이지에서 점수, 근육 사용 정보 등 출력
- Gemini API를 활용한 종합 피드백 제공
- PWA 관련 파일(`manifest.json`, `serviceWorker.js`) 포함

## 기술 스택

### Backend
- Python
- Flask
- Gunicorn

### Frontend
- HTML
- CSS
- JavaScript

### AI / External API
- Google Gemini API (`google-generativeai`)

### Deployment
- Render

## 프로젝트 구조

```text
smile_fit_2/
├─ app.py
├─ requirements.txt
├─ Procfile
├─ static/
│  ├─ images/
│  ├─ sounds/
│  ├─ icons/
│  ├─ models/
│  ├─ scripts/
│  ├─ manifest.json
│  └─ serviceWorker.js
└─ templates/
   ├─ index.html
   └─ pages/
```

## 실행 방법

### 1) 저장소 클론

```bash
git clone https://github.com/JM-alpha8/smile_fit_2.git
cd smile_fit_2
```

### 2) 가상환경 생성 및 활성화

```bash
python -m venv venv
```

Windows:

```bash
venv\Scripts\activate
```

macOS / Linux:

```bash
source venv/bin/activate
```

### 3) 패키지 설치

```bash
pip install -r requirements.txt
```

### 4) 환경변수 설정

`.env` 파일을 만들고 Gemini API 키를 추가합니다.

```env
GEMINI_API_KEY=your_api_key_here
```

### 5) 실행

```bash
python app.py
```

브라우저에서 아래 주소로 접속합니다.

```text
http://127.0.0.1:5000
```

## API 엔드포인트

### `POST /api/gemini_feedback`
복합운동 결과를 바탕으로 Gemini 피드백을 생성합니다.

예시 요청 데이터:

```json
{
  "name": "사용자",
  "score": 85,
  "topMuscles": ["zygomaticus", "orbicularis oris"],
  "muscleCount": 6
}
```

### `POST /api/gemini_focus_feedback`
집중운동 결과를 바탕으로 Gemini 피드백을 생성합니다.

예시 요청 데이터:

```json
{
  "name": "사용자",
  "symmetry": {"left": 48, "right": 52},
  "consistency": 82,
  "activationRate": 76,
  "topMuscles": [
    {"name": "left zygomatic major", "score": 91},
    {"name": "right buccinator", "score": 87}
  ]
}
```

## 이 프로젝트에서 강조한 점

이 프로젝트는 단순한 페이지 제작보다, **웹앱 형태의 흐름 설계**에 의미를 두고 만들었습니다.

특히 아래와 같은 점을 직접 고민하며 구현했습니다.

- 여러 운동 모드를 하나의 서비스 흐름 안에서 연결하는 구조
- 웹캠 기반 상호작용과 사용자 경험 설계
- 정적 프론트엔드 기능과 서버 기능의 역할 분리
- AI 피드백 기능을 서버에서 안전하게 처리하는 구조

## 개선하거나 확장할 수 있는 부분

- 사용자별 운동 기록 저장
- 결과 리포트 다운로드 기능
- 근육 사용량 시각화 고도화
- 로그인 및 사용자 관리 기능
- AI 피드백 프롬프트 정교화
- 프론트엔드 / 백엔드 역할 분리 리팩토링

## 배포

Render로 배포하여 실제 웹 환경에서 실행 가능한 형태로 구성했습니다.

- Render 배포 링크: `추가 예정`

## 스크린샷

README에 아래 항목을 추가하면 포트폴리오 완성도가 더 좋아집니다.

- 메인 화면
- 운동/게임 진행 화면
- 결과 피드백 화면

예시:

```md
![main](./docs/main.png)
![game](./docs/game.png)
![result](./docs/result.png)
```

## 회고

이 프로젝트를 통해 단순한 웹페이지 제작을 넘어,  
**실시간 상호작용이 있는 웹앱 구조**, **Flask 배포 경험**, **외부 AI API 연동**을 함께 다룰 수 있었습니다.

또한 브라우저에서 처리할 수 있는 기능과, 서버가 꼭 필요한 기능을 구분하는 관점도 얻을 수 있었습니다.

## License

개인 포트폴리오 및 학습용 프로젝트입니다.
