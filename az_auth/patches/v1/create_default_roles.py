import frappe


def execute():
    from az_auth.setup.install import _ensure_roles
    _ensure_roles()
