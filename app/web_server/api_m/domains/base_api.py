# api_m/domains/base_api.py

from flask import jsonify
from user_m import UserManager
from model_m import ModelManager

class BaseAPI:
    def __init__(self, app, user_manager: UserManager, db, model_manager: ModelManager):
        self.app = app
        self.user_manager = user_manager
        self.db = db
        self.model_manager = model_manager

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

    def get_request_json(self, request):
        return request.get_json(silent=True) or {}

    def parse_int(self, value, field_name):
        if value is None or value == "":
            return None

        try:
            return int(value)
        except (TypeError, ValueError):
            raise ValueError(f"Invalid {field_name}")

    def require_fields(self, data, *field_names):
        for field_name in field_names:
            value = data.get(field_name)
            if value is None or value == "":
                raise ValueError(f"Missing {field_name}")

    def get_default_profile(self):
        return self.db.profiles.get_default()
