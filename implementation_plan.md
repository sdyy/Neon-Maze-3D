# 3D 迷宮遊戲設計與實作計畫

本專案旨在開發一個基於 Web 的 3D 迷宮遊戲。玩家將在 3D 空間中導航，從起點（入口）走到終點（出口）。為了解決 3D 空間中視覺重疊、迷失方向與難度過高的問題，我們將實作多種創新的輔助功能，如**切片檢視 (Slicing)**、**透視模式 (X-Ray)**、**路徑追蹤 (Path Tracking)** 與 **導航路徑提示 (A* 尋路)**。

---

## 使用者審查項目
> [!IMPORTANT]
> 1. **難度評估 (9x9x9 至 27x27x27)**: 
>    - $9 \times 9 \times 9 = 729$ 格，難度適中，適合一般遊玩。
>    - $15 \times 15 \times 15 = 3,375$ 格，非常具有挑戰性。
>    - $27 \times 27 \times 27 = 19,683$ 格，在純 3D 視角下幾乎不可能盲走通關。
>    - **解決方案**: 預設啟用「自動切片追蹤 (Auto-Slice)」功能。在此模式下，系統會將 3D 迷宮切為 2D 剖面，並隨玩家移動自動上下/前後滑動，這使得 $27 \times 27 \times 27$ 也能以「多層 2D 迷宮」的形式趣味遊玩。
> 2. **控制方案**:
>    - **鍵盤控制**: 採用絕對軸向控制（`W`/`S` 前後，`A`/`D` 左右，`Space`/`Shift` 或 `Q`/`E` 上下）。
>    - **3D 羅盤 (HUD)**: 畫面中會顯示 3D 座標軸（X: 紅, Y: 綠, Z: 藍）和按鍵提示，確保玩家能輕易對照當前視角與按鍵方向。
> 3. **通知**: 
>    - 當建置/測試完成或需要玩家審查時，將呼叫 Teams 通知腳本通知您。

---

## 開發技術棧與設計美學

### 技術棧
1. **Core**: HTML5 + Vanilla Javascript (ES Modules).
2. **Styling**: Vanilla CSS (CSS Variables, Glassmorphism, Neon styles).
3. **3D Engine**: Three.js (使用 CDN 引進，無需繁複的 bundler 配置，確保即時運行與最輕量化）。
4. **Dev Server**: Vite (用於本地極速熱重載開發與預覽)。

### 設計美學 (Cyberpunk / Neon Sci-Fi)
- **深色科技風**: 背景為深邃黑色，搭配極簡暗色漸層。
- **全息投影迷宮**: 
  - 牆面採用半透明玻璃質感 (Glassmorphism)，並有霓虹邊框。
  - 未激活的區域以超低透明度 (e.g. 0.05) 的「幽靈網格」呈現，展現 3D 迷宮的輪廓。
  - 當前切片層則以亮色高透光顯示。
- **玩家與終點**: 
  - 玩家為綠色發光球體，並自帶點光源照亮周圍牆壁。
  - 起點為藍色光球，終點為金色/橙色光球。
- **路徑追蹤**: 
  - **已探索路徑**：紫色霓虹光條。
  - **當前路徑（起點到玩家的無環路徑）**：粉紅色/紅色高亮光條。
  - **提示路徑 (A* 求解)**：綠色虛線路徑。

---

## 提案修改內容

本專案將建立在 `C:/Users/10110012/Documents/antigravity/resilient-hubble` 工作區中。

### 檔案結構

```
resilient-hubble/
├── index.html            # 網頁入口與 UI 結構
├── style.css             # Glassmorphism UI 與霓虹風格樣式
├── main.js               # 遊戲 initialization 與主循環
├── src/
│   ├── maze.js           # 3D 迷宮生成演算法 (DFS) 與 A* 尋路演算法
│   ├── renderer.js       # Three.js 3D 渲染與相機、燈光、材質管理
│   └── ui.js             # UI 控制、滑桿、按鍵綁定與 HUD
├── package.json          # Vite 配置與相依性定義
└── vite.config.js        # Vite 設定
```

---

### [Component Name] 實作細節

#### [NEW] [package.json](file:///C:/Users/10110012/Documents/antigravity/resilient-hubble/package.json)
設定專案相依性，包含 `vite` 開發伺服器，以及 `three` 套件（或直接使用 ES Modules CDN，我們可透過 `package.json` 安裝 local three 以便支援 IDE 自動完成與離線打包，Vite 會自動打包）。

#### [NEW] [vite.config.js](file:///C:/Users/10110012/Documents/antigravity/resilient-hubble/vite.config.js)
基本 Vite 設定檔。

#### [NEW] [index.html](file:///C:/Users/10110012/Documents/antigravity/resilient-hubble/index.html)
- 3D Canvas 容器。
- 側邊控制面版 (Glassmorphism Panel)：
  - 難度選擇器（3x3x3, 5x5x5, 9x9x9, 15x15x15, 27x27x27）。
  - 視圖設定：透視度 (X-Ray Opacity)、切片模式（無/X/Y/Z）、自動追蹤玩家。
  - 提示開關：顯示走過的路徑、顯示 A* 最短路徑。
  - 狀態顯示：計時器、移動步數、當前坐標、剩餘距離。
  - 操作說明與按鍵指南。

#### [NEW] [style.css](file:///C:/Users/10110012/Documents/antigravity/resilient-hubble/style.css)
- 現代字型（Google Fonts - Orbitron 或 Inter）。
- 磨砂玻璃 (backdrop-filter) UI 面板。
- 霓虹陰影與按鈕懸停動畫。
- 響應式佈局，確保 3D 畫布佔滿螢幕，UI 面板浮動於上方。

#### [NEW] [src/maze.js](file:///C:/Users/10110012/Documents/antigravity/resilient-hubble/src/maze.js)
- `Maze3D` 類別：
  - `generate(width, height, depth)`: 採用 3D 隨機 DFS（深度優先搜尋）演算法生成迷宮。
  - 每個 Cell 包含 6 個方向的牆壁狀態。
  - `solve(start, end)`: 實作 A* 演算法，計算當前位置到終點的最短路徑，並傳回節點列表。
  - `checkWall(x, y, z, direction)`: 檢查特定方向是否有牆壁，以便玩家移動碰壁檢測。

#### [NEW] [src/renderer.js](file:///C:/Users/10110012/Documents/antigravity/resilient-hubble/src/renderer.js)
- 初始化 `THREE.WebGLRenderer`, `THREE.PerspectiveCamera`, `THREE.Scene`。
- 使用 `OrbitControls` 允許玩家旋轉、縮放與平移迷宮。
- 繪製迷宮牆面：
  - **效能優化**：不為每個牆面單獨創建 Mesh，而是使用單個合併的 `BufferGeometry` 來繪製所有牆壁的面，以及一個 `LineSegments` 繪製牆壁的霓虹邊緣。
  - **切片渲染 (Slicing)**：根據 UI 設定的切片參數，動態更新 Geometry，只渲染符合切片範圍的牆壁。未在切片內的牆壁以超高透明度網格或不渲染呈現。
- 繪製玩家、起點、終點：
  - 玩家：綠色發光球體，附帶 PointLight。
  - 終點：金黃色發光球體，附帶 PointLight。
  - 起點：藍色發光球體。
- 繪製軌跡：
  - 根據玩家走過的歷史坐標，動態更新線條幾何體 (Line)。
  - `visitedPathMesh`：紫色，代表曾探索過但已回頭的路徑。
  - `activePathMesh`：粉紅色，代表起點至玩家目前的無環路徑。
  - `hintPathMesh`：綠色虛線，代表 A* 最短路徑。

#### [NEW] [src/ui.js](file:///C:/Users/10110012/Documents/antigravity/resilient-hubble/src/ui.js)
- 監聽鍵盤事件並將其映射至玩家移動（呼叫 `renderer.movePlayer(dx, dy, dz)`）。
- 監聽 UI 控制項（難度、切片、透視、提示）。
- 更新 HUD（時間、計時器、步數、坐標）。
- 按鍵說明與 compass 對齊。

#### [NEW] [main.js](file:///C:/Users/10110012/Documents/antigravity/resilient-hubble/main.js)
- 遊戲主入口。
- 初始化迷宮、渲染器與 UI 控制。
- 協調遊戲重新開始、通關動畫與重置邏輯。

---

## 驗證計畫

### 自動化與建置驗證
1. 執行 `npm run build` 確認 Vite 編譯無誤。
2. 開啟瀏覽器確認載入無 JavaScript 報錯。

### 手動驗證步驟
1. 啟動本地開發伺服器 `npm run dev`。
2. 測試 3x3x3 迷宮：
   - 驗證鍵盤控制：按 WASD、Space、Shift 能否正確移動，且不會穿牆。
   - 驗證走到終點後是否會觸發通關畫面。
3. 測試切片功能 (Slice Mode)：
   - 切換 Y 切片，移動玩家向上或向下，驗證切片是否自動跟隨玩家移動。
   - 調整手動切片滑桿，驗證其他樓層是否能單獨顯示或隱藏。
4. 測試透視度 (X-Ray)：
   - 調整 X-Ray 透明度，確認外圍牆壁的透明度能隨之變化。
5. 測試路徑與提示：
   - 沿著迷宮走一段路，然後倒退，驗證「已探索路徑」與「當前路徑」是否呈現不同顏色。
   - 開啟「A* 提示路徑」，驗證綠色虛線是否能正確指出到達終點的路線，並隨玩家移動即時縮短。
6. 測試 $27 \times 27 \times 27$ 迷宮：
   - 觀察生成速度（確保在 200ms 內完成生成與渲染）。
   - 觀察幀率（FPS）是否穩定維持在 60 FPS 以上（主要驗證 BufferGeometry 合併效能）。
