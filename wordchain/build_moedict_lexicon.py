#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
字戀 (WordChain) - 臺灣萌典與小麥注音 (McBopomofo) 權威詞庫建構管線
來源：
  1. g0v moedict-data (教育部重編國語辭典修訂本)
  2. McBopomofo (小麥注音開源語料 - 臺灣現代標準多音字正音與語境詞頻)
目標：
  徹底杜絕「奇怪破音字接詞」（如台接移、吃接極、六接路、凸接碟等），
  以 McBopomofo 現代權威注音為第一基準，修剪無詞彙支撐之字典罕見死音，
  並建立詞彙語境讀音覆蓋表 (WORD_OVERRIDES)，實現 100% 自然的漢字聲韻對弈。
"""

import json
import lzma
import os
import re
import shutil
import sys
import urllib.request
from collections import defaultdict
import pypinyin

sys.stdout.reconfigure(encoding='utf-8')

MOEDICT_XZ_URL = "https://raw.githubusercontent.com/g0v/moedict-data/main/dict-revised.json.xz"
DICT_CAT_URL = "https://raw.githubusercontent.com/g0v/moedict-data/main/dict-cat.json"
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MCB_DATA_DIR = os.path.abspath(os.path.join(BASE_DIR, "../../RuhOS/ruhi/_external/McBopomofo/Source/Data"))

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

TONE_MARKS = {
    'a': ['ā', 'á', 'ǎ', 'à', 'a'], 'e': ['ē', 'é', 'ě', 'è', 'e'],
    'o': ['ō', 'ó', 'ǒ', 'ò', 'o'], 'i': ['ī', 'í', 'ǐ', 'ì', 'i'],
    'u': ['ū', 'ú', 'ǔ', 'ù', 'u'], 'v': ['ǖ', 'ǘ', 'ǚ', 'ǜ', 'ü'],
}

def num_to_tone(py_num: str, bpm: str = '') -> str:
    """將數字調號拼音 (如 tai2, zhe5) 轉換為標記聲調 (如 tái, zhe)"""
    if not py_num:
        return ''
    py_num = py_num.strip().lower().replace('u:', 'v')
    if '˙' in bpm or py_num.endswith('5') or py_num.endswith('0'):
        py = py_num.rstrip('012345')
        return py.replace('v', 'ü')
    tone = 1
    if py_num[-1].isdigit():
        tone = int(py_num[-1])
        py = py_num[:-1]
    else:
        py = py_num
    if tone == 5 or tone < 1 or tone > 4:
        return py.replace('v', 'ü')
    idx = tone - 1
    for main_v in ['a', 'e']:
        if main_v in py:
            return py.replace(main_v, TONE_MARKS[main_v][idx]).replace('v', 'ü')
    if 'ou' in py:
        return py.replace('o', TONE_MARKS['o'][idx]).replace('v', 'ü')
    vowels = [i for i, c in enumerate(py) if c in 'aiouev']
    if vowels:
        last_i = vowels[-1]
        c = py[last_i]
        return (py[:last_i] + TONE_MARKS[c][idx] + py[last_i+1:]).replace('v', 'ü')
    return py.replace('v', 'ü')

def load_mcbopomofo():
    """載入 McBopomofo 開源權威辭典語料"""
    print(f">>> 正在載入 McBopomofo (小麥注音) 權威語料: {MCB_DATA_DIR}")
    if not os.path.isdir(MCB_DATA_DIR):
        print(f"    ⚠️ 警告：找不到 McBopomofo 資料夾 {MCB_DATA_DIR}")
        return {}, {}, {}, {}, {}, {}

    # 1. 多音字權威主音與次主音
    het1, het2, het3 = {}, {}, {}
    for hname, hdict in [('heterophony1.list', het1), ('heterophony2.list', het2), ('heterophony3.list', het3)]:
        hpath = os.path.join(MCB_DATA_DIR, hname)
        if os.path.exists(hpath):
            with open(hpath, 'r', encoding='utf-8') as f:
                for line in f:
                    p = line.strip().split()
                    if len(p) >= 2:
                        hdict[p[0]] = p[1]

    # 2. 單字標準庫 (BPMFBase.txt)
    base_chars = defaultdict(list)
    char_bpm_to_py = {}
    base_path = os.path.join(MCB_DATA_DIR, 'BPMFBase.txt')
    if os.path.exists(base_path):
        with open(base_path, 'r', encoding='utf-8') as f:
            for line in f:
                p = line.strip().split()
                if len(p) >= 3:
                    c, bpm, py_raw = p[0], p[1], p[2]
                    py_tone = num_to_tone(py_raw, bpm)
                    base_chars[c].append((bpm, py_tone))
                    if (c, bpm) not in char_bpm_to_py:
                        char_bpm_to_py[(c, bpm)] = py_tone

    # 3. 語境詞彙精確注音庫 (BPMFMappings.txt)
    word_bpms = {}
    char_in_words = defaultdict(lambda: defaultdict(int))
    mappings_path = os.path.join(MCB_DATA_DIR, 'BPMFMappings.txt')
    if os.path.exists(mappings_path):
        with open(mappings_path, 'r', encoding='utf-8') as f:
            for line in f:
                p = line.strip().split()
                if len(p) >= 3 and len(p[0]) == len(p[1:]):
                    w = p[0]
                    bpms = p[1:]
                    if w not in word_bpms:
                        word_bpms[w] = bpms
                    for c, bpm in zip(w, bpms):
                        char_in_words[c][bpm] += 1

    print(f"    McBopomofo 主音標記: {len(het1)} 字，單字庫: {len(base_chars)} 字，多字詞精確音讀: {len(word_bpms)} 詞")
    return het1, het2, het3, base_chars, char_bpm_to_py, word_bpms, char_in_words

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

def process_lexicon(data, cat_chengyu, mcb_tuple):
    het1, het2, het3, base_chars, char_bpm_to_py, word_bpms, char_in_words = mcb_tuple
    print("\n>>> 正在進行辭條語意清洗、成語評級、McBopomofo 聲韻校正與語境讀音提取...")

    words_by_head = {}
    all_words = set()
    char_zhuyin = {}
    story_cache = {}
    word_overrides = {}
    word_actual_bpms = {}

    # 1. 收集萌典單字原始音讀備用
    moe_char_readings = defaultdict(list)
    for item in data:
        title = item.get('title', '').strip()
        if len(title) == 1 and re.match(r'^[\u4e00-\u9fff]$', title):
            hets = item.get('heteronyms', [])
            sorted_hets = sorted(hets, key=lambda h: len(h.get('definitions', [])), reverse=True)
            for h in sorted_hets:
                bp = h.get('bopomofo', '').strip()
                py = h.get('pinyin', '').strip()
                if bp:
                    first_bp = bp.split('／')[0].split(',')[0].strip()
                    first_py = py.split('／')[0].split(',')[0].strip() if py else ''
                    if [first_bp, first_py] not in moe_char_readings[title]:
                        moe_char_readings[title].append([first_bp, first_py])

    # 2. 建立單字權威音讀庫 (char_zhuyin)
    all_known_chars = set(base_chars.keys()) | set(moe_char_readings.keys())
    for c in all_known_chars:
        # 決定第一首選主音 (Primary Reading)
        if c in het1:
            prim_bpm = het1[c]
        elif c in base_chars and base_chars[c]:
            prim_bpm = base_chars[c][0][0]
        elif c in moe_char_readings and moe_char_readings[c]:
            prim_bpm = moe_char_readings[c][0][0]
        else:
            try:
                prim_bpm = pypinyin.pinyin(c, style=pypinyin.BOPOMOFO)[0][0]
            except Exception:
                prim_bpm = '—'

        # 決定主音拼音
        prim_py = char_bpm_to_py.get((c, prim_bpm), '')
        if not prim_py:
            for bp, py in moe_char_readings.get(c, []):
                if bp == prim_bpm and py:
                    prim_py = py
                    break
        if not prim_py:
            try:
                prim_py = pypinyin.pinyin(c, style=pypinyin.TONE)[0][0]
            except Exception:
                prim_py = ''

        # 收集有效讀音：嚴格修剪死古音，只保留在真實詞彙中出現或在權威破音字表中的讀音
        readings = [[prim_bpm, prim_py]]
        seen_bpms = {prim_bpm}

        candidate_readings = []
        for bpm, py in base_chars.get(c, []):
            if bpm not in seen_bpms:
                candidate_readings.append((bpm, py))
        for bpm, py in moe_char_readings.get(c, []):
            if bpm not in seen_bpms:
                candidate_readings.append((bpm, py))

        # 依詞彙出現頻率降冪排序
        candidate_readings.sort(key=lambda x: char_in_words[c].get(x[0], 0), reverse=True)

        for bpm, py in candidate_readings:
            if bpm in seen_bpms:
                continue
            occ = char_in_words[c].get(bpm, 0)
            is_curated_poly = (bpm == het2.get(c) or bpm == het3.get(c))
            # 核心修剪規則：凡是在詞彙中出現 > 0 次或名列次主音者方可入列
            if occ > 0 or is_curated_poly:
                readings.append([bpm, py])
                seen_bpms.add(bpm)

        char_zhuyin[c] = [prim_bpm, prim_py, readings]

    print(f"    權威單字聲韻庫建構完成: {len(char_zhuyin):,} 字")

    # 3. 遍歷萌典詞彙
    for item in data:
        title = item.get('title', '').strip()
        if not title or '{' in title or '}' in title:
            continue
        
        hets = item.get('heteronyms', [])
        if not hets:
            continue
            
        bp_str = hets[0].get('bopomofo', '').strip()
        py_str = hets[0].get('pinyin', '').strip()

        # 詞長限制 2 至 12 字
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

        # 收集成語典故故事卡
        defs = hets[0].get('definitions', [])
        def_text = ' '.join(d.get('def', '').strip() for d in defs)
        quotes = [q.strip() for d in defs if d.get('quote') for q in d.get('quote')]

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

        if is_true_idiom:
            story_def = defs[0].get('def', '').strip() if defs else ''
            story_quote = quotes[0] if quotes else ''
            origin = '古典文獻經籍'
            if '（諺語）' in story_def: origin = '民間諺語'
            elif '（俗語）' in story_def: origin = '民間俗語'
            elif '（歇後語）' in story_def: origin = '民間歇後語'
            elif story_quote and ('《' in story_quote):
                m = re.search(r'《([^》]+)》', story_quote)
                if m: origin = f"《{m.group(1)}》"
            elif '語本' in story_def:
                m = re.search(r'語本《([^》]+)》', story_def)
                if m: origin = f"《{m.group(1)}》"
            elif '語出' in story_def:
                m = re.search(r'語出《([^》]+)》', story_def)
                if m: origin = f"《{m.group(1)}》"
            elif '典出' in story_def:
                m = re.search(r'典出《([^》]+)》', story_def)
                if m: origin = f"《{m.group(1)}》"

            clean_def = re.sub(r'參見「[^」]+」條。?', '', story_def).strip()
            clean_quote = story_quote.strip()

            story_cache[clean_title] = {
                'pinyin': py_str,
                'origin': origin,
                'story': clean_def[:140] if clean_def else '千古名篇，蘊含深厚文思哲理與古典風骨。',
                'usage': clean_quote[:90] if clean_quote else ''
            }

        # 確定詞彙注音（優先使用 McBopomofo 語境注音）
        bps = bp_str.split()
        if clean_title in word_bpms:
            w_bpms = word_bpms[clean_title]
        elif len(bps) == len(clean_title):
            w_bpms = bps
        else:
            w_bpms = [char_zhuyin.get(c, ['—', ''])[0] for c in clean_title]

        word_actual_bpms[clean_title] = w_bpms

        head = clean_title[0]
        all_words.add(clean_title)
        if head not in words_by_head:
            words_by_head[head] = []
        if clean_title not in words_by_head[head]:
            words_by_head[head].append(clean_title)

    # 4. 載入古典名詩名句庫
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
                if pw in word_bpms:
                    word_actual_bpms[pw] = word_bpms[pw]
                else:
                    word_actual_bpms[pw] = [char_zhuyin.get(c, ['—', ''])[0] for c in pw]

                if p_head not in words_by_head:
                    words_by_head[p_head] = []
                if pw not in words_by_head[p_head]:
                    words_by_head[p_head].append(pw)
            print(f"    古典名詩名句庫已成功載入: {len(poetry_corpus)} 條")
        except Exception as e:
            print(f"    ⚠️ 載入 classical_poetry.json 失敗: {e}")

    # 5. 載入民間熟語與擴充詞庫
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
                        'usage': item.get('usage', f"「{sw}」")
                    }
                all_words.add(sw)
                if sw in word_bpms:
                    word_actual_bpms[sw] = word_bpms[sw]
                else:
                    word_actual_bpms[sw] = [char_zhuyin.get(c, ['—', ''])[0] for c in sw]

                if s_head not in words_by_head:
                    words_by_head[s_head] = []
                if sw not in words_by_head[s_head]:
                    words_by_head[s_head].append(sw)
            print(f"    補充民間熟語與擴充詞庫已成功載入: {len(supp_corpus)} 條")
        except Exception as e:
            print(f"    ⚠️ 載入 supplementary_lexicon.json 失敗: {e}")

    # 6. 計算詞彙語境讀音覆蓋表 (word_overrides)
    print("\n>>> 正在萃取詞彙首尾多音字語境校正表 (WORD_OVERRIDES)...")
    for w in all_words:
        w_bpms = word_actual_bpms.get(w, [])
        if len(w_bpms) != len(w):
            continue
        h_char, t_char = w[0], w[-1]
        h_actual, t_actual = w_bpms[0], w_bpms[-1]
        h_def = char_zhuyin.get(h_char, ['—'])[0]
        t_def = char_zhuyin.get(t_char, ['—'])[0]

        override = {}
        if h_actual != h_def:
            override['h'] = h_actual
        if t_actual != t_def:
            override['t'] = t_actual
        if override:
            word_overrides[w] = override

    print(f"    共辨識出 {len(word_overrides):,} 條詞彙存在首/尾字特殊語境音讀（如「便宜」首字ㄆㄧㄢˊ、「口吃」尾字ㄐㄧˊ）")

    # 7. 圖論計算：尾字出度 (Outdegree Graph) 與戰略評分
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

        entries.sort(key=lambda x: (x[3], x[2]), reverse=True)
        scored_lexicon[head] = {
            'py': head_py,
            'w': entries
        }

    return scored_lexicon, story_cache, char_zhuyin, word_overrides

def save_outputs(scored_lexicon, story_cache, char_zhuyin, word_overrides):
    print("\n>>> 正在寫出臺灣正體聲韻詞庫檔案...")
    
    # 1. word_overrides.json
    overrides_json_path = os.path.join(BASE_DIR, "word_overrides.json")
    with open(overrides_json_path, "w", encoding="utf-8") as f:
        json.dump(word_overrides, f, ensure_ascii=False, separators=(',', ':'))
    print(f"    [OK] {overrides_json_path} ({os.path.getsize(overrides_json_path)/1024:.1f} KB)")

    # 2. lexicon_scored.json & lexicon_data.js (合併輸出 window.WORD_OVERRIDES)
    lex_json_path = os.path.join(BASE_DIR, "lexicon_scored.json")
    lex_js_path = os.path.join(BASE_DIR, "lexicon_data.js")
    
    with open(lex_json_path, "w", encoding="utf-8") as f:
        json.dump(scored_lexicon, f, ensure_ascii=False, separators=(',', ':'))
        
    with open(lex_js_path, "w", encoding="utf-8") as f:
        f.write("window.WORD_OVERRIDES = ")
        json.dump(word_overrides, f, ensure_ascii=False, separators=(',', ':'))
        f.write(";\nwindow.LEXICON_SCORED = ")
        json.dump(scored_lexicon, f, ensure_ascii=False, separators=(',', ':'))
        f.write(";\n")
        
    print(f"    [OK] {lex_js_path} ({os.path.getsize(lex_js_path)/1024/1024:.2f} MB)")

    # 3. story_data.js
    story_js_path = os.path.join(BASE_DIR, "story_data.js")
    with open(story_js_path, "w", encoding="utf-8") as f:
        f.write("window.STORY_CACHE = ")
        json.dump(story_cache, f, ensure_ascii=False, separators=(',', ':'))
        f.write(";\n")
    print(f"    [OK] {story_js_path} ({os.path.getsize(story_js_path)/1024/1024:.2f} MB)")

    # 4. zhuyin_map.json & zhuyin_data.js
    zh_json_path = os.path.join(BASE_DIR, "zhuyin_map.json")
    zh_js_path = os.path.join(BASE_DIR, "zhuyin_data.js")
    with open(zh_json_path, "w", encoding="utf-8") as f:
        json.dump(char_zhuyin, f, ensure_ascii=False, separators=(',', ':'))
    with open(zh_js_path, "w", encoding="utf-8") as f:
        f.write("window.ZHUYIN_MAP = ")
        json.dump(char_zhuyin, f, ensure_ascii=False, separators=(',', ':'))
        f.write(";\n")
    print(f"    [OK] {zh_js_path} ({os.path.getsize(zh_js_path)/1024:.1f} KB)")

    # 5. 同步至 LingxiChain/data (保持全域 ATG 專案詞庫同步)
    lingxi_data_dir = os.path.abspath(os.path.join(BASE_DIR, "../../LingxiChain/data"))
    if os.path.exists(lingxi_data_dir):
        print(f"\n>>> 正在同步更新 LingxiChain/data...")
        shutil.copy(lex_json_path, os.path.join(lingxi_data_dir, "lexicon_scored.json"))
        shutil.copy(zh_json_path, os.path.join(lingxi_data_dir, "zhuyin_map.json"))
        shutil.copy(overrides_json_path, os.path.join(lingxi_data_dir, "word_overrides.json"))
        with open(os.path.join(lingxi_data_dir, "story_cache.json"), "w", encoding="utf-8") as f:
            json.dump(story_cache, f, ensure_ascii=False, indent=2)
        print(f"    [OK] LingxiChain/data 詞庫、典故與音讀校正表已同步完成！")

def main():
    mcb_tuple = load_mcbopomofo()
    moe_data, cat_chengyu = download_and_load_moedict()
    scored_lexicon, story_cache, char_zhuyin, word_overrides = process_lexicon(moe_data, cat_chengyu, mcb_tuple)
    save_outputs(scored_lexicon, story_cache, char_zhuyin, word_overrides)
    print("\n🎉 臺灣萌典與 McBopomofo 權威詞庫建構大功告成！")

if __name__ == "__main__":
    main()
