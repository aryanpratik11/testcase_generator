from flask import Flask, request, jsonify

app = Flask(__name__)

posts = []

@app.route("/posts", methods=["GET"])
def get_posts():
    return jsonify(posts)

@app.route("/posts", methods=["POST"])
def create_post():
    data = request.json
    if not data.get("title") or not data.get("content"):
        return jsonify({"error": "Title and content required"}), 400
    post = {"id": len(posts) + 1, "title": data["title"], "content": data["content"]}
    posts.append(post)
    return jsonify(post), 201

@app.route("/posts/<int:post_id>", methods=["GET"])
def get_post(post_id):
    post = next((p for p in posts if p["id"] == post_id), None)
    if not post:
        return jsonify({"error": "Post not found"}), 404
    return jsonify(post)

@app.route("/posts/<int:post_id>", methods=["DELETE"])
def delete_post(post_id):
    global posts
    posts = [p for p in posts if p["id"] != post_id]
    return "", 204

if __name__ == "__main__":
    app.run(debug=True)
