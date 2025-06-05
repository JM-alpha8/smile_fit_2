from flask import Flask, send_from_directory, render_template


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

# 이메일 기능 유지
app.config.update(
    MAIL_SERVER='smtp.gmail.com',
    MAIL_PORT=587,
    MAIL_USE_TLS=True,
    MAIL_USERNAME='your_email@gmail.com',
    MAIL_PASSWORD='your_app_password',
    MAIL_DEFAULT_SENDER='your_email@gmail.com'
)

if __name__ == "__main__":
    app.run(debug=True)
