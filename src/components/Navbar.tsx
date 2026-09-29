import { useState, useEffect } from "react";
import { Menu, X, Globe, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import logoDark from "@/assets/brand/alazab-on-light.png";
import logoLight from "@/assets/brand/alazab-on-dark.png";

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { t, toggleLang } = useLanguage();

  const navLinks = [
    { label: t("nav.home"), href: "#" },
    { label: t("nav.services"), href: "#services" },
    { label: t("nav.platforms"), href: "#platforms" },
    { label: t("nav.features"), href: "#features" },
    { label: t("nav.contact"), href: "#contact" },
  ];

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav className={`sticky top-0 z-50 border-b transition-all duration-500 ${scrolled ? "border-border/60 glass-strong shadow-sm" : "border-transparent bg-transparent"}`}>
      <div className="container flex items-center justify-between h-[72px]">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="relative w-12 h-12 flex items-center justify-center transition-transform duration-300 group-hover:scale-105">
            <div className="absolute inset-0 rounded-2xl bg-primary/15 blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <img src={theme === "dark" ? logoLight : logoDark} alt="Alazab" className="relative w-12 h-12 object-contain drop-shadow-md" />
          </div>
          <div>
            <h1 className="font-heading font-bold text-foreground text-lg leading-tight">العزب</h1>
            <p className="text-[10px] text-muted-foreground tracking-wide">{t("nav.subtitle")}</p>
          </div>
        </Link>

        <div className="hidden md:flex items-center gap-0.5">
          {navLinks.map((link) => (
            <a key={link.label} href={link.href} className="text-sm font-medium text-muted-foreground hover:text-foreground px-4 py-2.5 rounded-xl hover:bg-muted/60 transition-all duration-300 relative group">
              {link.label}
              <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-0 h-0.5 bg-primary rounded-full group-hover:w-4 transition-all duration-300" />
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-2">
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground rounded-xl" onClick={toggleTheme}>
            {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </Button>
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground rounded-xl" onClick={toggleLang}>
            <Globe className="w-4 h-4" />{t("nav.lang")}
          </Button>
          <div className="w-px h-6 bg-border mx-1" />
          <Button variant="ghost" size="sm" className="hover:bg-muted/60 rounded-xl font-medium" asChild><Link to="/">{t("nav.login")}</Link></Button>
          <Button size="sm" className="shadow-md bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl font-bold px-5" asChild><Link to="/signup">{t("nav.signup")}</Link></Button>
        </div>

        <div className="md:hidden flex items-center gap-1">
          <Button variant="ghost" size="icon" className="text-muted-foreground rounded-xl" onClick={toggleTheme}>{theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}</Button>
          <Button variant="ghost" size="icon" className="text-muted-foreground rounded-xl" onClick={toggleLang}><Globe className="w-4 h-4" /></Button>
          <button className="p-2.5 rounded-xl hover:bg-muted transition-colors" onClick={() => setMobileOpen(!mobileOpen)}>{mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}</button>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} className="md:hidden border-t border-border/50 glass-strong overflow-hidden">
            <div className="container py-4 flex flex-col gap-1">
              {navLinks.map((link) => <a key={link.label} href={link.href} className="text-sm py-3 px-4 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all">{link.label}</a>)}
              <div className="flex gap-2 pt-4 mt-2 border-t border-border/30">
                <Button variant="outline" size="sm" className="flex-1 rounded-xl" asChild><Link to="/">{t("nav.login")}</Link></Button>
                <Button size="sm" className="flex-1 bg-primary text-primary-foreground rounded-xl font-bold" asChild><Link to="/signup">{t("nav.signup")}</Link></Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
