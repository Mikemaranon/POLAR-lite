from flask import request

from api_m.domains.base_api import BaseAPI


class ProjectsAPI(BaseAPI):
    def register(self):
        self.app.add_url_rule("/api/projects", view_func=self.handle_projects_get, methods=["GET"])
        self.app.add_url_rule("/api/projects", view_func=self.handle_projects_post, methods=["POST"])
        self.app.add_url_rule("/api/projects", view_func=self.handle_projects_patch, methods=["PATCH"])
        self.app.add_url_rule("/api/projects", view_func=self.handle_projects_delete, methods=["DELETE"])

    def handle_projects_get(self):
        auth = self.authenticate_request(request)
        if auth is not True:
            return auth

        project_id = request.args.get("id")
        if project_id:
            try:
                project = self.db.projects.get(self.parse_int(project_id, "id"))
            except ValueError as error:
                return self.error(str(error), 400)

            if not project:
                return self.error("Project not found", 404)
            return self.ok({"project": project})

        return self.ok({"projects": self.db.projects.all()})

    def handle_projects_post(self):
        auth = self.authenticate_request(request)
        if auth is not True:
            return auth

        data = self.get_request_json(request)
        try:
            self.require_fields(data, "name")
        except ValueError as error:
            return self.error(str(error), 400)

        project_id = self.db.projects.create(
            data["name"],
            data.get("description"),
            data.get("system_prompt", ""),
        )
        return self.ok({"project": self.db.projects.get(project_id)}, 201)

    def handle_projects_patch(self):
        auth = self.authenticate_request(request)
        if auth is not True:
            return auth

        data = self.get_request_json(request)

        try:
            project_id = self.parse_int(data.get("id"), "id")
            self.require_fields({"id": project_id}, "id")
        except ValueError as error:
            return self.error(str(error), 400)

        existing_project = self.db.projects.get(project_id)
        if not existing_project:
            return self.error("Project not found", 404)

        name = data.get("name", existing_project["name"])
        description = data.get("description", existing_project.get("description"))
        system_prompt = data.get("system_prompt", existing_project.get("system_prompt", ""))

        self.db.projects.update(
            project_id,
            name,
            description,
            system_prompt,
        )
        return self.ok({"project": self.db.projects.get(project_id)})

    def handle_projects_delete(self):
        auth = self.authenticate_request(request)
        if auth is not True:
            return auth

        try:
            project_id = self.parse_int(request.args.get("id"), "id")
            self.require_fields({"id": project_id}, "id")
        except ValueError as error:
            return self.error(str(error), 400)

        project = self.db.projects.get(project_id)
        if not project:
            return self.error("Project not found", 404)

        self.db.projects.delete(project_id)
        return self.ok({"deleted": True, "project_id": project_id})
