#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
字戀 (WordChain) - 臺灣萌典 (教育部重編國語辭典修訂本) 權威詞庫建構管線
來源：g0v moedict-data (https://github.com/g0v/moedict-data)
目標：徹底清除小粉紅/統戰/政治口號與殘缺碎片詞，100% 臺灣教育部正統國語辭典
"""

import json
import lzma
import os
import re
import shutil
import sys
import urllib.request
import pypinyin

sys.stdout.reconfigure(encoding='utf-8')

MOEDICT_XZ_URL = "https://raw.githubusercontent.com/g0v/moedict-data/main/dict-revised.json.xz"
DICT_CAT_URL = "https://raw.githubusercontent.com/g0v/moedict-data/main/dict-cat.json"
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

BLACKLIST_EXACT = {
    '中國最大', '國內統一', '中國人大', '全國人大', '人民代表', '一國兩制',
    '解放軍', '共產黨', '中共中央', '黨中央', '偉大領袖', '毛主席', '習主席',
    '五星紅旗', '統一大業', '祖國統一', '打前劉海'
}

NUMERAL_CHARS = set('一二三四五六七八九十零百千萬億兩')
NUM_EXCEPTIONS = {
    '一波三折', '一清二楚', '接二連三', '朝三暮四', '顛三倒四', '推三阻四', 
    '橫三豎四', '三番兩次', '七拼八湊', '十全十美', '五顏六色', '千方百計',
    '九死一生', '千變萬化', '千言萬語', '萬眾一心', '獨一無二', '一干二淨',
    '一心一意', '一石二鳥', '一目十行', '一五一十', '舉一反三', '七上八下',
    '三頭六臂', '四分五裂', '五湖四海', '六神無主', '八仙過海', '九霄雲外',
    '三言兩語', '百發百中', '百戰百勝', '千萬買鄰', '三長兩短', '七零八落',
    '文房四寶', '五光十色', '千鈞一髮', '萬紫千紅', '一諾千金', '五花八門',
    '風情萬種', '四面楚歌', '千夫所指', '萬象更新', '十面埋伏', '九牛一毛'
}

IDIOM_KEYWORDS = ('比喻', '形容', '語本', '典出', '義參', '後用以', '成語', '猶言', '意謂', '意指')

# 5字至12字長句純化過濾器（剔除純地名山川、群島、曲牌名，保留現代科技/專業百科詞目以供職業神算）
LONG_JUNK_DEF_PREFIXES = (
    '書名。', '山名。', '地名。', '國名。', '群島名。', '河名。', '植物名。', '動物名。', 
    '礦物名。', '市名。', '省名。', '縣名。', '島名。', '寺名。', '曲牌名。', '詞牌名。'
)

LONG_BAD_SUFFIXES = (
    '地下', '底下', '裡頭', '頭上', '身上', '嘴裡', '心裡', '眼裡', '手裡', 
    '的日子', '的人', '的東西', '的樣子'
)

GENUINE_SAYING_KEYWORDS = (
    '（諺語）', '（俗語）', '（歇後語）', '語本', '語出', '典出', '典本', '義參'
)

def download_and_load_moedict():
    cache_xz = os.path.join(BASE_DIR, "dict-revised.json.xz")
    if not os.path.exists(cache_xz):
        print(">>> 正在下載與解壓縮臺灣萌典 (g0v dict-revised.json.xz)...")
        req = urllib.request.Request(MOEDICT_XZ_URL, headers={'User-Agent': 'Mozilla/5.0 WordChain/2.0'})
        with urllib.request.urlopen(req) as resp:
            compressed = resp.read()
        with open(cache_xz, "wb") as f:
            f.write(compressed)
        print(f"    下載完成 (壓縮檔大小: {len(compressed)/1024/1024:.2f} MB)")
    else:
        print(f">>> 使用本地快取之萌典資料檔: {cache_xz}")
        with open(cache_xz, "rb") as f:
            compressed = f.read()

    print("    正在解壓縮萌典主辭典...")
    decompressed = lzma.decompress(compressed)
    data = json.loads(decompressed.decode('utf-8'))
    print(f"    教育部重編國語辭典修訂本收錄總辭條數: {len(data):,}")

    cache_cat = os.path.join(BASE_DIR, "dict-cat.json")
    if not os.path.exists(cache_cat):
        print(">>> 正在下載萌典分類標籤庫 dict-cat.json...")
        req = urllib.request.Request(DICT_CAT_URL, headers={'User-Agent': 'Mozilla/5.0 WordChain/2.0'})
        with urllib.request.urlopen(req) as resp:
            cat_bytes = resp.read()
        with open(cache_cat, "wb") as f:
            f.write(cat_bytes)
    else:
        with open(cache_cat, "rb") as f:
            cat_bytes = f.read()

    cat_data = json.loads(cat_bytes.decode('utf-8'))
    cat_chengyu = set()
    for c in cat_data:
        cid = c.get('id')
        entries = c.get('entries', [])
        if cid == 1000:
            cat_chengyu.update(entries)
        elif cid == 5712:
            BLACKLIST_EXACT.update(entries)

    # 自動讀取 Gemma 智慧審查之剔除名單 (rejected_words.json)
    rejected_file = os.path.join(BASE_DIR, "rejected_words.json")
    if os.path.exists(rejected_file):
        try:
            with open(rejected_file, "r", encoding="utf-8") as f:
                rejected_data = json.load(f)
                BLACKLIST_EXACT.update(rejected_data.keys())
                print(f"    Gemma 智慧審查剔除詞庫已載入: {len(rejected_data):,} 條")
        except Exception as e:
            print(f"    ⚠️ 載入 rejected_words.json 失敗: {e}")

    print(f"    教育部官方成語標籤收錄: {len(cat_chengyu):,} 條")
    print(f"    黑名單（含大陸用語/Gemma剔除詞）總量: {len(BLACKLIST_EXACT):,} 條")
    return data, cat_chengyu

def process_lexicon(data, cat_chengyu):
    print("\n>>> 正在進行辭條語意清洗、成語評級與正體音讀提取...")
    words_by_head = {}
    all_words = set()
    char_zhuyin = {}
    story_cache = {}

    # 1. 第一輪：收集單字標準音讀與破音字全讀音 (按釋義豐富度排序，以最常用音為首選)
    for item in data:
        title = item.get('title', '').strip()
        if len(title) == 1 and re.match(r'^[\u4e00-\u9fff]$', title):
            hets = item.get('heteronyms', [])
            if not hets:
                continue
            # 按釋義條數降序排序，確保常用音（如「於」之「ㄩˊ」有14條釋義，「ㄨ」僅2條）排在第一首選
            sorted_hets = sorted(hets, key=lambda h: len(h.get('definitions', [])), reverse=True)
            readings = []
            for h in sorted_hets:
                bp = h.get('bopomofo', '').strip()
                py = h.get('pinyin', '').strip()
                if bp:
                    first_bp = bp.split('／')[0].split(',')[0].strip()
                    first_py = py.split('／')[0].split(',')[0].strip() if py else ''
                    if [first_bp, first_py] not in readings:
                        readings.append([first_bp, first_py])
            if readings and title not in char_zhuyin:
                best_bp, best_py = readings[0]
                char_zhuyin[title] = [best_bp, best_py, readings]

    # 2. 第二輪：收集多字詞語音讀、典故與詞彙
    for item in data:
        title = item.get('title', '').strip()
        if not title or '{' in title or '}' in title:
            continue
        
        hets = item.get('heteronyms', [])
        if not hets:
            continue
            
        bp_str = hets[0].get('bopomofo', '').strip()
        py_str = hets[0].get('pinyin', '').strip()

        # 補充詞內單字音讀
        if len(title) >= 2 and re.match(r'^[\u4e00-\u9fff]+$', title):
            bps = bp_str.split()
            pys = py_str.split()
            if len(bps) == len(title):
                for i, c in enumerate(title):
                    c_bp = bps[i].strip()
                    c_py = pys[i].strip() if i < len(pys) else ''
                    if c not in char_zhuyin:
                        char_zhuyin[c] = [c_bp, c_py, [[c_bp, c_py]]]
                    elif len(char_zhuyin[c]) >= 3:
                        if [c_bp, c_py] not in char_zhuyin[c][2]:
                            char_zhuyin[c][2].append([c_bp, c_py])

        # 詞長限制放寬至 2 至 12 字 (包容完整諺語、歇後語、古典詩詞長句如「眾裡尋他千百度」)
        clean_title = re.sub(r'[\s\u3000。，！？、；：…—～~·「」『』《》〈〉（）()\[\]{}【】\'\"“”‘’]+', '', title)
        if len(clean_title) < 2 or len(clean_title) > 12:
            continue
        if not re.match(r'^[\u4e00-\u9fff]+$', clean_title):
            continue
        if clean_title in BLACKLIST_EXACT:
            continue

        # 排除純數字串與年份詞
        if all(c in NUMERAL_CHARS for c in clean_title):
            continue
        if len(clean_title) == 4 and sum(1 for c in clean_title if c in NUMERAL_CHARS) >= 3 and clean_title not in NUM_EXCEPTIONS:
            continue

        # 收集成語典故故事卡（優先提取具備古典文獻出處之成語、典雅長句以及教育部釋義）
        defs = hets[0].get('definitions', [])
        def_text = ' '.join(d.get('def', '').strip() for d in defs)
        quotes = [q.strip() for d in defs if d.get('quote') for q in d.get('quote')]

        # 對於 5 至 12 字長詞，進行純化與現代專業百科詞彙分流：
        # 排除口語方位與白話小說對話殘片（如「大毒日頭地下」），但包容正統諺語、俗語、歇後語、典故名句以及現代專業科技/醫學/法律/財經/工程百科術語（供職業神算統計）
        is_true_idiom = False
        if len(clean_title) >= 5:
            if any(clean_title.endswith(suf) for suf in LONG_BAD_SUFFIXES):
                continue
            if any(def_text.startswith(j) or f' {j}' in def_text for j in LONG_JUNK_DEF_PREFIXES):
                continue
            is_saying = any(st in def_text for st in GENUINE_SAYING_KEYWORDS) or ('比喻' in def_text or '形容' in def_text)
            is_domain = any(kw in def_text for kw in ['電路', '晶片', '計算機', '資訊', '軟體', '硬體', '演算法', '醫學', '病名', '藥名', '法律', '經濟', '金融', '工程', '技術', '科學', '化學', '物理', '名詞。', '用語。'])
            if not is_saying and not is_domain:
                continue
            if is_saying:
                is_true_idiom = True
        elif len(clean_title) == 4:
            if clean_title in cat_chengyu or any(kw in def_text for kw in IDIOM_KEYWORDS):
                is_true_idiom = True

        # 製作成語典故與長句故事卡
        if is_true_idiom:
            story_def = defs[0].get('def', '').strip() if defs else ''
            story_quote = quotes[0] if quotes else ''
            origin = '古典文獻經籍'
            if '（諺語）' in story_def:
                origin = '民間諺語'
            elif '（俗語）' in story_def:
                origin = '民間俗語'
            elif '（歇後語）' in story_def:
                origin = '民間歇後語'
            elif story_quote and ('《' in story_quote):
                m = re.search(r'《([^》]+)》', story_quote)
                if m:
                    origin = f"《{m.group(1)}》"
            elif '語本' in story_def:
                m = re.search(r'語本《([^》]+)》', story_def)
                if m:
                    origin = f"《{m.group(1)}》"
            elif '語出' in story_def:
                m = re.search(r'語出《([^》]+)》', story_def)
                if m:
                    origin = f"《{m.group(1)}》"
            elif '典出' in story_def:
                m = re.search(r'典出《([^》]+)》', story_def)
                if m:
                    origin = f"《{m.group(1)}》"

            clean_def = re.sub(r'參見「[^」]+」條。?', '', story_def).strip()
            clean_quote = story_quote.strip()

            story_cache[clean_title] = {
                'pinyin': py_str,
                'origin': origin,
                'story': clean_def[:140] if clean_def else '千古名篇，蘊含深厚文思哲理與古典風骨。',
                'usage': clean_quote[:90] if clean_quote else ''
            }

        head = clean_title[0]
        all_words.add(clean_title)
        if head not in words_by_head:
            words_by_head[head] = []
        if clean_title not in words_by_head[head]:
            words_by_head[head].append(clean_title)

    # 載入額外收錄之千古名詩名句庫 (如「眾裡尋他千百度」等)
    poetry_file = os.path.join(BASE_DIR, "classical_poetry.json")
    if os.path.exists(poetry_file):
        try:
            with open(poetry_file, "r", encoding="utf-8") as f:
                poetry_corpus = json.load(f)
            for p in poetry_corpus:
                pw = p["word"]
                p_head = pw[0]
                story_cache[pw] = {
                    'pinyin': '',
                    'origin': f"{p.get('author', '')} {p.get('source', '')}",
                    'story': p.get('def', '千古流傳之名句佳篇。'),
                    'usage': f"「{pw}」"
                }
                all_words.add(pw)
                if p_head not in words_by_head:
                    words_by_head[p_head] = []
                if pw not in words_by_head[p_head]:
                    words_by_head[p_head].append(pw)
            print(f"    古典名詩名句庫已成功載入: {len(poetry_corpus)} 條")
        except Exception as e:
            print(f"    ⚠️ 載入 classical_poetry.json 失敗: {e}")

    # 載入額外收錄之民間熟語與擴充詞庫 (如「起手無回」、「白白犧牲」等經審核詞彙)
    supp_file = os.path.join(BASE_DIR, "supplementary_lexicon.json")
    if os.path.exists(supp_file):
        try:
            with open(supp_file, "r", encoding="utf-8") as f:
                supp_corpus = json.load(f)
            for item in supp_corpus:
                sw = item["word"]
                s_head = sw[0]
                if item.get("is_idiom", True):
                    story_cache[sw] = {
                        'pinyin': item.get('pinyin', ''),
                        'origin': item.get('origin', '民間熟語'),
                        'story': item.get('def', '民間通俗定型化熟語或常用詞。'),
                        'usage': f"「{sw}」"
                    }
                all_words.add(sw)
                if s_head not in words_by_head:
                    words_by_head[s_head] = []
                if sw not in words_by_head[s_head]:
                    words_by_head[s_head].append(sw)
            print(f"    補充民間熟語與擴充詞庫已成功載入: {len(supp_corpus)} 條")
        except Exception as e:
            print(f"    ⚠️ 載入 supplementary_lexicon.json 失敗: {e}")

    print(f"    合格臺灣正體純漢字詞總量: {len(all_words):,}")
    print(f"    收錄【純正成語與詩詞長句】總量: {len(story_cache):,}")

    # 3. 補齊所有文字的注音覆蓋（pypinyin 保證 100% 覆蓋）
    all_chars_in_vocab = set()
    for w in all_words:
        for c in w:
            all_chars_in_vocab.add(c)

    missing_chars = all_chars_in_vocab - set(char_zhuyin.keys())
    print(f"    總漢字數: {len(all_chars_in_vocab):,}，萌典自帶: {len(char_zhuyin):,}，pypinyin 補齊: {len(missing_chars):,}")
    for c in missing_chars:
        try:
            bp_fallback = pypinyin.pinyin(c, style=pypinyin.BOPOMOFO)[0][0]
            py_fallback = pypinyin.pinyin(c, style=pypinyin.TONE)[0][0]
            char_zhuyin[c] = [bp_fallback, py_fallback, [[bp_fallback, py_fallback]]]
        except Exception:
            char_zhuyin[c] = ['—', '', [['—', '']]]

    # 4. 圖論計算：尾字出度 (Outdegree Graph) 與戰略評分
    print("\n>>> 正在建立圖論出度拓撲與博弈神譜權重...")
    char_outdegree = {ch: len(words) for ch, words in words_by_head.items()}

    scored_lexicon = {}
    for head, wlist in words_by_head.items():
        head_py = char_zhuyin.get(head, ['', ''])[1]
        entries = []
        for w in wlist:
            tail = w[-1]
            outdeg = char_outdegree.get(tail, 0)
            tag = '🟢汪洋'
            if outdeg == 0:
                tag = '💀絕殺'
            elif outdeg <= 3:
                tag = '⚠️險局'
            elif outdeg <= 15:
                tag = '⚔️激戰'

            # 戰略權重評分：
            # 1. 純正成語、千古名詩名句、完整諺語 (w in story_cache)：1000 (最高文采優先選拔)
            # 2. 常用二字標準詞：300
            # 3. 常用三字標準詞：250
            # 4. 四字普通名詞/非成語複合詞：150 (大幅降權，不與經典成語爭輝)
            # 5. 其他詞語：120
            if w in story_cache:
                weight = 1000
            elif len(w) == 4:
                weight = 150
            elif len(w) == 2:
                weight = 300
            elif len(w) == 3:
                weight = 250
            else:
                weight = 120

            entries.append([w, tail, outdeg, weight, tag])

        # 排序：權重高者優先，出度多者優先 (兼具文采與接龍生機)
        entries.sort(key=lambda x: (x[3], x[2]), reverse=True)
        scored_lexicon[head] = {
            'py': head_py,
            'w': entries
        }

    return scored_lexicon, story_cache, char_zhuyin

def save_outputs(scored_lexicon, story_cache, char_zhuyin):
    print("\n>>> 正在寫出臺灣萌典詞庫檔案...")
    
    # 1. lexicon_scored.json & lexicon_data.js
    lex_json_path = os.path.join(BASE_DIR, "lexicon_scored.json")
    lex_js_path = os.path.join(BASE_DIR, "lexicon_data.js")
    
    with open(lex_json_path, "w", encoding="utf-8") as f:
        json.dump(scored_lexicon, f, ensure_ascii=False, separators=(',', ':'))
        
    with open(lex_js_path, "w", encoding="utf-8") as f:
        f.write("window.LEXICON_SCORED = ")
        json.dump(scored_lexicon, f, ensure_ascii=False, separators=(',', ':'))
        f.write(";\n")
        
    print(f"    [OK] {lex_js_path} ({os.path.getsize(lex_js_path)/1024/1024:.2f} MB)")

    # 2. story_data.js
    story_js_path = os.path.join(BASE_DIR, "story_data.js")
    with open(story_js_path, "w", encoding="utf-8") as f:
        f.write("window.STORY_CACHE = ")
        json.dump(story_cache, f, ensure_ascii=False, separators=(',', ':'))
        f.write(";\n")
    print(f"    [OK] {story_js_path} ({os.path.getsize(story_js_path)/1024/1024:.2f} MB)")

    # 3. zhuyin_map.json & zhuyin_data.js
    zh_json_path = os.path.join(BASE_DIR, "zhuyin_map.json")
    zh_js_path = os.path.join(BASE_DIR, "zhuyin_data.js")
    with open(zh_json_path, "w", encoding="utf-8") as f:
        json.dump(char_zhuyin, f, ensure_ascii=False, separators=(',', ':'))
    with open(zh_js_path, "w", encoding="utf-8") as f:
        f.write("window.ZHUYIN_MAP = ")
        json.dump(char_zhuyin, f, ensure_ascii=False, separators=(',', ':'))
        f.write(";\n")
    print(f"    [OK] {zh_js_path} ({os.path.getsize(zh_js_path)/1024:.1f} KB)")

    # 4. 同步至 LingxiChain/data (保持全域 ATG 專案詞庫同步)
    lingxi_data_dir = os.path.abspath(os.path.join(BASE_DIR, "../../LingxiChain/data"))
    if os.path.exists(lingxi_data_dir):
        print(f"\n>>> 正在同步更新 LingxiChain/data...")
        shutil.copy(lex_json_path, os.path.join(lingxi_data_dir, "lexicon_scored.json"))
        shutil.copy(zh_json_path, os.path.join(lingxi_data_dir, "zhuyin_map.json"))
        with open(os.path.join(lingxi_data_dir, "story_cache.json"), "w", encoding="utf-8") as f:
            json.dump(story_cache, f, ensure_ascii=False, indent=2)
        print(f"    [OK] LingxiChain/data 詞庫與典故已同步完成！")

def main():
    moe_data, cat_chengyu = download_and_load_moedict()
    scored_lexicon, story_cache, char_zhuyin = process_lexicon(moe_data, cat_chengyu)
    save_outputs(scored_lexicon, story_cache, char_zhuyin)
    print("\n🎉 臺灣萌典權威詞庫建構大功告成！")

if __name__ == "__main__":
    main()
