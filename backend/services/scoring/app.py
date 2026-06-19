from flask import Flask

app = Flask(__name__)

@app.route("/")
def score():
    return "Score"

if __name__ == "__main__": 
    app.run(debug=True)