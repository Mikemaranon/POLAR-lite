# web_server/server.py

from flask import Flask

from config_m import ConfigManager
from data_m import DBManager
from model_m import ModelManager
from user_m import UserManager
from api_m import ApiManager
from app_routes import AppRoutes


class Server:
    def __init__(self, app: Flask):
        self.app = app

        self.config_manager = self.ini_config_manager()
        self.app.secret_key = self.config_manager.runtime.secret_key

        self.DBManager = self.ini_DBManager()
        self.user_manager = self.ini_user_manager()
        self.model_manager = self.ini_model_manager()
        self.app_routes = self.ini_app_routes()
        self.api_manager = self.ini_api_manager()

        self.run()

    def ini_config_manager(self):
        return ConfigManager()

    def ini_DBManager(self):
        return DBManager()

    def ini_user_manager(self):
        return UserManager(
            db_manager=self.DBManager,
            secret_key=self.config_manager.runtime.secret_key,
        )

    def ini_model_manager(self):
        return ModelManager(self.config_manager)

    def ini_app_routes(self):
        return AppRoutes(self.app, self.user_manager, self.DBManager)

    def ini_api_manager(self):
        return ApiManager(self.app, self.user_manager, self.DBManager)

    def run(self):
        runtime = self.config_manager.runtime
        self.app.run(
            debug=runtime.debug,
            host=runtime.host,
            port=runtime.port,
        )
