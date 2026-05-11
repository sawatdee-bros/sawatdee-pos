#!/usr/bin/env bash
# ============================================================================
# Phase 5 Firebase Rules E2E テスト
# ============================================================================
# 目的：
#   - reservation/勤怠の新ルールが正しく動くか自動検証
#   - POS既存（orders/pax/calls等）が壊れていないか
#   - 異常データ（必須欠落・不正値・不正enum）が確実に拒否されるか
#
# 使い方：
#   Rules投入「前」に実行 → baseline記録（全部拒否されるはず）
#   Rules投入「後」に実行 → 正常系成功・異常系拒否・POS既存成功 を確認
#
#   $ bash tests/rules_e2e.sh
#
# テストデータは /tenants/sawatdee-bros/{各ノード}/_test_e2e_xxx/ と
# /orders/_test_e2e_xxx/ 等に書く。スクリプト末尾で全部削除。
# ============================================================================

set -u
FB_BASE="https://sawatdee-bros-default-rtdb.asia-southeast1.firebasedatabase.app"
TID="sawatdee-bros"
PASS=0
FAIL=0
ERRORS=()

# 色出力（ターミナル対応していなければ無視される）
G='\033[0;32m'
R='\033[0;31m'
Y='\033[0;33m'
NC='\033[0m'

test_write() {
  local name="$1"
  local path="$2"
  local data="$3"
  local expect="$4"  # "ok" / "deny"

  local status
  status=$(curl -s -o /dev/null -w "%{http_code}" -X PUT \
    -H "Content-Type: application/json" \
    -d "$data" \
    "$FB_BASE/$path.json")

  if [ "$expect" = "ok" ]; then
    if [ "$status" = "200" ]; then
      printf "  ${G}✅${NC} %s (HTTP %s)\n" "$name" "$status"
      PASS=$((PASS+1))
    else
      printf "  ${R}❌${NC} %s (HTTP %s, expected 200)\n" "$name" "$status"
      ERRORS+=("$name: HTTP $status, expected 200")
      FAIL=$((FAIL+1))
    fi
  else
    # 拒否は 401 (Permission denied) or 400 (validation failed)
    if [ "$status" = "401" ] || [ "$status" = "400" ] || [ "$status" = "403" ]; then
      printf "  ${G}✅${NC} %s (HTTP %s・拒否)\n" "$name" "$status"
      PASS=$((PASS+1))
    else
      printf "  ${R}❌${NC} %s (HTTP %s・拒否されるはず)\n" "$name" "$status"
      ERRORS+=("$name: HTTP $status, expected 400/401/403")
      FAIL=$((FAIL+1))
    fi
  fi
}

cleanup() {
  printf "${Y}クリーンアップ中...${NC}\n"
  # tenants 配下のテストデータ
  curl -s -X DELETE "$FB_BASE/tenants/$TID/reservations/2026-05-11/_test_e2e_ok1.json" > /dev/null
  curl -s -X DELETE "$FB_BASE/tenants/$TID/reservations/2026-05-11/_test_e2e_ng1.json" > /dev/null
  curl -s -X DELETE "$FB_BASE/tenants/$TID/reservations/2026-05-11/_test_e2e_ng2.json" > /dev/null
  curl -s -X DELETE "$FB_BASE/tenants/$TID/reservations/2026-05-11/_test_e2e_ng3.json" > /dev/null
  curl -s -X DELETE "$FB_BASE/tenants/$TID/reservations/2026-05-11/_test_e2e_ng4.json" > /dev/null
  curl -s -X DELETE "$FB_BASE/tenants/$TID/reservations/2026-05-11.json" > /dev/null
  curl -s -X DELETE "$FB_BASE/tenants/$TID/reservation_settings.json" > /dev/null
  curl -s -X DELETE "$FB_BASE/tenants/$TID/staff_master/_test_e2e_ok1.json" > /dev/null
  curl -s -X DELETE "$FB_BASE/tenants/$TID/staff_master/_test_e2e_ng1.json" > /dev/null
  curl -s -X DELETE "$FB_BASE/tenants/$TID/staff_master/_test_e2e_ng2.json" > /dev/null
  curl -s -X DELETE "$FB_BASE/tenants/$TID/staff_master/_test_e2e_ng3.json" > /dev/null
  curl -s -X DELETE "$FB_BASE/tenants/$TID/shifts/_test_e2e.json" > /dev/null
  curl -s -X DELETE "$FB_BASE/tenants/$TID/attendance/_test_e2e.json" > /dev/null
  curl -s -X DELETE "$FB_BASE/tenants/$TID/attendance_settings/_test_e2e.json" > /dev/null
  curl -s -X DELETE "$FB_BASE/tenants/$TID/attendance_confirmations/_test_e2e.json" > /dev/null
  curl -s -X DELETE "$FB_BASE/tenants/$TID/email_log/_test_e2e.json" > /dev/null
  # POS 既存テストデータ
  curl -s -X DELETE "$FB_BASE/orders/_test_e2e_pos1.json" > /dev/null
  curl -s -X DELETE "$FB_BASE/pax/_test_e2e_pos.json" > /dev/null
  curl -s -X DELETE "$FB_BASE/tables/_test_e2e_pos.json" > /dev/null
  curl -s -X DELETE "$FB_BASE/calls/_test_e2e_pos.json" > /dev/null
  curl -s -X DELETE "$FB_BASE/bill_calls/_test_e2e_pos.json" > /dev/null
  echo "cleanup done."
}

trap cleanup EXIT

echo "============================================================"
echo "  POS Firebase Rules E2E テスト"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================================"

# ============================================================
# [1] reservation 系 ・ 正常系（投入後成功すべき）
# ============================================================
printf "\n${Y}■ reservation 正常系${NC}\n"

test_write "reservations: 全必須フィールド揃って書き込み" \
  "tenants/$TID/reservations/2026-05-11/_test_e2e_ok1" \
  '{"date":"2026-05-11","time_slot":"18:00","party_size":2,"name":"テスト太郎","phone":"090-0000-0000","status":"pending","created_at":1234567890}' \
  ok

test_write "reservation_settings: time_slots_by_dow ありで全体書き込み" \
  "tenants/$TID/reservation_settings" \
  '{"time_slots_by_dow":{"mon":["18:00","19:00"]}}' \
  ok

test_write "reservation_settings: time_slots_by_dow なし全体書き込み（拒否）" \
  "tenants/$TID/reservation_settings" \
  '{"other_field":"value"}' \
  deny

test_write "email_log: 自由書き込み" \
  "tenants/$TID/email_log/_test_e2e" \
  '{"to":"test@example.com","sent_at":1234567890}' \
  ok

# ============================================================
# [2] reservation 系 ・ 異常系（投入後拒否されるべき）
# ============================================================
printf "\n${Y}■ reservation 異常系${NC}\n"

test_write "reservations: party_size 欠落" \
  "tenants/$TID/reservations/2026-05-11/_test_e2e_ng1" \
  '{"date":"2026-05-11","time_slot":"18:00","name":"テスト","phone":"090","status":"pending","created_at":1234567890}' \
  deny

test_write "reservations: party_size=999（範囲外）" \
  "tenants/$TID/reservations/2026-05-11/_test_e2e_ng2" \
  '{"date":"2026-05-11","time_slot":"18:00","party_size":999,"name":"テスト","phone":"090","status":"pending","created_at":1234567890}' \
  deny

test_write "reservations: status=invalid（不正enum）" \
  "tenants/$TID/reservations/2026-05-11/_test_e2e_ng3" \
  '{"date":"2026-05-11","time_slot":"18:00","party_size":2,"name":"テスト","phone":"090","status":"invalid","created_at":1234567890}' \
  deny

# ============================================================
# [3] staff_master 系
# ============================================================
printf "\n${Y}■ staff_master 系${NC}\n"

test_write "staff_master: 全必須フィールド・正しいpin" \
  "tenants/$TID/staff_master/_test_e2e_ok1" \
  '{"name":"テスト花子","pin":"1234","hourly_wage":1000,"role":"staff","active":true}' \
  ok

test_write "staff_master: pin=12345（長さ違反）" \
  "tenants/$TID/staff_master/_test_e2e_ng1" \
  '{"name":"テスト","pin":"12345","hourly_wage":1000,"role":"staff","active":true}' \
  deny

test_write "staff_master: hourly_wage=-100（負数）" \
  "tenants/$TID/staff_master/_test_e2e_ng2" \
  '{"name":"テスト","pin":"1234","hourly_wage":-100,"role":"staff","active":true}' \
  deny

test_write "staff_master: withholding_type=丙（不正enum）" \
  "tenants/$TID/staff_master/_test_e2e_ng3" \
  '{"name":"テスト","pin":"1234","hourly_wage":1000,"role":"staff","active":true,"withholding_type":"丙"}' \
  deny

# ============================================================
# [4] その他勤怠系（書き込み自由・validation緩い）
# ============================================================
printf "\n${Y}■ 勤怠系（自由書き込み）${NC}\n"

test_write "shifts: 自由書き込み" \
  "tenants/$TID/shifts/_test_e2e" \
  '{"staff_id":"test","date":"2026-05-11","start":"10:00","end":"18:00"}' \
  ok

test_write "attendance: 自由書き込み" \
  "tenants/$TID/attendance/_test_e2e" \
  '{"staff_id":"test","clock_in":1234567890}' \
  ok

test_write "attendance_settings: 自由書き込み" \
  "tenants/$TID/attendance_settings/_test_e2e" \
  '{"break_threshold_hours":6}' \
  ok

test_write "attendance_confirmations: 自由書き込み" \
  "tenants/$TID/attendance_confirmations/_test_e2e" \
  '{"date":"2026-05-11","confirmed_by":"manager"}' \
  ok

# ============================================================
# [5] POS既存（壊れていないこと）
# ============================================================
printf "\n${Y}■ POS既存 系（壊れていないこと）${NC}\n"

test_write "orders 書き込み" \
  "orders/_test_e2e_pos1" \
  '{"table":"99","items":[],"total":0,"status":"new","timestamp":1234567890}' \
  ok

test_write "pax 書き込み" \
  "pax/_test_e2e_pos" \
  '2' \
  ok

test_write "tables/session 書き込み" \
  "tables/_test_e2e_pos" \
  '{"session":{"startedAt":1,"expiresAt":9999999999999,"pax":2,"issuedBy":"test"}}' \
  ok

test_write "calls 書き込み" \
  "calls/_test_e2e_pos" \
  '{"table":"99","timestamp":1234567890}' \
  ok

test_write "bill_calls 書き込み" \
  "bill_calls/_test_e2e_pos" \
  '{"table":"99","timestamp":1234567890}' \
  ok

# ============================================================
# 結果サマリー
# ============================================================
echo ""
echo "============================================================"
printf "  ${G}PASS${NC}: %d\n" "$PASS"
printf "  ${R}FAIL${NC}: %d\n" "$FAIL"
echo "============================================================"

if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "失敗:"
  for e in "${ERRORS[@]}"; do
    echo "  - $e"
  done
fi

exit $FAIL
