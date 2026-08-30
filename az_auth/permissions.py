import frappe


def _is_admin(user):
    return user == "Administrator" or "AZ Auth Administrator" in frappe.get_roles(user)


def organization_query(user):
    if _is_admin(user):
        return ""
    return "`tabAZ Organization`.owner = {user}".format(user=frappe.db.escape(user))


def application_query(user):
    if _is_admin(user):
        return ""
    return "`tabAZ Application`.owner = {user}".format(user=frappe.db.escape(user))


def audit_query(user):
    if _is_admin(user):
        return ""
    return "`tabAZ Audit Event`.user = {user}".format(user=frappe.db.escape(user))


def organization_has_permission(doc, user=None, permission_type=None):
    return _is_admin(user or frappe.session.user) or doc.owner == (user or frappe.session.user)


def application_has_permission(doc, user=None, permission_type=None):
    return _is_admin(user or frappe.session.user) or doc.owner == (user or frappe.session.user)
