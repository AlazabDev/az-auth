import frappe
from frappe import _


@frappe.whitelist()
def get_overview():
    frappe.only_for(['System Manager', 'AZ Auth Administrator', 'AZ Auth Manager', 'AZ Auth Viewer'])
    return {
        "user": get_current_user(),
        "organizations": frappe.db.count("AZ Organization"),
        "applications": frappe.db.count("AZ Application"),
        "providers": frappe.db.count("AZ Identity Provider"),
        "active_sessions": frappe.db.count("AZ Session", {"status": "Active"}),
        "recent_audit": frappe.get_all("AZ Audit Event", fields=["name", "event", "user", "creation"], order_by="creation desc", limit_page_length=8),
    }


def get_current_user():
    user = frappe.session.user
    if user == "Guest":
        return {"name": "Guest", "full_name": _("Guest"), "roles": []}
    return {"name": user, "full_name": frappe.utils.get_fullname(user), "roles": frappe.get_roles(user)}


@frappe.whitelist()
def prune_expired_sessions():
    frappe.db.delete("AZ Session", {"status": "Active", "expires_at": ["<", frappe.utils.now_datetime()]})
    frappe.db.commit()
