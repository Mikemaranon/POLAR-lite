from flask import request

from api_m.domains.base_api import BaseAPI


class SettingsAPI(BaseAPI):
    def register(self):
        self.app.add_url_rule("/api/settings", view_func=self.handle_settings_get, methods=["GET"])
        self.app.add_url_rule("/api/settings", view_func=self.handle_settings_post, methods=["POST"])

    def handle_settings_get(self):
        auth = self.authenticate_request(request)
        if auth is not True:
            return auth

        key = request.args.get("key")
        if key:
            setting = self.db.settings.get(key)
            if not setting:
                return self.error("Setting not found", 404)
            return self.ok({"setting": setting})

        return self.ok({"settings": self.db.settings.all()})

    def handle_settings_post(self):
        auth = self.authenticate_request(request)
        if auth is not True:
            return auth

        data = self.get_request_json(request)
        try:
            self.require_fields(data, "key", "value")
        except ValueError as error:
            return self.error(str(error), 400)

        self.db.settings.set(data["key"], data["value"])
        return self.ok({"setting": self.db.settings.get(data["key"])}, 201)
