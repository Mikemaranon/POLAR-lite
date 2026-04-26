# api_m/domains/users_api.py

from flask import request
from api_m.domains.base_api import BaseAPI

class UserAPI(BaseAPI):

    def register(self):
        self.app.add_url_rule("/api/users/register", view_func=self.register_user, methods=["POST"])
        self.app.add_url_rule("/api/users/get", view_func=self.get_user, methods=["POST"])
        self.app.add_url_rule("/api/users/all", view_func=self.get_all_users, methods=["GET"])
        self.app.add_url_rule("/api/users/delete", view_func=self.delete_user, methods=["DELETE"])

    # ============================================================
    #                       ENDPOINTS
    # ============================================================

    def register_user(self):
        
        data = request.get_json()
        username = data.get("username")
        password = data.get("password")

        if not username or not password:
            return self.error("Missing username or password", 400)

        # Create user through UserManager
        created = self.user_manager.create_user(username, password)

        if not created:
            return self.error("User already exists", 400)

        return self.ok({"message": "User created successfully"}, 201)

    def get_user(self):

        auth = self.authenticate_request(request)
        if auth is not True:
            return auth

        data = request.get_json()
        username = data.get("username")

        if not username:
            return self.error("Missing username", 400)

        user = self.db.users.get(username)
        if not user:
            return self.error("User not found", 404)

        user.pop("password", None)
        return self.ok(user)


    def get_all_users(self):
 
        auth = self.authenticate_request(request)
        if auth is not True:
            return auth

        users = self.db.users.all()

        for u in users:
            u.pop("password", None)

        return self.ok({"users": users})


    def delete_user(self):
 
        auth = self.authenticate_request(request)
        if auth is not True:
            return auth

        data = request.get_json()
        username = data.get("username")

        if not username:
            return self.error("Missing username", 400)

        deleted = self.db.users.delete(username)
        if not deleted:
            return self.error("User not found", 404)

        return self.ok({"message": "User deleted successfully"})
