#!/usr/bin/env bash
# ==============================================================================
# Alazab Central Auth - Production Health & Verification Script
# موقع السيرفر: Ubuntu / Production Host
# متطلبات التشغيل: curl, jq
# ==============================================================================

set -uo pipefail

# الألوان والتنسيق للطباعة
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# تحميل المتغيرات من .env إن وجد
if [ -f .env ]; then
  # export safe key-value pairs without overriding already exported vars
  export $(grep -v '^#' .env | grep -v '^$' | xargs) 2>/dev/null || true
fi

# المتغيرات الأساسية (يمكن تمريرها كمتغيرات بيئة عند التشغيل)
AUTH_ORIGIN="${AUTH_ORIGIN:-https://auth.alazab.com}"
SUPABASE_URL="${SUPABASE_URL:-${VITE_SUPABASE_URL:-https://bxuhcbfdoaflsgbxiqei.supabase.co}}"
ANON_KEY="${ANON_KEY:-${VITE_SUPABASE_PUBLISHABLE_KEY:-}}"

PASSED_CHECKS=0
FAILED_CHECKS=0

print_header() {
  echo -e "\n${BOLD}${BLUE}======================================================${NC}"
  echo -e "${BOLD}${BLUE}  🚀 فحص صحة وجاهزية نظام المصادقة المركزي (Alazab) ${NC}"
  echo -e "${CYAN}  التاريخ: $(date -u '+%Y-%m-%d %H:%M:%S UTC')${NC}"
  echo -e "${CYAN}  النطاق: ${AUTH_ORIGIN}${NC}"
  echo -e "${BOLD}${BLUE}======================================================${NC}\n"
}

check_dependencies() {
  for cmd in curl jq; do
    if ! command -v "$cmd" &>/dev/null; then
      echo -e "${RED}✘ الأداة المطلوبة غير مثبتة: $cmd${NC}"
      echo -e "  لتثبيتها نفذ: sudo apt-get update && sudo apt-get install -y curl jq"
      exit 1
    fi
  done
}

log_pass() {
  echo -e "  ${GREEN}✔ [نجاح]${NC} $1"
  ((PASSED_CHECKS++))
}

log_fail() {
  echo -e "  ${RED}✘ [فشل]${NC} $1"
  ((FAILED_CHECKS++))
}

log_warn() {
  echo -e "  ${YELLOW}⚠ [تنبيه]${NC} $1"
}

# ------------------------------------------------------------------------------
# 1. فحص واجهة المستخدم وخادم Nginx
# ------------------------------------------------------------------------------
test_frontend_web() {
  echo -e "${BOLD}[1/5] فحص خادم الويب وواجهة المصادقة (${AUTH_ORIGIN})...${NC}"
  
  local response
  local http_code
  local time_total

  response=$(curl -s -w "\n%{http_code}\n%{time_total}" -m 10 "${AUTH_ORIGIN}" || echo -e "\n000\n0")
  time_total=$(echo "$response" | tail -n 1)
  http_code=$(echo "$response" | tail -n 2 | head -n 1)

  if [ "$http_code" -eq 200 ]; then
    log_pass "الواجهة تعمل وترد برمز 200 OK (${time_total} ثانية)"
  else
    log_fail "الواجهة لم ترد بالرمز المتوقع. الرمز المستلم: HTTP ${http_code}"
  fi
}

# ------------------------------------------------------------------------------
# 2. فحص خدمة المصادقة السحابية والمزودين (Supabase Auth Settings)
# ------------------------------------------------------------------------------
test_auth_providers() {
  echo -e "\n${BOLD}[2/5] فحص إعدادات المزوّدين عبر Supabase Auth API...${NC}"

  if [ -z "$ANON_KEY" ]; then
    log_warn "المفتاح ANON_KEY غير محدد، سيتم تجربة الطلب بدون ترويسة المفتاح..."
  fi

  local start_ns end_ns latency_ms
  start_ns=$(date +%s%N 2>/dev/null || date +%s)

  local http_code
  local body_file
  body_file=$(mktemp)

  http_code=$(curl -s -m 10 -o "$body_file" -w "%{http_code}" \
    -H "apikey: ${ANON_KEY}" \
    "${SUPABASE_URL}/auth/v1/settings")

  end_ns=$(date +%s%N 2>/dev/null || date +%s)
  if [ "$start_ns" -ne "$end_ns" ] && [ ${#start_ns} -gt 10 ]; then
    latency_ms=$(( (end_ns - start_ns) / 1000000 ))
  else
    latency_ms="N/A"
  fi

  if [ "$http_code" -ne 200 ]; then
    log_fail "فشل الاتصال بـ ${SUPABASE_URL}/auth/v1/settings (HTTP ${http_code})"
    rm -f "$body_file"
    return
  fi

  log_pass "الاتصال بخدمة المصادقة نشط وسليم (زمن الاستجابة: ${latency_ms}ms)"

  # فحص تفعيل كل مزوّد على حدة
  local providers=("email" "phone" "google" "facebook" "azure" "github")
  for p in "${providers[@]}"; do
    local is_enabled
    is_enabled=$(jq -r ".external.\"$p\" // empty" "$body_file")
    
    if [ "$is_enabled" = "true" ]; then
      log_pass "المزوّد [${p}]: مفعّل ونشط على الخادم"
    elif [ "$is_enabled" = "false" ]; then
      log_warn "المزوّد [${p}]: غير مفعّل (Disabled)"
    else
      log_warn "المزوّد [${p}]: حالة غير معروفة أو لم يُذكر في الإعدادات"
    fi
  done

  rm -f "$body_file"
}

# ------------------------------------------------------------------------------
# 3. فحص بوابة الـ API Gateway
# ------------------------------------------------------------------------------
test_api_gateway() {
  echo -e "\n${BOLD}[3/5] فحص بوابة API Gateway (/functions/v1/api-gateway)...${NC}"

  local gw_url="${SUPABASE_URL}/functions/v1/api-gateway/v1/health"
  local response
  local http_code
  local body_file
  body_file=$(mktemp)

  http_code=$(curl -s -m 10 -o "$body_file" -w "%{http_code}" \
    -H "apikey: ${ANON_KEY}" \
    "$gw_url")

  if [ "$http_code" -eq 200 ]; then
    local status req_id
    status=$(jq -r '.data.status // empty' "$body_file")
    req_id=$(jq -r '.request_id // empty' "$body_file")

    if [ "$status" = "healthy" ]; then
      log_pass "بوابة API Gateway تعمل وجاهزة (status: healthy, request_id: ${req_id:-N/A})"
    else
      log_fail "ردت البوابة بنجاح لكن الحالة ليست healthy: $(cat "$body_file")"
    fi
  else
    log_fail "فشل فحص API Gateway على المسار ${gw_url} (HTTP ${http_code})"
  fi

  rm -f "$body_file"
}

# ------------------------------------------------------------------------------
# 4. فحص خدمة تصريح دخول Outpost (Portal JWT Service)
# ------------------------------------------------------------------------------
test_portal_jwt() {
  echo -e "\n${BOLD}[4/5] فحص خدمة رموز البوابة Outpost (/functions/v1/portal-jwt)...${NC}"

  local jwt_url="${SUPABASE_URL}/functions/v1/portal-jwt/health"
  local http_code
  local body_file
  body_file=$(mktemp)

  http_code=$(curl -s -m 10 -o "$body_file" -w "%{http_code}" \
    -H "apikey: ${ANON_KEY}" \
    "$jwt_url")

  if [ "$http_code" -eq 200 ]; then
    local svc_status svc_issuer svc_ttl
    svc_status=$(jq -r '.data.status // empty' "$body_file")
    svc_issuer=$(jq -r '.data.issuer // empty' "$body_file")
    svc_ttl=$(jq -r '.data.ttl // empty' "$body_file")

    if [ "$svc_status" = "healthy" ]; then
      log_pass "خدمة Portal JWT سليمة (Issuer: ${svc_issuer}, صلاحية الرمز: ${svc_ttl}s)"
    else
      log_fail "استجابة غير صحية من خدمة البوابة: $(cat "$body_file")"
    fi
  else
    log_fail "فشل فحص Portal JWT على المسار ${jwt_url} (HTTP ${http_code})"
  fi

  rm -f "$body_file"
}

# ------------------------------------------------------------------------------
# 5. فحص ترويسات الأمان و CORS
# ------------------------------------------------------------------------------
test_cors_preflight() {
  echo -e "\n${BOLD}[5/5] فحص ترويسات CORS المباشرة لبوابة المصادقة...${NC}"

  local cors_header
  cors_header=$(curl -s -I -X OPTIONS -m 10 \
    -H "Origin: https://alazab.com" \
    -H "Access-Control-Request-Method: POST" \
    "${SUPABASE_URL}/functions/v1/api-gateway/v1/health" | grep -i "access-control-allow-origin" || true)

  if [ -n "$cors_header" ]; then
    log_pass "تم التحقق من ترويسة CORS اليدوية: $(echo "$cors_header" | tr -d '\r\n')"
  else
    log_warn "لم يتم العثور على ترويسة Access-Control-Allow-Origin في رد الـ OPTIONS"
  fi
}

# ------------------------------------------------------------------------------
# النتيجة والتقرير الختامي
# ------------------------------------------------------------------------------
print_summary() {
  echo -e "\n${BOLD}${BLUE}======================================================${NC}"
  echo -e "${BOLD}  ملخص نتائج الفحص:${NC}"
  echo -e "  الفحوصات الناجحة: ${GREEN}${PASSED_CHECKS}${NC}"
  echo -e "  الفحوصات الفاشلة: ${RED}${FAILED_CHECKS}${NC}"
  echo -e "${BOLD}${BLUE}======================================================${NC}"

  if [ "$FAILED_CHECKS" -eq 0 ]; then
    echo -e "\n${GREEN}${BOLD}✔ جميع نقاط التحقق تعمل بكفاءة والنظام جاهز للإنتاج.${NC}\n"
    exit 0
  else
    echo -e "\n${RED}${BOLD}✘ تم رصد ${FAILED_CHECKS} أخطاء تحتاج للمراجعة قبل الاعتماد.${NC}\n"
    exit 1
  fi
}

# تشغيل الفحوصات
check_dependencies
print_header
test_frontend_web
test_auth_providers
test_api_gateway
test_portal_jwt
test_cors_preflight
print_summary
