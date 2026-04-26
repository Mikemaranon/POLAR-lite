# api_m/domains/base_api.py

from flask import jsonify
from user_m import UserManager

class BaseAPI:
    def __init__(self, app, user_manager: UserManager, db):
        self.app = app
        self.user_manager = user_manager
        self.db = db

    def ok(self, data, code=200):
        return jsonify(data), code

    def error(self, message, code=400):
        return jsonify({"error": message}), code

    def authenticate_request(self, request):
        token = self.user_manager.get_token_from_cookie(request)
        if not token:
            token = self.user_manager.get_request_token(request)
        if not token or not self.user_manager.validate_token(token):
            return self.error("Unauthorized", 401)
        return True