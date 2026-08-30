app_name = "az_auth"
app_title = "AZ Auth"
app_publisher = "AlazabDev"
app_description = "Enterprise identity and access management for Frappe"
app_email = "support@az-auth.local"
app_license = "MIT"

app_include_css = "/assets/az_auth/css/az_auth.css"
app_include_js = "/assets/az_auth/js/az_auth.js"

after_install = "az_auth.setup.install.after_install"
after_migrate = "az_auth.setup.install.after_migrate"

fixtures = [
    {"dt": "Role", "filters": [["name", "in", ["AZ Auth Administrator", "AZ Auth Manager", "AZ Auth Viewer"]]]},
]

website_route_rules = [{"from_route": "/az-auth", "to_route": "az_auth"}]

scheduler_events = {"daily": ["az_auth.api.prune_expired_sessions"]}

permission_query_conditions = {
    "AZ Organization": "az_auth.permissions.organization_query",
    "AZ Application": "az_auth.permissions.application_query",
    "AZ Audit Event": "az_auth.permissions.audit_query",
}

has_permission = {
    "AZ Organization": "az_auth.permissions.organization_has_permission",
    "AZ Application": "az_auth.permissions.application_has_permission",
}

jinja = {"methods": ["az_auth.api.get_current_user"]}

def get_context(context):
    context.no_cache = 1
    context.title = "AZ Auth"
    context.language = "ar"
    return context
