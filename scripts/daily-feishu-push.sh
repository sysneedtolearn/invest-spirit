#!/bin/bash
# 投资精灵每日飞书推送脚本
# 由 cron 每天 14:30 触发

FEISHU_APP_ID="cli_a92c7bdc38385cc9"
FEISHU_APP_SECRET="u0qaRtrEGr0Rc30YAZ9yobY872BBlP6E"
FEISHU_USER_OPEN_ID="ou_484c25838f04fa902d31dcc4594e8fd8"

# 获取 token
get_token() {
  curl -s -X POST 'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal' \
    -H 'Content-Type: application/json' \
    -d "{\"app_id\":\"$FEISHU_APP_ID\",\"app_secret\":\"$FEISHU_APP_SECRET\"}" \
    | python3 -c "import json,sys; print(json.load(sys.stdin).get('tenant_access_token',''))"
}

# 发送飞书消息
send_feishu() {
  local token="$1"
  local msg="$2"
  # 转义 JSON
  local escaped=$(python3 -c "import json,sys; print(json.dumps(sys.argv[1]))" "$msg")
  curl -s -X POST 'https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_id' \
    -H "Authorization: Bearer $token" \
    -H 'Content-Type: application/json' \
    -d "{\"receive_id\":\"$FEISHU_USER_OPEN_ID\",\"msg_type\":\"text\",\"content\":\"{\\\"text\\\":$escaped}\"}"
}

echo "$(date): 飞书推送脚本启动"

TOKEN=$(get_token)
if [ -z "$TOKEN" ]; then
  echo "ERROR: 获取飞书 token 失败"
  exit 1
fi

echo "Token 获取成功"
send_feishu "$TOKEN" "$1"
