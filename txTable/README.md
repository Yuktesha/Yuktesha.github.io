# txTable — 純文字框線表格智慧轉換與微調工作台

`txTable` 是一個專門將早期 PE2、BBS、終端機 Unicode/ASCII 框線表格，智慧轉換為現代語意化表格並支援多格式輸出的 Web 工具。

---

## 🌟 核心特色

1. **機警容錯解析（Smart Pipe & Grid Clustering）**：
   - 解決複製貼上文字時，因 **Emoji（🟢🟡🔴）**、全形/半形括號及東亞字寬造成的表格破版錯位。
   - 自動錨定橫向分割線（`┌─┬┐`、`├─┼┤`、`└─┴┘`）之交會點，彈性容許 $\pm 2$ 字元浮動，確保儲存格內容絕不串欄。
   - 自動合併同區塊內未被橫線隔開的多行文字（以 `<br>` 自然接續）。

2. **智慧條列文字轉清單（Listify for LibreOffice & Web）**：
   - 自動辨識儲存格內的條列式文字（如 `1. 構式`、`10. 程度補語`、`- 項目`、`• 項目`）。
   - **支援跨儲存格連續序號**：自動計算起點並賦予 `<ol start="5">`，避免每一格都從 1 重新起算的尷尬。
   - **LibreOffice 原生清單相容**：匯出為文件時，LibreOffice Writer 會自動將其直接轉為**原生清單物件（Numbering/Bullet List）**，可直接按 Enter 換行自動編號、按 Tab 縮排，免去在 Writer 中逐一手動重設清單的困擾。
   - 提供「智慧清單：已開啟/已關閉」快速切換開關，隨選即用。

3. **可編輯視覺預覽（WYSIWYG Inline Editing）**：
   - 轉換後即時呈現視覺化表格，所有儲存格均支援點擊直接編輯（`contenteditable`）。
   - 提供「新增列」、「新增欄」、「刪除末列」、「刪除末欄」等微調控制鈕。

4. **全方位多格式匯出**：
   - 📄 **HTML 表格**：產生乾淨、內聯樣式的 `<table>` 原始碼，一鍵複製。
   - 📝 **Markdown**：產生標準 GFM (GitHub Flavored Markdown) 格式，相容各大筆記軟體與文件。
   - 📊 **TSV / 試算表**：可直接貼入 Microsoft Excel、Google Sheets。
   - 📑 **ODT / 文件相容**：下載相容 LibreOffice Writer / Microsoft Word 開啟之文件檔（含原生連續清單）。
   - 🖼️ **另存高畫質 PNG 圖檔**：利用 HTML5 Canvas 繪製向量級 2x Retina 清晰圖檔，支援深色/淺色主題自適應，滿足「只需要一張簡單乾淨圖檔」的使用者需求。

5. **零外部依賴、完全離線可用**：
   - 單一 `index.html` 檔案，純前端 HTML5 + CSS + JavaScript，免裝 Node.js 或後端伺服器。
   - 嚴格遵守 `rud()` 詞塊流式排版定律，自適應各種螢幕寬度。

---

## 🚀 本地使用方式

直接在檔案總管中雙擊 `index.html`，即可在任何瀏覽器（Chrome、Edge、Firefox 等）中開啟使用。

---

## 🌐 GitHub Pages 發行指引

若確認無誤後欲發行到 GitHub Pages：

1. **初始化 Git 儲存庫並提交**：
   ```bash
   cd C:\ATGprjs\WebUTs\txTable
   git init
   git add .
   git commit -m "feat: initial commit of txTable"
   ```

2. **推送至 GitHub 專案**：
   ```bash
   git branch -M main
   git remote add origin https://github.com/<您的使用者名稱>/txTable.git
   git push -u origin main
   ```

3. **啟用 GitHub Pages**：
   - 進入 GitHub 專案的 **Settings** ➔ **Pages**。
   - 在 **Build and deployment** 下方的 **Branch** 選擇 `main` / `root`。
   - 點擊 **Save**，約數十秒後即可透過 `https://<您的使用者名稱>.github.io/txTable/` 在線使用！
