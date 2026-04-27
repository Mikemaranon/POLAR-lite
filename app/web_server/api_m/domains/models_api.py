from flask import request

from api_m.domains.base_api import BaseAPI
from model_m import ProviderError


class ModelsAPI(BaseAPI):
    def register(self):
        self.app.add_url_rule("/api/models", view_func=self.get_models, methods=["GET"])

    def get_models(self):
        auth = self.authenticate_request(request)
        if auth is not True:
            return auth

        provider_name = request.args.get("provider")

        try:
            catalog = self.model_manager.list_models(provider_name)
        except ProviderError as error:
            return self.ok({"error": error.to_dict()}, error.status_code)

        return self.ok(catalog)
