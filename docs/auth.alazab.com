# ==============================================================================
# Alazab Central Auth Portal - Nginx Production Configuration
# النطاق: auth.alazab.com
# مسار الملف على السيرفر: /etc/nginx/sites-available/auth.alazab.com
# ==============================================================================

# 1. تحويل جميع طلبات HTTP تلقائياً إلى HTTPS المشفر
server {
    listen 80;
    listen [::]:80;
    server_name auth.alazab.com;

    # مسار التحقق من شهادة Let's Encrypt (Certbot)
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
        allow all;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

# 2. خادم HTTPS الأساسي
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name auth.alazab.com;

    # مسار ملفات الإنتاج المبنية (Vite dist)
    root /var/www/auth.alazab.com/dist;
    index index.html;

    # --------------------------------------------------------------------------
    # إعدادات وشهادات SSL (يتم تحديث المسارات تلقائياً بواسطة Certbot)
    # --------------------------------------------------------------------------
    ssl_certificate /etc/letsencrypt/live/auth.alazab.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/auth.alazab.com/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;

    # --------------------------------------------------------------------------
    # ترويسات الأمان (Security Headers)
    # --------------------------------------------------------------------------
    # فرض HTTPS عبر المتصفحات لمدة عام مع تضمين النطاقات الفرعية
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    
    # منع تخمين نوع الملفات
    add_header X-Content-Type-Options "nosniff" always;
    
    # حماية من هجمات Clickjacking
    add_header X-Frame-Options "SAMEORIGIN" always;
    
    # حماية ضد XSS للمتصفحات القديمة
    add_header X-XSS-Protection "1; mode=block" always;
    
    # سياسة المرجع
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # تقييد ميزات العتاد غير المستخدمة (الكاميرا/الموقع/الميكروفون مسموح للذكاء الاصطناعي الصوتي فقط عند الحاجة)
    add_header Permissions-Policy "camera=(), microphone=(self), geolocation=()" always;

    # --------------------------------------------------------------------------
    # سجلات الدخول والأخطاء
    # --------------------------------------------------------------------------
    access_log /var/log/nginx/auth_alazab_access.log;
    error_log /var/log/nginx/auth_alazab_error.log warn;

    # --------------------------------------------------------------------------
    # ضغط البيانات (Gzip Compression)
    # --------------------------------------------------------------------------
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_buffers 16 8k;
    gzip_http_version 1.1;
    gzip_min_length 256;
    gzip_types
        text/plain
        text/css
        text/javascript
        application/javascript
        application/json
        application/x-javascript
        text/xml
        application/xml
        application/xml+rss
        image/svg+xml;

    # --------------------------------------------------------------------------
    # توجيه مسارات التطبيق (Single Page Application - React/Vite)
    # --------------------------------------------------------------------------
    # أي طلب لمسار داخلي (/login, /admin, /portal/refresh ...) يُعاد توجيهه لـ index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # عدم تخزين index.html في الكاش لضمان وصول التحديثات البرمجية فوراً للعملاء
    location = /index.html {
        add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0" always;
        expires off;
    }

    # --------------------------------------------------------------------------
    # التخزين المؤقت للأصول الثابتة (Static Assets Caching)
    # --------------------------------------------------------------------------
    # ملفات Vite المحزومة بأرقام Hash تخزن لعام كامل لسرعة فائقة
    location ~* \.(?:css|js|woff2?|ttf|eot|png|jpe?g|webp|svg|ico)$ {
        expires 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
        access_log off;
    }

    # منع الوصول للملفات المخفية (.env, .git ...)
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }
}
