import frappe


def after_install():
    _ensure_roles()
    _ensure_workspace()


def after_migrate():
    _ensure_roles()


def _ensure_roles():
    for name, desk_access in [("AZ Auth Administrator", 1), ("AZ Auth Manager", 1), ("AZ Auth Viewer", 1)]:
        if not frappe.db.exists("Role", name):
            frappe.get_doc({"doctype": "Role", "role_name": name, "desk_access": desk_access}).insert(ignore_permissions=True)


def _ensure_workspace():
    if frappe.db.exists("Workspace", "AZ Auth"):
        return
    frappe.get_doc({
        "doctype": "Workspace", "name": "AZ Auth", "title": "AZ Auth",
        "module": "AZ Auth", "public": 0, "is_hidden": 0,
        "content": '[{"type":"header","data":{"text":"لوحة AZ Auth","col":12}},{"type":"shortcut","data":{"shortcut_name":"المؤسسات","col":3}},{"type":"shortcut","data":{"shortcut_name":"التطبيقات","col":3}}]'
    }).insert(ignore_permissions=True)
