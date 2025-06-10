from flask import Flask, send_from_directory, render_template, request, jsonify
import os
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

model = genai.GenerativeModel("gemini-1.5-flash")

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route("/tower_defense_game/follow")
def follow_mode():
    return render_template("face_follow.html")

@app.route('/models/<path:filename>')
def serve_models(filename):
    return send_from_directory('static/models', filename)

@app.route('/pages/<path:filename>')
def load_page(filename):
    return send_from_directory('templates/pages', filename)

@app.route('/scripts/<path:filename>')
def serve_script(filename):
    return send_from_directory('static/scripts', filename)

@app.route('/static/images/<path:filename>')
def serve_image(filename):
    return send_from_directory('static/images', filename)

@app.route('/static/sounds/<path:filename>')
def serve_sounds(filename):
    return send_from_directory('static/sounds', filename)

@app.route('/icons/<path:filename>')
def icons(filename):
    return send_from_directory('static/icons', filename)

@app.route('/manifest.json')
def manifest():
    return send_from_directory('static', 'manifest.json')

@app.route('/serviceWorker.js')
def service_worker():
    return send_from_directory('static', 'serviceWorker.js')


@app.route("/api/gemini_feedback", methods=["POST"])
def gemini_feedback():
    try:
        data = request.json
        name = data.get("name", "사용자")
        score = data.get("score", 0)
        top_muscles = data.get("topMuscles", [])
        muscle_count = data.get("muscleCount", 0)

        top_str = ", ".join(top_muscles)
        prompt = f"""
        사용자의 얼굴 근육 복합운동 결과는 다음과 같습니다.
        - 사용자 이름: {name}
        - 평균 점수: {score}점
        - 가장 많이 사용된 근육: {top_str}
        - 사용된 근육 수: {muscle_count}개

        위 데이터를 바탕으로 다음 세 가지 내용을 포함한 피드백을 작성해주세요:

        1. 운동 결과 분석: 표정 근육 사용 패턴을 바탕으로 어떤 운동이 잘 수행되었는지, 근육 간 협응은 어땠는지 설명해주세요. 전문 용어를 간단히 풀어주세요.

        2. 재활/트레이닝 관점의 조언: 부족했던 근육의 활용이나 좌우 균형, 표정의 부드러움 등을 고려한 개선 방향을 제안해주세요.

        3. 심리적 동기 부여 메시지: 사용자에게 응원의 메시지나 긍정적인 피드백을 전달해주세요. 간결하면서 따뜻하게 마무리해주세요.

        글은 전체적으로 전문가의 시선으로 쓰되, 일반인도 이해할 수 있도록 용어는 쉽게 풀어 설명해주세요.
        """

        response = model.generate_content(prompt)
        return jsonify({ "feedback": response.text })

    except Exception as e:
        print("❗ Gemini 피드백 오류:", e)
        return jsonify({ "error": str(e) }), 500

@app.route('/api/gemini_focus_feedback', methods=['POST'])
def gemini_focus_feedback():
    try:
        data = request.json
        name = data.get("name", "사용자")
        symmetry = data.get("symmetry", {})
        consistency = data.get("consistency", 0)
        activationRate = data.get("activationRate", 0)
        topMuscles = data.get("topMuscles", [])

        top_str = ", ".join([f"{m['name']}: {m['score']}%" for m in topMuscles])

        prompt = f"""
        당신은 전문 안면근육 재활 트레이너입니다. 아래의 데이터를 기반으로 3문단으로 구성된 종합 피드백을 작성해 주세요.

        1. 첫 문단은 사용자 이름과 함께 전체적인 운동 수행에 대한 인상을 평가합니다.
        
        2. 두 번째 문단은 좌우 균형(symmetry), 표정 일관성(consistency), 목표 근육 활성률(activationRate)에 대한 상세한 해석을 제공합니다.
        
        3. 세 번째 문단은 가장 많이 사용된 근육(top5)을 분석하여 어떤 근육이 특히 활성화되었는지 설명하고, 앞으로 어떤 점을 보완하면 좋은지 조언을 포함합니다.

        입력 데이터:
        - 사용자 이름: {name}
        - 좌측 사용량: {symmetry.get("left", 0)}%
        - 우측 사용량: {symmetry.get("right", 0)}%
        - 일관성 점수: {consistency}%
        - 목표 근육 활성률: {activationRate}%
        - 가장 많이 사용된 근육: {top_str}
        """

        response = model.generate_content(prompt)
        return jsonify({ "feedback": response.text })

    except Exception as e:
        print("❗ Gemini 피드백 오류:", e)
        return jsonify({ "error": str(e) }), 500

if __name__ == "__main__":
    app.run(debug=True)
