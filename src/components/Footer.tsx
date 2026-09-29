import { Link } from "react-router-dom";
import { Mail, Phone, Globe, ExternalLink } from "lucide-react";
import logoLight from "@/assets/brand/alazab-on-dark.png";

const Footer = () => {
  const year = new Date().getFullYear();

  const quickLinks = [
    { to: "/", label: "الرئيسية" },
    { to: "/about", label: "من نحن" },
    { to: "/services", label: "خدماتنا" },
    { to: "/projects", label: "مشاريعنا" },
    { to: "/brands", label: "علاماتنا التجارية" },
    { to: "/knowledge", label: "قاعدة المعرفة" },
    { to: "/blogs", label: "المدونة" },
    { to: "/guidance", label: "الأدلة العملية" },
    { to: "/faq", label: "الأسئلة الشائعة" },
    { to: "/contact", label: "اتصل بنا" },
  ];

  const services = [
    { to: "/services/luxury-finishing", label: "التشطيب الراقي" },
    { to: "/services/brand-identity", label: "هوية العلامة التجارية" },
    { to: "/services/uberfix", label: "أوبرفيكس - الصيانة المعمارية" },
    { to: "/services/laban-alasfour", label: "لبن العصفور - التوريدات" },
  ];

  const branches = [
    { title: "المقر الرئيسي - القاهرة", address: "مصر، القاهرة، المعادي", phone: "+201004006620" },
    { title: "فرع الدقهلية - نبروه", address: "مصر، الدقهلية، مدينة نبروه", phone: "+201014536600" },
    { title: "فرع الإسكندرية", address: "مصر، الإسكندرية، سموحة", phone: "+201004006620" },
  ];

  const legal = [
    { to: "/privacy-policy", label: "سياسة الخصوصية" },
    { to: "/terms-of-service", label: "الشروط والأحكام" },
    { to: "/cookie-policy", label: "سياسة الكوكيز" },
    { to: "/data-deletion", label: "حذف البيانات" },
    { to: "/refund-policy", label: "الاسترداد والإلغاء" },
    { to: "/acceptable-use", label: "الاستخدام المقبول" },
    { to: "/disclaimer", label: "إخلاء المسؤولية" },
    { to: "/security", label: "الأمان" },
    { to: "/legal-contact", label: "الاتصال القانوني" },
  ];

  return (
    <footer id="contact" className="bg-gradient-to-b from-[#030957] to-[#01043a] text-white py-16">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          <div>
            <div className="mb-6 flex items-center gap-3">
              <img src={logoLight} alt="العزب للمقاولات" className="h-12 w-auto" />
              <div>
                <h3 className="text-lg font-bold text-white">العزب</h3>
                <p className="text-xs text-white/60">للمقاولات المتكاملة</p>
              </div>
            </div>
            <p className="text-white/70 mb-4 leading-relaxed text-sm">
              شركة رائدة في مجال المقاولات والإنشاءات، نقدم خدمات متكاملة بأعلى معايير الجودة والاحترافية.
            </p>
            <div className="flex gap-6 text-sm">
              <div className="text-center"><div className="text-xl font-bold text-primary">20+</div><div className="text-xs text-white/60">سنة خبرة</div></div>
              <div className="text-center"><div className="text-xl font-bold text-primary">500+</div><div className="text-xs text-white/60">مشروع</div></div>
              <div className="text-center"><div className="text-xl font-bold text-primary">100+</div><div className="text-xs text-white/60">عميل</div></div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-bold mb-5 text-white border-b border-primary/30 pb-2">روابط سريعة</h3>
            <ul className="space-y-3">
              {quickLinks.map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="text-white/70 hover:text-primary transition-colors duration-300 text-sm flex items-center gap-2">
                    <span className="text-primary">←</span>{link.label}
                  </Link>
                </li>
              ))}
              <li>
                <a href="https://erp.alazab.com/apps" target="_blank" rel="noopener noreferrer" className="text-white/70 hover:text-primary transition-colors duration-300 text-sm flex items-center gap-2">
                  <span className="text-primary">←</span>نظام ERP الإداري<ExternalLink className="w-3 h-3 opacity-60" />
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-bold mb-5 text-white border-b border-primary/30 pb-2">خدماتنا</h3>
            <ul className="space-y-3 text-white/70 text-sm">
              {services.map((service) => (
                <li key={service.to}>
                  <Link to={service.to} className="flex items-center gap-2 hover:text-primary transition-colors">
                    <span className="w-1.5 h-1.5 bg-primary rounded-full shrink-0" />{service.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-bold mb-5 text-white border-b border-primary/30 pb-2">معلومات الاتصال</h3>
            <div className="space-y-4 text-sm">
              {branches.map((branch) => (
                <div key={branch.title} className="bg-white/5 rounded-lg p-3">
                  <p className="font-medium text-white text-xs mb-1">{branch.title}</p>
                  <p className="text-white/60 text-xs">{branch.address}</p>
                  <p className="text-primary text-xs mt-1" dir="ltr">{branch.phone}</p>
                </div>
              ))}
              <div className="pt-2 space-y-2">
                <a href="mailto:support@al-azab.co" className="text-white/70 hover:text-primary transition-colors flex items-center gap-2 text-xs"><Mail className="w-3.5 h-3.5" />support@al-azab.co</a>
                <a href="https://al-azab.co" target="_blank" rel="noopener noreferrer" className="text-white/70 hover:text-primary transition-colors flex items-center gap-2 text-xs"><Globe className="w-3.5 h-3.5" />al-azab.co</a>
                <a href="tel:+201004006620" className="text-white/70 hover:text-primary transition-colors flex items-center gap-2 text-xs" dir="ltr"><Phone className="w-3.5 h-3.5" />+20 100 400 6620</a>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 pt-8 mt-10">
          <h3 className="text-sm font-bold mb-4 text-white/80 text-center">الصفحات القانونية</h3>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-white/60">
            {legal.map((link) => <Link key={link.to} to={link.to} className="hover:text-primary transition-colors">{link.label}</Link>)}
          </div>
        </div>

        <hr className="border-white/10 my-6" />
        <div className="text-center text-white/60 text-xs">
          <p className="mb-2">جميع الحقوق محفوظة © {year} شركة العزب للمقاولات</p>
          <p className="leading-relaxed max-w-2xl mx-auto opacity-70">شركة العزب للإنشاءات تعمل تحت العلامة التجارية المسجلة D-U-N-S No: 849203826</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
