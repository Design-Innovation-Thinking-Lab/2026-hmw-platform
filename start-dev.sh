#!/bin/bash

# 啟動 Next.js 開發伺服器和 Worker
# 使用方法: ./start-dev.sh

echo "🚀 啟動開發環境..."
echo ""

# 啟動 Next.js 開發伺服器（背景執行）
echo "📦 啟動 Next.js 開發伺服器 (port 3000)..."
npm run dev &
DEV_PID=$!

# 等待 2 秒讓 dev server 啟動
sleep 2

# 啟動 Worker（背景執行）
echo "⚙️  啟動 Analysis Worker..."
npm run worker &
WORKER_PID=$!

echo ""
echo "✅ 開發環境已啟動！"
echo "   - Next.js: http://localhost:3000 (PID: $DEV_PID)"
echo "   - Worker: 背景運行中 (PID: $WORKER_PID)"
echo ""
echo "按 Ctrl+C 停止所有進程"
echo ""

# 等待任一進程結束
wait -n

# 清理：當一個進程結束時，終止另一個
echo ""
echo "🛑 停止所有進程..."
kill $DEV_PID 2>/dev/null
kill $WORKER_PID 2>/dev/null

echo "✅ 已停止"
