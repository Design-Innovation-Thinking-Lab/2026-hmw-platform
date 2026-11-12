-- 023_hmw_votes_vote_type.sql
-- 功能：hmw_votes.vote_type — 區分投票類型
-- 影響資料表：hmw_votes（欄位新增）
-- 回滾方式：ALTER TABLE hmw_votes DROP COLUMN IF EXISTS vote_type;
--
-- 背景：此欄位在正式環境已存在，供尚未發布的功能使用
--       （將投票分為 like / adopt / reject 三種）。
--       本分支的程式碼只用預設的按讚邏輯，不會讀寫這個欄位。
--       建立它是為了讓你的環境與正式環境結構一致，將來拉新功能時不必再補。

ALTER TABLE hmw_votes
  ADD COLUMN IF NOT EXISTS vote_type text;
