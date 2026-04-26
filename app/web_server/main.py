# web_server/main.py

from flask import Flask
import server 

app = Flask(__name__, template_folder='../web_app', static_folder='../web_app/static')

if __name__ == "__main__":
    print("============================")
    print("      Starting server       ")
    print("============================")
    server = server.Server(app)