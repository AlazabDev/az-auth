frappe.provide('az_auth');

az_auth.open_overview = function () {
  frappe.call({ method: 'az_auth.api.get_overview' }).then(({ message }) => {
    frappe.msgprint({ title: __('AZ Auth'), message: __('تم تحميل لوحة إدارة الهوية بنجاح') });
    return message;
  });
};

document.addEventListener('DOMContentLoaded', () => {
  document.documentElement.setAttribute('dir', frappe.boot.lang === 'ar' ? 'rtl' : 'ltr');
});
