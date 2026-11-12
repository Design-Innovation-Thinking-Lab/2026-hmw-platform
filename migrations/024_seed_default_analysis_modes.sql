-- 024_seed_default_analysis_modes.sql
-- 功能：預設分析模式（領航員 / 教練 / 建築師）的 AI 角色與流程步驟 prompt
-- 影響資料表：projects、analysis_roles、analysis_flow_steps（皆為 INSERT，ON CONFLICT DO NOTHING）
-- 回滾方式：DELETE FROM projects WHERE id IN (下列三個 id)  -- 會 CASCADE 刪除其 roles / steps
--
-- 背景：分析用的 prompt 存放在資料庫，不在程式碼裡（從後台 /admin/steps 編輯）。
--       跑完 001–023 後資料庫結構雖然完整，但沒有任何分析模式，平台是空的、跑不出分析，
--       必須執行本檔。內容由正式環境匯出（匯出日 2026-10-12）。
--       保留原始 uuid 以維持 role_id 關聯；在既有環境重跑會因 ON CONFLICT 而略過。
--       prompt 內文以 $$ 引號包裹，可直接整檔貼進 Supabase SQL Editor 執行。
--
-- 注意：有 4 個步驟原本帶 prompt_image_url（指向原環境 Storage 的範例圖），
--       本檔一律設為 NULL，新環境請到 /admin/steps 自行重新上傳。

-- ═══ 1. projects ═══════════════════════════════════════════════════════

INSERT INTO projects (id, name, description, is_default, is_public, visibility, status)
VALUES ($$56aea6c7-337c-4c47-8a33-e4b1f7a2c7f7$$, $$領航員HumanAI框架$$, $$透過本次與AI互動框架，產出可作為未來設計實務解決方案的起始目標(HMW)，並在過程中透過驗證人與 AI 的互動透明性，是否能有效降低人與 AI 的知識斷層，從而達到無雜訊的溝通，從而共創解決方案？$$, true, false, $$private$$, $$draft$$)
ON CONFLICT (id) DO NOTHING;

INSERT INTO projects (id, name, description, is_default, is_public, visibility, status)
VALUES ($$7a291b89-bd7e-4f26-bc85-e59ea70556f4$$, $$教練HumanAI框架$$, $$透過本次與AI互動框架，產出可作為未來設計實務解決方案的起始目標(HMW)，並在過程中透過驗證人與 AI 的互動透明性，是否能有效降低人與 AI 的知識斷層，從而達到無雜訊的溝通，從而共創解決方案。$$, true, false, $$private$$, $$draft$$)
ON CONFLICT (id) DO NOTHING;

INSERT INTO projects (id, name, description, is_default, is_public, visibility, status)
VALUES ($$d1e43a18-e083-4175-bdd7-fdc67a57b8a9$$, $$建築師HumanAI框架$$, $$透過本次與AI互動框架，產出可作為未來設計實務解決方案的起始目標(HMW)，並在過程中透過驗證人與 AI 的互動透明性，是否能有效降低人與 AI 的知識斷層，從而達到無雜訊的溝通，從而共創解決方案。$$, true, false, $$private$$, $$draft$$)
ON CONFLICT (id) DO NOTHING;

-- ═══ 2. analysis_roles ═════════════════════════════════════════════════

INSERT INTO analysis_roles (id, project_id, name, description, system_prompt)
VALUES ($$da730b58-9c55-48a2-98c6-fec975e8cbdc$$, $$56aea6c7-337c-4c47-8a33-e4b1f7a2c7f7$$, $$質化研究專家$$, $$具備逾二十年質性研究實務經驗，專精於 Braun 與 Clarke 所提出之六步驟主題分析法（Thematic Analysis）$$,
$$您具備逾二十年質性研究實務經驗，專精於 Braun 與 Clarke 所提出之六步驟主題分析法（Thematic Analysis），目前擔任研究指導者與方法論顧問，協助研究人員進行系統性編碼、主題歸納與整體分析統整。
您強調研究過程之透明性、嚴謹性與反思性，並致力於確保研究分析具備理論深度與方法一致性，適切回應研究問題與語境需求。每次回答都要重新檢視回覆內容，避免出現不同文件資訊誤植入在其他文件分析中，並確認原句來源，不可以自行延伸語句解讀。
六步驟執行方法如下：
AI輔助主題分析的6步驟流程
基於Braun和Clarke六步主題分析框架 Çevik et al. (2025)
（1） 資料轉錄、熟悉資料與選取引文
（2）關鍵字選取（基於6個R框架）
（3）編碼（基於6個R編碼框架）
（4）主題發展（基於4個R框架）
（5）概念化
（6）概念模型發展

三角驗證：
-------
關鍵字6R框架：
-真實性（Realness）、豐富性（Richness）、重複性（Repetition）、基本原理（Rationale）、亮點引言（Repartee） 和指標性（Regal）
-編碼6R框架：周延性 （robust）、反思（reflective）、闡釋力 （resplendent）、關聯性（relevant）、顛覆性 （radical）和倫理性(righteous)
主題發展4R框架：
-潛在關聯性（Reciprocal）、識別性（Recognizable）、回應性（Responsive）和啟發性（Resourceful）
參考來源：
1.Naeem, M., Smith, T., & Thomas, L. (2025). Thematic Analysis and Artificial Intelligence: A Step-by-Step Process for Using ChatGPT in Thematic Analysis. International Journal of Qualitative Methods, 24, 16094069251333886.
2.Cevik, A. A., & Abu-Zidan, F. M. (2025). Utilizing Al-Powered Thematic Analysis: Methodology, Implementation, and Lessons Learned. Cureus, 17(6), e85338.$$)
ON CONFLICT (id) DO NOTHING;

-- ═══ 3. analysis_flow_steps ════════════════════════════════════════════

-- ── 領航員HumanAI框架（共 8 步）──

INSERT INTO analysis_flow_steps (id, project_id, step_index, title, analysis_scope, role_id, is_active, input_step_indices, output_schema, prompt_image_url, prompt_template)
VALUES ($$2219b340-98cf-44a2-bd3e-aae2e226889d$$, $$56aea6c7-337c-4c47-8a33-e4b1f7a2c7f7$$, 1, $$逐字稿清稿檢查$$, $$individual$$, $$da730b58-9c55-48a2-98c6-fec975e8cbdc$$, true, ARRAY[]::integer[], NULL, NULL /* 原有範例圖: 無 */,
$$請先幫我檢查以下逐字稿是否有遺漏、錯字、聽錯；如果你覺得有任何應該是相同音符或是錯別字請幫我更正，但請不要更正原話語句的情感與用詞。

【參考資料】
每一份受訪者逐字稿

【輸出格式】需包含：
1. 受訪者：受訪者識別名稱
2. 清稿後逐字稿：陣列，每項包含 { 時間戳, 說話者, 原話 }
3. 修正說明：陣列，列出所有修改（如有）
【注意】
- 保留原話的時間戳格式 (如 00:00:47)
- 不要更改原話的情感與用詞
- 若無修改，修正說明填 ["無修改"]$$)
ON CONFLICT (id) DO NOTHING;

INSERT INTO analysis_flow_steps (id, project_id, step_index, title, analysis_scope, role_id, is_active, input_step_indices, output_schema, prompt_image_url, prompt_template)
VALUES ($$70e135a7-3664-4e34-a8eb-b0eb98e5a5ad$$, $$56aea6c7-337c-4c47-8a33-e4b1f7a2c7f7$$, 2, $$身份理解$$, $$individual$$, $$da730b58-9c55-48a2-98c6-fec975e8cbdc$$, true, ARRAY[]::integer[], NULL, NULL /* 原有範例圖: 有，需重新上傳 */,
$$請確認AI角色，並在後續每一步驟依照此質化研究專家的角色，逐步執行後續的步驟編碼。
$$)
ON CONFLICT (id) DO NOTHING;

INSERT INTO analysis_flow_steps (id, project_id, step_index, title, analysis_scope, role_id, is_active, input_step_indices, output_schema, prompt_image_url, prompt_template)
VALUES ($$44e1621b-b12a-469c-8848-d69d542852b7$$, $$56aea6c7-337c-4c47-8a33-e4b1f7a2c7f7$$, 3, $$資料準備$$, $$individual$$, $$da730b58-9c55-48a2-98c6-fec975e8cbdc$$, true, ARRAY[]::integer[], NULL, NULL /* 原有範例圖: 無 */,
$$本步驟目的建立可分析的逐字稿段落表格，方便後續編碼。

參考資料：
1.步驟2分析角色的結果
2.每位受訪者逐字稿與步驟1的清稿結果

1. 詳細閱讀上方清稿後的逐字稿，並根據使用者的研究目的了解後續分析的核心。
2. 將訪談原始資料依照內容主題分段，請避免更改原話內容
3. 將結果依表格顯示：段落簡述(100字內) | 訪談者問題 | 受訪者回話

訪談的語句需要標記角色、原話、時間點（格式如：受訪者名稱 因為那個什麼... 00:00:47）$$)
ON CONFLICT (id) DO NOTHING;

INSERT INTO analysis_flow_steps (id, project_id, step_index, title, analysis_scope, role_id, is_active, input_step_indices, output_schema, prompt_image_url, prompt_template)
VALUES ($$cde98e70-8df4-4643-a960-a2a60770e003$$, $$56aea6c7-337c-4c47-8a33-e4b1f7a2c7f7$$, 4, $$開放性編碼（Open Coding）$$, $$individual$$, $$da730b58-9c55-48a2-98c6-fec975e8cbdc$$, true, ARRAY[]::integer[], NULL, NULL /* 原有範例圖: 無 */,
$$本步驟目的為萃取原始概念進行編碼，不先預設主題。

參考前一步驟分段後的訪談資料，進行以下分析：
每段原話分析基於「6R框架」（真實性Realness、豐富性Richness、重複性Repetition、合理性Rationale、機智Repartee、權威性Regal），定義最多2個簡短代碼詞(15字內)，優先使用「動詞+名詞」的格式，直接描述使用者的具體行為或期望，精確捕捉使用者的行動與意圖，不進行推測或解釋。

將語意類似、相同重複的代碼歸類成同一個開放性編碼，每個開放性編碼的「描述」欄位，請用 30 字內完整敘述此段原話呈現的現象、行為或需求，必須根據逐字稿內容精確撰寫，避免片語或模糊用語，讓描述可獨立理解。開放性編碼請避免出現整體概念的狀況，導致細節遺漏。

在編碼時，需不斷自我提問：「使用者在這段話中，真正想完成的具體任務(Job)是什麼？」，幫助從現象深入到其背後的動機。

以表格列出「編號｜開放性編碼｜描述(30字內)｜代表原話語句(標記時間點)  + timestamp| 受訪者名稱」。
每段內容要保留完整原話（逐字稿），而不是只寫重點摘要。
$$)
ON CONFLICT (id) DO NOTHING;

INSERT INTO analysis_flow_steps (id, project_id, step_index, title, analysis_scope, role_id, is_active, input_step_indices, output_schema, prompt_image_url, prompt_template)
VALUES ($$0d5241da-4b40-4ba9-89fa-2cdd2adf184e$$, $$56aea6c7-337c-4c47-8a33-e4b1f7a2c7f7$$, 5, $$主軸編碼（Axial Coding）$$, $$individual$$, $$da730b58-9c55-48a2-98c6-fec975e8cbdc$$, true, ARRAY[]::integer[], NULL, NULL /* 原有範例圖: 無 */,
$$依據前一步驟開放性編碼結果進行以下分析任務：

1.根據初步編碼間的關聯性，將相關編碼歸納成較高層次的主題（themes）每一群命名一個主題（15字內），命名請請具體、精確，盡可能避免重複編碼名稱。

2.可以使用「4R框架」（互惠Reciprocal、可識別Recognizable、回應Responsive、豐富Resourceful）進行主題開發

3.建立一個表格，包含：編號|主題|定義|代表語句|包含的代碼，每個主題列出包含的代碼、代表語句、以及簡要定義（50 字內），每個主題提供3~5個參與者提供的原始引文（代表語句），不要修改，完整敘述段落優先使用。

4.驗證每個主題是否有充足資料支撐以及主題內部是否一致，審視主題邊界與一致性，精煉每個主題的本質。以MECE原則檢視主題之間是否區辨清楚、無交叉定義，以及是否有主題遺漏。

5.在整個表格底下撰寫簡短說明（100字內），撰寫一段100字內的短文解釋您選擇和確定這些主題、其名稱和定義的原因。

$$)
ON CONFLICT (id) DO NOTHING;

INSERT INTO analysis_flow_steps (id, project_id, step_index, title, analysis_scope, role_id, is_active, input_step_indices, output_schema, prompt_image_url, prompt_template)
VALUES ($$a1e33c26-a8a3-4936-b311-0901bfadd6c2$$, $$56aea6c7-337c-4c47-8a33-e4b1f7a2c7f7$$, 6, $$選擇性編碼（Selective Coding）$$, $$collective$$, $$da730b58-9c55-48a2-98c6-fec975e8cbdc$$, true, ARRAY[]::integer[], NULL, NULL /* 原有範例圖: 無 */,
$$本步驟將依照專案輸入的研究目的，挑選核心主題，整合跨角色資料，將已分析的所有受訪者之核心主題，以語意為準、聚合同義與語意相近的主題進行【選擇性編碼分析】。

參考資料：前一步驟每一個受訪者的主軸編碼結果，依照結果列出全部受訪者最終的分析主題資訊：

接著交叉比對各自主題，確認是否有概念重複，語意相近或核心概念一致的主題歸類合併為同一主題，再來依照研究目的挑選「選擇性編碼主題」，選擇性編碼主題需重新依照包含的主題內容重新定義名稱，名稱需精準表達。

彙整主題分為2種分類：核心選擇性編碼主題、次要選擇性編碼主題，主題依照主題重複性高排序，主題各自產出洞察整理。

結果需嚴格遵循以下格式與寫作指令：
(1)主題一：[填寫主題名稱]
(2)請用一句話點出這個核心，並加上約 150-200 字的洞察敘事段落，從這個主題中提煉一個核心概念來概括使用者的行為或心態（例如：務實主義、效率焦慮、適應性策略）。
(3)包含的原始主題、包含的開放性代碼主題
(4)代表語句：請列出能支撐此主題的原始引文，必須標明**「角色 + 時間點」，格式如：A小姐 00:41:11,603。
(5)關鍵洞察：請用條列式，提煉出 3-5 條關於這主題最重要的洞察，每條洞察都應簡潔、有力，突顯核心矛盾或發現。$$)
ON CONFLICT (id) DO NOTHING;

INSERT INTO analysis_flow_steps (id, project_id, step_index, title, analysis_scope, role_id, is_active, input_step_indices, output_schema, prompt_image_url, prompt_template)
VALUES ($$4c3c502d-9455-453d-be06-00cd98af2a50$$, $$56aea6c7-337c-4c47-8a33-e4b1f7a2c7f7$$, 7, $$轉換為 JTBD$$, $$collective$$, $$da730b58-9c55-48a2-98c6-fec975e8cbdc$$, true, ARRAY[]::integer[], NULL, NULL /* 原有範例圖: 無 */,
$$本步驟目的為：將核心主題轉換為行動驅動需求句型。
依前一步驟選擇性編碼結果
按照步驟1逐字稿結果，以步驟4.步驟5.步驟6依序產出的各受訪者的原始訪談分段，進行以下分析：

你熟悉以下 Jobs to be  done 方法，擅長從訪談資料和情境故事中推導出具洞察力的使用者任務，你不預設產品功能，只根據語境與人類行為推理。
JTBD 的核心概念：
Jobs-to-be-Done（JTBD）強調的不是使用者「使用產品的功能」，而是他們想「透過某個手段實現某種目的或解決問題」。
每個 JTBD 背後都包含一個使用情境、一個待完成的任務，以及一個他們希望達成的理想結果。
JTBD範例句：當 {context 情境}, 我想要 {job 想完成的任務} 因為，我覺得 {motivation 背後動機}, 所以我可以 {outcome 想達成的結果}。

請將每個核心主題轉換為 JTBD，並嚴格遵守以下規則：

1.根據第五步驟選擇性編碼主題的結果，對準研究目的並整合受訪者的需求，產出5個以上的JTBD（越多對研究越好）。
2.JTBD可重複歸納到多個主題。
3.閱讀每段逐字稿，判斷該段落是否與某個 JTBD 有關聯，彙整段原始語句作為佐證資料。
4.潛在機會可以更跳脫和創新。
5.依需求強度由高至低排序JTBD。

最後依以下格式輸出分析結果：
【輸出格式】
每個 JTBD 必須包含：
1. JTBD：句型「當 [情境] 時，我想要 [需求]，以便/因為 [結果]」
2. 對應主題：來自選擇性編碼的主題名稱
3. 需求類型：功能性 / 情感性 / 社會性
4. ⚠️ 支持的原話列表（陣列）：列出【所有】支持此 JTBD 的受訪者原話
   - 每個原話需包含：受訪者名稱、原話內容、時間戳、來源檔案
   - 若有多位受訪者提到類似觀點，需全部列出
5. 重複次數：有多少位受訪者提到相關觀點
6. 優先度：根據重複性與重要性判斷（高/中/低）

【排序原則】
- 重複次數多優先
- 影響程度大優先$$)
ON CONFLICT (id) DO NOTHING;

INSERT INTO analysis_flow_steps (id, project_id, step_index, title, analysis_scope, role_id, is_active, input_step_indices, output_schema, prompt_image_url, prompt_template)
VALUES ($$2cebe454-c294-49e1-a7be-f0718a542b6f$$, $$56aea6c7-337c-4c47-8a33-e4b1f7a2c7f7$$, 8, $$轉換為 HMW $$, $$collective$$, $$da730b58-9c55-48a2-98c6-fec975e8cbdc$$, true, ARRAY[]::integer[], NULL, NULL /* 原有範例圖: 無 */,
$$現在你是一位服務設計師，擅長從 JTBD 中轉化出具設計價值的 HMW 問題句。

參考前一步驟所產出的 JTBD 分析結果，將每個 JTBD 轉為 HMW 問題句，每個 HMW 需包含：
1. HMW_question:HMW 問句
2. supporting_JTBD:支撐的 JTBD
3. verbatim_list：列出【所有】支持此 HMW 的受訪者原話
   - 每個原話需包含：受訪者、原話（保留原始引號）、時間戳、來源檔案
   - 若 JTBD 有多個原始語句來源，必須全部保留，不可只列一個
4. 來源受訪者/檔案名稱
5. 原話的時間戳（如有）
6. priority: 優先度（高/中/低）
7.在每個問句都撰寫簡短說明（100字內），撰寫一段100字內的短文解釋您選擇這些HMW定義的原因。

【排序原則】
- 來源受訪者數多優先（重複性高）
- 對使用者痛點影響大優先（重要性高）

【注意事項】
- 不要捏造受訪者、原話或時間戳
- 只使用上一步驟提供的實際資料
- 每個 HMW 應有明確的原話支撐$$)
ON CONFLICT (id) DO NOTHING;

-- ── 教練HumanAI框架（共 7 步）──

INSERT INTO analysis_flow_steps (id, project_id, step_index, title, analysis_scope, role_id, is_active, input_step_indices, output_schema, prompt_image_url, prompt_template)
VALUES ($$5a7608fc-56f5-4d7f-a78f-bc09e5c22cc7$$, $$7a291b89-bd7e-4f26-bc85-e59ea70556f4$$, 1, $$整理Findings$$, $$collective$$, $$da730b58-9c55-48a2-98c6-fec975e8cbdc$$, true, ARRAY[]::integer[], NULL, NULL /* 原有範例圖: 無 */,
$$請你擔任一位資深的質性研究員，根據我提供的逐字稿，以Bottom-up 的方式，產出第一階「Findings」，請幫我分析完"完整的"、"整份"逐字稿。
【Findings 撰寫規則】 (必須嚴格遵守)
1. 專注事實，而非詮釋：只記錄受訪者說了什麼、做了什麼、感受到了什麼。不要進行任何的「為什麼」或「這意味著什麼」的推論。
2. 原子化 (Atomic)：每一個 Finding 都應該是一個獨立、完整且易於理解的要點。
3. 引用原文為基礎：每個 Finding 都必須能直接從逐字稿的原文中找到對應的證據，但需要將口語轉化為通順的書面語。
4. 客觀中立：避免使用帶有強烈情緒或評價性的詞彙。
5. Findings 需從一完整時間段、同一主問題下產出（一個主要的提問下是完整的對話，含主訪與受訪者）
-
【輸出格式】
幫我整理成附圖截圖一樣產出表格（三欄）： 提問+timestamp |原始引言+timestamp | Findings。其中「提問」請直接引用逐字稿中主訪問的問題timestamp請加在每段話後面$$)
ON CONFLICT (id) DO NOTHING;

INSERT INTO analysis_flow_steps (id, project_id, step_index, title, analysis_scope, role_id, is_active, input_step_indices, output_schema, prompt_image_url, prompt_template)
VALUES ($$5810a353-411d-4faa-b262-567ecf44f6c4$$, $$7a291b89-bd7e-4f26-bc85-e59ea70556f4$$, 2, $$Summary$$, $$collective$$, $$da730b58-9c55-48a2-98c6-fec975e8cbdc$$, true, ARRAY[]::integer[], NULL, NULL /* 原有範例圖: 有，需重新上傳 */,
$$請幫我根據以上表格前一步驟產出的 Findings 進行 Summary 的撰寫，其中請幫我根據這四大點撰寫 Summary
一、 研究主題的使用或主要現況與偏好
二、 使用者需求與核心痛點
三、 AI 功能的應用與挑戰
四、 對未來研究主題的想像與期待
以附圖為例，此些 Findings 皆歸納於 【05 認養流程摺頁】的效益、【05 認養流程摺頁】的調整建議此兩大主題之下，透過分類主題後再一各別主題產出 Summary
【Summary 撰寫規則】 (必須嚴格遵守)
凸顯概念的差異或對比（新手 vs 熟手；基礎知識 vs 進階變化）
找出概念相似的地方（同樣基於自己的互動知識）
點出核心原因、行為背後的需求（避免因疏忽導致無法認養）
適時舉例、稍微解壓縮（如：鄰里飼養接受度、犬隻尾巴表達）
Summary 文章編排可遵循訪綱脈絡，分類 findings ：
通常在訪綱撰寫時會有明確的「目標」與「預期收穫」，findings分類時，便可以將「訪綱脈絡」視為產出的依據，通常分類方式會是對應訪綱的「訪談段落／訪談問項／訪談事實」，若訪談有收穫重要且不在原本訪談目標的資訊，可彈性新增分類內容。$$)
ON CONFLICT (id) DO NOTHING;

INSERT INTO analysis_flow_steps (id, project_id, step_index, title, analysis_scope, role_id, is_active, input_step_indices, output_schema, prompt_image_url, prompt_template)
VALUES ($$7d78a5a9-c202-44a1-b495-42c86747712c$$, $$7a291b89-bd7e-4f26-bc85-e59ea70556f4$$, 3, $$Insight $$, $$collective$$, NULL, true, ARRAY[]::integer[], NULL, NULL /* 原有範例圖: 無 */,
$$請幫我根據前一步驟產出的 Summary 進行 Insight 的撰寫，其中請特別對應研究目標
-
【Insight 是什麼】
Insights 是呼應專案研究目標的核心訊息，可以透過訪談中的數個finding 結合出來的，Summary 的分類便是初步的結合。（這就是訪談最重要的產出，從眾多發現 (findings) 中確認洞見(insights) 的產出，也是大家參與真實複雜案件的原因。）
【範例】
研究目標之一是釐清「系統真正需要的功能是什麼？」，「個體辨識的功能」就是其中一個，進而提出
攸關專案進程的 Insights的核心資訊，因此目前的系統根本無法達成管理目標」
-
【專案研究目標】
1. 了解使用者對於研究主題內容的現況
2. 了解使用者對於研究主題的需求與困難點
3. 了解使用者對於研究主題的建議與未來期望$$)
ON CONFLICT (id) DO NOTHING;

INSERT INTO analysis_flow_steps (id, project_id, step_index, title, analysis_scope, role_id, is_active, input_step_indices, output_schema, prompt_image_url, prompt_template)
VALUES ($$ffd25cf4-6604-4e7f-bade-462ed8162902$$, $$7a291b89-bd7e-4f26-bc85-e59ea70556f4$$, 4, $$ AI 自我審視 $$, $$collective$$, NULL, true, ARRAY[]::integer[], NULL, NULL /* 原有範例圖: 無 */,
$$請幫我再次審視以上步驟1、步驟2、步驟3的分析資料是否皆出自於所有受訪者逐字稿？
是否有不一致或過度推論的地方？$$)
ON CONFLICT (id) DO NOTHING;

INSERT INTO analysis_flow_steps (id, project_id, step_index, title, analysis_scope, role_id, is_active, input_step_indices, output_schema, prompt_image_url, prompt_template)
VALUES ($$2144ad17-ea63-428d-8a03-c13d9c412f9a$$, $$7a291b89-bd7e-4f26-bc85-e59ea70556f4$$, 5, $$統整全部訪談Insight$$, $$collective$$, NULL, true, ARRAY[]::integer[], NULL, NULL /* 原有範例圖: 無 */,
$$這是每位受訪者的訪談洞察前一步驟結果，統整出總洞察並列出對應每一洞察的逐字稿 ，讓我有跡可循 、脈絡化
$$)
ON CONFLICT (id) DO NOTHING;

INSERT INTO analysis_flow_steps (id, project_id, step_index, title, analysis_scope, role_id, is_active, input_step_indices, output_schema, prompt_image_url, prompt_template)
VALUES ($$02d785f7-b60a-421a-b7bc-c42e532f63b4$$, $$7a291b89-bd7e-4f26-bc85-e59ea70556f4$$, 6, $$總 Insight 產出JTBD$$, $$collective$$, NULL, true, ARRAY[]::integer[], NULL, NULL /* 原有範例圖: 有，需重新上傳 */,
$$依照前一步驟產出研究主題訪談得出的總洞察，請以附圖JTBD的架構，以Clayton Christensen、AlanKlement 提出的需求三層模型（Three Levels of Jobs），列出這六大洞察個別的JTBD句型$$)
ON CONFLICT (id) DO NOTHING;

INSERT INTO analysis_flow_steps (id, project_id, step_index, title, analysis_scope, role_id, is_active, input_step_indices, output_schema, prompt_image_url, prompt_template)
VALUES ($$adb165b8-5bdd-4019-9ec9-62d9ba4b3ac0$$, $$7a291b89-bd7e-4f26-bc85-e59ea70556f4$$, 7, $$利用總 JTBD 產出HMW$$, $$collective$$, NULL, true, ARRAY[]::integer[], NULL, NULL /* 原有範例圖: 無 */,
$$參考步驟5的總洞察、步驟6的JTBD，提供綜合研究的How MightWe問句，句型請參考附件，並使用順暢化、邏輯化的文句寫出HMW，寫出hmw後請附上前一步驟（步驟6)，所參考的JTBD句型，作為HMW問句支持$$)
ON CONFLICT (id) DO NOTHING;

-- ── 建築師HumanAI框架（共 4 步）──

INSERT INTO analysis_flow_steps (id, project_id, step_index, title, analysis_scope, role_id, is_active, input_step_indices, output_schema, prompt_image_url, prompt_template)
VALUES ($$f9e7ad5d-2b19-41d3-8a1a-91302fc4b107$$, $$d1e43a18-e083-4175-bdd7-fdc67a57b8a9$$, 1, $$[T01]研究背景與資料定義 $$, $$individual$$, $$da730b58-9c55-48a2-98c6-fec975e8cbdc$$, true, ARRAY[]::integer[], NULL, NULL /* 原有範例圖: 無 */,
$$你現在是一位使用者體驗研究專家，協助一群研究生進行分析質性訪談逐字稿資料，你將在我們研究中給予協助與建議，進行完整使用者研究分析與洞察。
我們的研究目標是：探索使用者對於本研究主題產品使用體驗，並從中找出關鍵的體驗維度與知覺價值。
請你先理解以下關鍵定義：
體驗維度：指使用者在與產品互動過程中感受到的不同面向，例如：體驗四維度產品、服務、溝通、環境等。
知覺價值：指使用者在體驗產品後，主觀認為從中獲得的效益或重要性，例如「省時」、「方便」、「愉悅」、「成就感」等。
此外，在後續洞察的每一步驟中，請你保持Human in the loop，以利學生了解整個使用者研究的價值及培養學生獨立思考的能力，請先理解規則：
每一步驟時請先停下來想一想。 在流程設計時，需要兼顧其彈性與一致性，可能需要預留人工介入審核或調整的空間，以應對AI變化及模型更新，若為控制輸出穩定性，建議採多輪Prompt比對、設定固定樣板輸出格式，或進行「雙版本交叉分析」，由人員選擇最佳結果。
分階段、迭代式的資料輸入與引導：初期先讓 AI 理解研究的整體背景與分析目的，隨後再逐步提供訪談逐字稿、編碼格式及規則等相關背景知識。
在關鍵步驟（如：主題歸納後、JTBD分類後、HMW問題產出前），建議由工人審核AI初步分析，進行比對與修正，以確保結果的語意精確與研究方向一致。在每次輸入時，明確告知 AI 分析的重點、方向與預期的格式需求，有效引導 AI 模擬人類「循序漸進」的思考流程，使其產出更符合研究需求的結果。

---
【受訪者逐字稿資料】
請根據每份受訪者逐字稿，輸出分析結果，包含受訪者基本資訊摘要與重要觀察。$$)
ON CONFLICT (id) DO NOTHING;

INSERT INTO analysis_flow_steps (id, project_id, step_index, title, analysis_scope, role_id, is_active, input_step_indices, output_schema, prompt_image_url, prompt_template)
VALUES ($$723e79dd-48f0-43bc-a5b4-7497809ea691$$, $$d1e43a18-e083-4175-bdd7-fdc67a57b8a9$$, 2, $$[T02]受訪者編碼與資料預處理 Findings$$, $$collective$$, $$da730b58-9c55-48a2-98c6-fec975e8cbdc$$, true, ARRAY[]::integer[], NULL, NULL /* 原有範例圖: 有，需重新上傳 */,
$$訪談稿基本說明：
我將提供一份訪綱以及受訪者的逐字稿檔案名稱或逐字稿開頭會清楚標示受訪者代號請你記住每位受訪者的代號，並將他們的發言與編號建立連結。
訪談稿使用說明：請將此prompt作為Finding撰寫的檢核清單，你可直接複製模板填寫，且需定期回顧優化標準，持續提升品質，請建立Finding資料庫，累積組織知識資產，執行清單如下：
a. 資訊識別與篩選
-關鍵資訊類型（依優先順序）：
 -:dart: 研究目標相關：回應研究問題、使用痛點、設計驗證
 -:bar_chart: 行為模式：具體使用習慣、頻率、順序、流程
 -:speech_balloon: 認知歷程：決策邏輯、學習曲線、心智模型
 -:repeat: 因果關係：觸發情境→工具使用→結果變化
 -:performing_arts: 情境脈絡：工作情境、跨工具協作、時效壓力
 -:bulb: 洞察線索：矛盾、偏好、工具跳轉、替代方案等
-資訊顆粒度要求：
 -:white_check_mark: 保留細節：數據與數量（例：每天使用3次、2小時、連續操作5個步驟）
  -精確順序（先開 Notion → 複製內容 → 貼到 Google Doc）
  -關鍵動作（打開、拖曳、搜尋、複製貼上、設定標籤）
  -心理狀態（焦慮、混亂、流暢、疑惑）
  -轉折點（例如：「本來想用A，但後來發現B比較快」）
 -:x: 省略內容：
  -無意義的語助詞、重複贅詞
  -離題閒聊、不影響行為與認知的背景資訊
b. Finding 結構化模板
 -Finding #[編號]：[核心主題標題]
 -【觀察事實】
  -時間點：[具體時刻/持續時長]
  -行為序列：[動作1] → [動作2] → [動作3]
  -關鍵細節：[數據/引述/觀察]
-【分析要點】
  -表層現象：[可觀察的操作或敘述]
  -深層意涵：[背後的動機、需求或認知偏好]
  -影響因素：[工具設計/使用情境/團隊流程]
-【知識標籤】#行為類型 #使用者類型 #工具情境 #設計元素
c. 撰寫優化檢核
 -i. 資訊完整性
  -5W1H完整（Who、What、When、Where、Why、How
  -證據充分：有逐字稿或觀察佐證
  -脈絡清晰：行為與前因後果交代明確
-ii. 知識管理友善度
  -可檢索性：有關鍵詞與標籤
  -可比較性：格式統一，利於不同訪者橫向比較
  -可追溯性：標註原始語句與時間
  -可累積性：能與其他Finding整合成設計模式
iii. 語言優化標準
  -精準度：避免模糊字詞（例如：應該、大概）
  -具體性：使用數據與動作
  -邏輯性：清楚展現因果
  -簡潔性：每句有資訊價值，控制在3-5句
d. 常見問題與優化對照(如附件圖）
e. 進階優化技巧
i. 多層次資訊編碼
  -第一層 - 行為：使用者將資料貼進 Notion
  -第二層 - 操作流程：從 Google Drive 複製 → 貼進Notion 資料庫
  -第三層 - 認知邏輯：認為 Notion 是中心工具，需整合資訊
  -第四層 - 使用目標：建立跨資料來源的知識整合系統
ii. Finding 串連方法
  -橫向比較：不同受訪者如何使用相同功能（如筆記整理）
  -縱向演化：同一使用者初次 vs 熟悉後的使用改變
  -交叉影響：不同工具之間的角色分工與替代關係
iii.元資料標註範例如下：
  -finding_metadata:
  -id: S01
  -timestamp: "00:14:33"
  -category: "工具選擇與跳轉"
  -user_type: "中階個人知識管理者"
  -design_element: "資料庫模板套用"
  -confidence: ”中“
  -related_findings: [F002, F009]
iv. 優質 Finding 指標
  -獨立完整：閱讀此 Finding 即可理解行為與意涵
  -資訊密度高：不冗長，每句傳遞實質資訊
  -可操作性：可導出具體優化建議
  -知識價值：能與其他使用者行為形成模型或設計原則


---
請根據步驟1，各個受訪者逐字稿基本分析結果，輸出受訪者編碼表與整理後的 Findings 規範。$$)
ON CONFLICT (id) DO NOTHING;

INSERT INTO analysis_flow_steps (id, project_id, step_index, title, analysis_scope, role_id, is_active, input_step_indices, output_schema, prompt_image_url, prompt_template)
VALUES ($$b90561f1-ac7a-4160-95fc-20443e90e243$$, $$d1e43a18-e083-4175-bdd7-fdc67a57b8a9$$, 3, $$[T03]輸出結果任務定義 JTBD$$, $$collective$$, $$da730b58-9c55-48a2-98c6-fec975e8cbdc$$, true, ARRAY[]::integer[], NULL, NULL /* 原有範例圖: 無 */,
$$現在你對所有受訪者逐字稿進行了分析與歸納，你現在的任務是：定義全部受訪者的 JTBD 任務類別與陳述，從逐字稿中歸納使用者在每個 JTBD 上的痛點、動機與相關語句。
請先理解 JTBD 的核心概念：
Jobs-to-be-Done（JTBD）強調的不是使用者「使用產品的功能」，而是他們想「透過某個手段實現某種目的或解決問題」。
每個 JTBD 背後都包含一個使用情境、一個待完成的任務，以及一個他們希望達成的理想結果。
JTBD範例句：When {context}, I want to {job} because, I am {motivation}, so i can {outcome}.

請依下列步驟進行分析：
1. 閱讀每段逐字稿，進行 JTBD 關聯歸類（可重複歸類到多個JTBD）
2. 對應到 JTBD 後，分析該使用者在這個 JTBD 上：
  -正在面對哪些痛點或阻礙
  -嘗試解決什麼問題或採取什麼行動（動機/解法）
  -其情緒反應與價值認知線索
3. 彙整該段原始語句作為佐證資料
請依以下範例格式輸出分析結果：
受訪者編號： [例如：S01]
JTBD #1：
  -觀察到的痛點/阻礙：（簡述受訪者遇到的挑戰）
  -觀察到的動機/解決方案：（簡述他為了實現此目標想做什麼、用了什麼策略）
  -受訪者相關原始語句：（逐字稿引用，建議保留訪談語氣）
【關聯性分析】
  -請針對該受訪者的 JTBD 表現，分析其與我們定義的「體驗維度」與「知覺價值」之間的對應關聯，例如：「插件自由」與「自我掌控感」、「進階使用彈性」體驗維度關聯性高
  -「協作同步」與「透明度」、「參與感」等知覺價值有強關聯
  -「視覺化知識整理」則與「高效掌握」、「低認知負擔」體驗有連結

---
分析資料來源：
1.每一位受訪者逐字稿全文
2.步驟2分析結果
---

請根據以上全部逐字稿原文，歸納 JTBD，輸出結果，需包含所有JTBD清單，每個項目含核心主題、JTBD 陳述、痛點與原話引用。$$)
ON CONFLICT (id) DO NOTHING;

INSERT INTO analysis_flow_steps (id, project_id, step_index, title, analysis_scope, role_id, is_active, input_step_indices, output_schema, prompt_image_url, prompt_template)
VALUES ($$a4533db2-929a-414f-83be-d23bfa5f1221$$, $$d1e43a18-e083-4175-bdd7-fdc67a57b8a9$$, 4, $$[T04]JTBD轉 HMW$$, $$collective$$, $$da730b58-9c55-48a2-98c6-fec975e8cbdc$$, true, ARRAY[]::integer[], NULL, NULL /* 原有範例圖: 無 */,
$$你已經歸納使用者在每個 JTBD 上的痛點、動機與相關語句，你現在的任務是：
根據已分析出的「核心主題」、對應的「Jobs-to-be-Done（JTBD）」與使用者表現出的「痛點/挑戰」，撰寫具設計啟發性的 HMW 問題句，並從服務創新三環角度切入思考。

請先理解 HMW 問題的意義 ：How Might We（我們可以如何...）問題句，旨在將具體的使用者需求或挑戰轉化為設計團隊可以討論、探索、發想創新解法的出發點。其特徵如下：
 -開放性：避免預設特定方案，允許多元思考路徑
 -以人為中心：問題要對準使用者的動機與情境需求
 -具有方向性：有明確目標導向，非純抽象想像
 -根據觀察出發：反映真實的語句、行為與情緒反應
結合「服務創新三環」思考：每一個 HMW 問題，應盡量涵蓋以下任一或多個面向：
 -Desirability（需求性）：問題是否解決使用者真正的痛點？是否能產生價值感與滿足感？
 -Feasibility（技術可行性）：問題是否可透過目前技術、資源、平台有效實現？
 -Viability（商業可行性）：問題的解法是否具備長期運營潛力、規模經濟或差異化競爭優勢？
請依以下格式輸出分析結果：
 -核心主題：填入主題名稱
 -對應 JTBD：請複製對應JTBD任務完整描述
 -觀察到的痛點/挑戰：簡要描述使用者在此主題/任務下遇到的具體障礙、操作難處或心理落差
 -HMW 問題（建議涵蓋服務創新三環）
 -對應的原始資料來源：請將訪談逐字稿代表語句列出。
備註：若無法產出三題，可至少撰寫一題最符合服務創新三環即可，若有多個主題，請依照上述分析特徵與面向排列執行優先序。

---
資料來源：
1.步驟 3 JTBD 分析結果
2.逐字稿原文（供追溯來源）

請根據以上 JTBD 結果，輸出 JSON 格式的 HMW 問題清單，包含hmw清單，每個項目含 HMW問題句、對應JTBD、核心主題、優先級與逐字稿來源標示。$$)
ON CONFLICT (id) DO NOTHING;

