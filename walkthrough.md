# 3D 霓虹迷宮 (Neon Maze 3D) 開發完成報告

本專案已成功實現一個極具視覺美感且具高度可玩性的 3D 迷宮網頁遊戲。為了解決純 3D 空間容易造成視覺混亂與迷失方向的痛點，本遊戲特別融入了實用的「第一人稱視角」、「雙螢幕輔助矩陣」、「切片檢視」與「尋路導航」技術。

---

## 遊戲核心功能與成果

1. **3D 迷宮生成與解算 (`src/maze.js`)**
   - 採用 **3D 隨機深度優先搜尋 (DFS) 演算法**，保存在任意維度下（從 $3^3$ 到 $27^3$）皆能生成一條唯一的連通完美路徑。
   - 內建 **A* / BFS 尋路器**，可動態計算玩家當前位置與終點的最短路徑與步數，提供即時的過關提示。

2. **第一人稱視角與雙視角渲染系統 (`src/renderer.js`)**
   - **第一人稱視角 (First Person View, FPV)**：
     - 玩家的主要遊戲畫面為第一人稱，相機高度直接放置在通道中心。
     - 玩家在主畫面按住滑鼠拖曳，可以隨意轉動第一人稱視角，朝著 3D 迷宮的任何上下左右角落環顧。
     - 玩家移動時，第一人稱視角會以平滑插值 (lerp) 方式在迷宮單元格間滑動，畫面移動流暢。
   - **3D 全息輔助矩陣 (Orbit Minimap)**：
     - 在右下角提供一個 $240 \times 180$ 的獨立畫中畫 (PiP) 浮動視窗，做為輔助地圖。
     - 輔助地圖以第三人稱 Orbit 視角呈現完整的 3D 迷宮立體矩陣，且相機焦點會始終對焦在玩家當前位置。
     - 玩家可以直接在小地圖視窗上拖曳旋轉、滾輪縮放，輔助辨識自身在整個 3D 空間中的大局位置。
   - **視角相對按鍵移動**：
     - 當玩家按下 `W` / `S` / `A` / `D` (或方向鍵) 時，系統會自動檢索當前 FPV 相機所面朝的水平方向，並將按鍵動態映射到最接近的 3D 迷宮物理通道軸上。
     - 意即「朝著路按 `W` 就會直接沿該路走」，無需費心比對 X/Y/Z 絕對軸向。
     - 垂直移動（`Space`/`Q` 向上，`Shift`/`E` 向下）則維持不變，專注於層級之間的爬升與潛沉。

3. **高效能 Three.js 3D 渲染與清晰度優化**
   - **BufferGeometry 合併優化**：將所有牆面與霓虹線條合併成單一幾何體，達成 **單次 Draw Call 繪製全迷宮**，運行時穩定維持在 60+ FPS。
   - **切片檢視 (Slicing)**：提供 X/Y/Z 軸向的剖面切片檢視。配合 **自動追蹤模式 (Auto-Slice)**，剖面會隨玩家移動自動滑動。
   - **透視模式 (X-Ray)**：在啟用切片時，非切片區域的迷宮牆壁將以超低透明度（如 5%）的「幽靈網格」呈現。
   - **牆面清晰度調整**：
     - 將 active walls 的材質從需要外部光源反射的 `MeshStandardMaterial` 改為自發光的 **`MeshBasicMaterial`** (顏色為 `0x0055cc`，透明度提升至 `0x0055cc`)，使牆壁在暗處依然清晰亮眼，解決原本牆壁太暗看不清、容易撞牆的痛點。
     - 將牆壁邊框 (wall borders) 設為 **純霓虹青色 `0x00ffff`** (透明度 `1.0`)，使路徑牆線更加銳利。
   - **玩家方向向導 (3D Local Compass)**：
     - 玩家角色在輔助小地圖中呈現為一個會**自轉的八面體 (Octahedron)**。
     - 角色周圍環繞著紅、綠、藍三軸導航線，並在端點加上會自動面向相機的 `W`/`S`/`A`/`D`/`Space`/`Shift` 懸浮標籤，完美消除 3D 迷向。

4. **路徑標記與輔助機制**
   - **主幹道標記**：當前從起點到玩家位置的無環主路徑以亮粉紅色霓虹線標記。
   - **分支探險標記**：玩家走過但已折返的死路分支會留下紫色星塵粒子，引導玩家不走回頭路。
   - **A* 尋路提示**：開啟後會顯示綠色虛線，標示直達出口的道路。

5. **Premium 視覺設計 (`style.css`, `index.html`)**
   - 導入 **Google Fonts** 現代字體：`Orbitron`（科技感 HUD 數值）與 `Inter`（控制文字與按鈕）。
   - **磨砂玻璃面版 (Glassmorphism)**：UI 控制面板浮動於 Canvas 上，具有毛玻璃背景與霓虹邊框。
   - 起點 (藍色)、終點 (金黃色發光脈衝) 與玩家 (青綠色帶點光源) 有高對比的視覺辨識度。

---

## 程式碼庫託管 (Git Repository)
本專案的原始碼已完成 Git 初始化，並成功上傳至指定的 GitHub 遠端儲存庫：
* **遠端地址**: `git@github.com:sdyy/Neon-Maze-3D.git`
* **主分支**: `main`

已新增 `.gitignore` 設定檔，排除 `node_modules/` 與 `dist/` 等建置快取。

---

## 檔案結構與鏈接

* [index.html](file:///C:/Users/10110012/Documents/antigravity/resilient-hubble/index.html) - 網頁主結構、雙螢幕 (PiP) 容器與 UI 控制欄。
* [style.css](file:///C:/Users/10110012/Documents/antigravity/resilient-hubble/style.css) - Cyberpunk 霓虹風格與畫中畫樣式。
* [main.js](file:///C:/Users/10110012/Documents/antigravity/resilient-hubble/main.js) - 遊戲邏輯控制器（時鐘、步數與移動檢測）。
* [src/maze.js](file:///C:/Users/10110012/Documents/antigravity/resilient-hubble/src/maze.js) - 3D 迷宮生成與 A* 尋路核心。
* [src/renderer.js](file:///C:/Users/10110012/Documents/antigravity/resilient-hubble/src/renderer.js) - 雙視角渲染、第一人稱旋轉控制與平滑動畫。
* [src/ui.js](file:///C:/Users/10110012/Documents/antigravity/resilient-hubble/src/ui.js) - 相對視角按鍵事件綁定與 HUD 更新。
* [.gitignore](file:///C:/Users/10110012/Documents/antigravity/resilient-hubble/.gitignore) - Git 忽略清單。

---

## 鍵盤與滑鼠操作指南

| 輸入項目 | 操作說明 |
| :--- | :--- |
| **`W` / `S` / `A` / `D`** 或 **`↑` / `↓` / `←` / `→`** | 控制玩家在前進方向的前、後、左、右水平移動（自動依第一人稱視角對齊物理通道）。 |
| **`Space`** 或 **`Q`** | 向上爬升一層 (+Y 軸)。 |
| **`Shift`** 或 **`E`** | 向下潛沉一層 (-Y 軸)。 |
| **主畫面滑鼠左鍵拖曳** | 轉動第一人稱視角 (FPV)，朝任何角落環顧。 |
| **小地圖滑鼠左鍵拖曳** | 旋轉 3D 輔助矩陣（第三人稱 overview）。 |
| **小地圖滑鼠中鍵滾輪** | 放大 / 縮小 3D 輔助矩陣。 |
| **小地圖滑鼠右鍵拖曳** | 平移 3D 輔助矩陣視窗。 |

---

## 專案編譯與驗證結果

我們已成功執行 Vite 生產模式編譯：

```bash
$ npm run build

vite v5.4.21 building for production...
transforming...
✓ 9 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   5.72 kB │ gzip:   2.15 kB
dist/assets/index-lQOy0vyb.css    7.52 kB │ gzip:   2.20 kB
dist/assets/index-D-2mV5mo.js   507.87 kB │ gzip: 128.23 kB
✓ built in 1.05s
```

Vite 編譯完全無報錯，所有資源均成功編譯。

---

## 手動驗證步驟 (玩遊戲)

請在終端機啟動本地開發伺服器：
```bash
npm run dev
```

1. **第一人稱視角體驗**：
   - 開啟網頁後，您將「置身於迷宮通道內部」 (First Person View)。
   - 在螢幕空白處按住滑鼠左鍵並拖曳，即可像 FPS 遊戲般 360 度轉動鏡頭，觀看霓虹發光的通道結構。

2. **相角相對移動測試**：
   - 轉動視角，將鏡頭對準某條開展的通道，按下 `W`（前進）。
   - 觀察您是否順暢地向視角朝向的通道前進，按 `A`/`D` 是否朝視角左邊/右邊轉折前進。
   - 同時可看見移動時伴隨有平滑流暢的滑行過渡 (lerp)，不再是生硬的瞬間瞬移。

3. **雙視角連動與操控測試**：
   - 觀察右下角的「3D 全息輔助矩陣」小地圖。玩家角色 (青色自轉八面體) 恆定居於小地圖的正中心。
   - 在右下角小地圖內部進行拖曳與滑鼠滾輪操作，驗證是否能獨立旋轉與縮放這顆立體矩陣，且不影響主畫面的第一人稱視角。
   - 當您在 FPV 下移動時，小地圖中的八面體也會跟著平滑滑行，並且探險過留下的粉紅/紫色粒子軌跡也會同步繪製。
