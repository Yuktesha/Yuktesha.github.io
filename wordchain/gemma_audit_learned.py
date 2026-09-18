#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
字戀 (WordChain) - 玩家親授詞海手冊 Gemma 智慧評估與自動建庫引擎
"""

import argparse
import json
import os
import re
import subprocess
import sys
import urllib.request

sys.stdout.reconfigure(encoding='utf-8')
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

GEMMA_AUDIT_PROMPT = """你是一位深諳中華古典詩詞、文史典籍與民間熟語的「教育部國語文學院士審查委員」。
請審查玩家在成語接龍遊戲《字戀》中打出的非標詞彙或典雅長句。
請判定該詞彙是否合格入庫，並給予分類、釋義、來源出處：

【分類標籤 (category)】：
- "poetry": 古典詩詞名篇名句（如「空山不見人」、「長風破浪會有時」）
- "saying": 民間諺語、俗語、歇後語、棋藝或行話熟語（如「起手無回」、「泥菩薩過江」）
- "idiom": 具有文本文采或定型結構之常用詞（如「白白犧牲」）
- "reject": 錯別字、無意義碎片、粗鄙詞彙或純胡謅詞

請嚴格僅輸出標準 JSON 陣列，格式如下：
[
  {
    "word": "空山不見人",
    "verdict": "APPROVE",
    "category": "poetry",
    "author": "王維",
    "source": "《鹿柴》",
    "def": "空曠幽靜的山林中看不見人的蹤影。唐代王維名篇：「空山不見人，但聞人語響。」"
  },
  {
    "word": "起手無回",
    "verdict": "APPROVE",
    "category": "saying",
    "origin": "傳統象棋棋諺",
    "def": "傳統棋藝諺語：「起手無回大丈夫，落子無悔大丈夫」。形容下棋落子不悔，比喻行事果決決斷、絕不反悔。"
  }
]
"""

def load_moedict_lexicon():
    lex_path = os.path.join(BASE_DIR, 'lexicon_scored.json')
    if os.path.exists(lex_path):
        with open(lex_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}

def check_word_in_moedict(word, lexicon):
    if not word or not lexicon:
        return False
    head = word[0]
    entries = lexicon.get(head, {}).get('w', [])
    return any(e[0] == word for e in entries)

def call_ollama(prompt, model='gemma2:9b', host='http://127.0.0.1:11434'):
    url = f"{host}/api/generate"
    payload = {
        "model": model,
        "system": GEMMA_AUDIT_PROMPT,
        "prompt": prompt,
        "stream": False,
        "options": {"temperature": 0.2}
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        result = json.loads(resp.read().decode('utf-8'))
        return result.get('response', '')

def parse_json_response(raw_text):
    text = raw_text.strip()
    match = re.search(r'```(?:json)?\s*(\[.*?\])\s*```', text, re.DOTALL)
    if match:
        text = match.group(1)
    else:
        match_bracket = re.search(r'(\[.*?\])', text, re.DOTALL)
        if match_bracket:
            text = match_bracket.group(1)
    try:
        return json.loads(text)
    except Exception as e:
        print(f'    ⚠️ JSON 解析警告: {e}')
        return []

def apply_approved_words(verdicts):
    poetry_file = os.path.join(BASE_DIR, 'classical_poetry.json')
    supp_file = os.path.join(BASE_DIR, 'supplementary_lexicon.json')

    poetry_data = []
    if os.path.exists(poetry_file):
        with open(poetry_file, 'r', encoding='utf-8') as f:
            poetry_data = json.load(f)
    poetry_words = {p['word'] for p in poetry_data}

    supp_data = []
    if os.path.exists(supp_file):
        with open(supp_file, 'r', encoding='utf-8') as f:
            supp_data = json.load(f)
    supp_words = {s['word'] for s in supp_data}

    added_poetry = 0
    added_supp = 0

    for item in verdicts:
        w = item.get('word', '').strip()
        v = item.get('verdict', '').upper()
        cat = item.get('category', '').lower()
        if v != 'APPROVE' or not w:
            continue

        if cat == 'poetry':
            if w not in poetry_words:
                poetry_data.append({
                    'word': w,
                    'author': item.get('author', '歷代名家'),
                    'source': item.get('source', '古典名作'),
                    'def': item.get('def', '千古流傳之名篇佳句。')
                })
                poetry_words.add(w)
                added_poetry += 1
                print(f'    👑 已吸納入【千古名詩名句庫】: 【{w}】 ({item.get("author", "")} {item.get("source", "")})')
        else:
            if w not in supp_words:
                supp_data.append({
                    'word': w,
                    'origin': item.get('origin', '民間熟語'),
                    'def': item.get('def', '通俗定型化熟語。'),
                    'is_idiom': True
                })
                supp_words.add(w)
                added_supp += 1
                print(f'    📜 已吸納入【民間熟語與擴充詞庫】: 【{w}】 ({item.get("origin", "民間熟語")})')

    if added_poetry > 0:
        with open(poetry_file, 'w', encoding='utf-8') as f:
            json.dump(poetry_data, f, ensure_ascii=False, indent=2)
    if added_supp > 0:
        with open(supp_file, 'w', encoding='utf-8') as f:
            json.dump(supp_data, f, ensure_ascii=False, indent=2)

    if added_poetry > 0 or added_supp > 0:
        print('\n>>> 正在重新編譯全域詞庫拓撲神譜 (build_moedict_lexicon.py)...')
        cmd = [sys.executable, os.path.join(BASE_DIR, 'build_moedict_lexicon.py')]
        subprocess.run(cmd, check=True)
        print('🎉 詞庫與雙雄 AI 知識體系已更新完成！')
    else:
        print('    ℹ️ 沒有新詞需要寫入檔案。')

def main():
    parser = argparse.ArgumentParser(description='Gemma 詞海手冊審核與自動入庫引擎')
    parser.add_argument('--words', nargs='+', help='待審核詞彙清單')
    parser.add_argument('--file', help='待審核 JSON 檔案路徑')
    args = parser.parse_args()

    candidates = []
    if args.words:
        candidates.extend(args.words)
    if args.file and os.path.exists(args.file):
        with open(args.file, 'r', encoding='utf-8') as f:
            fdata = json.load(f)
            if isinstance(fdata, dict):
                candidates.extend(fdata.keys())
            elif isinstance(fdata, list):
                for item in fdata:
                    if isinstance(item, dict):
                        candidates.append(item.get('word', ''))
                    else:
                        candidates.append(str(item))

    # 若未指定參數，預設檢查典型手冊詞彙
    if not candidates:
        candidates = ['起風', '選舉', '大人', '鋼鐵', '王八蛋', '起手無回', '空山不見人', '白白犧牲', '瞬間', '山海經']

    print(f'>>> 開始審核候選詞彙: 共 {len(candidates)} 個...')
    lexicon = load_moedict_lexicon()

    in_moe = []
    need_gemma = []
    for w in candidates:
        if check_word_in_moedict(w, lexicon):
            in_moe.append(w)
        else:
            need_gemma.append(w)

    print(f'    🟢 萌典官方已收錄: {len(in_moe)} 個 -> {in_moe}')
    print(f'    ⚡ 需進一步審查/擴充: {len(need_gemma)} 個 -> {need_gemma}')

    if not need_gemma:
        print('🎉 所有詞彙均已在標準詞庫中，無需額外審查！')
        return

    # 本地備援語義庫 (確保即使未啟動 Ollama 也能立竿見影評估已知經典)
    KNOWN_DB = {
        '空山不見人': {
            'word': '空山不見人',
            'verdict': 'APPROVE',
            'category': 'poetry',
            'author': '王維',
            'source': '《鹿柴》',
            'def': '空曠幽靜的山林中看不見人的蹤影。唐代王維名篇：「空山不見人，但聞人語響。」'
        },
        '起手無回': {
            'word': '起手無回',
            'verdict': 'APPROVE',
            'category': 'saying',
            'origin': '傳統象棋棋諺',
            'def': '傳統棋藝諺語：「起手無回大丈夫，落子無悔大丈夫」。形容下棋落子不悔，比喻行事果決決斷、絕不反悔。'
        },
        '白白犧牲': {
            'word': '白白犧牲',
            'verdict': 'APPROVE',
            'category': 'idiom',
            'origin': '現代通俗熟語',
            'def': '徒然無益地付出生命、代價或心血，而未能達成預期目的或產生正面價值。'
        }
    }

    verdicts = []
    try:
        prompt = '請審查以下詞彙：\n' + '\n'.join(f'- {w}' for w in need_gemma)
        resp = call_ollama(prompt)
        verdicts = parse_json_response(resp)
    except Exception as e:
        print(f'    ℹ️ 本地 Ollama 未開啟或逾時 ({e})，啟用院士內置精華學術庫審定！')
        for w in need_gemma:
            if w in KNOWN_DB:
                verdicts.append(KNOWN_DB[w])

    print(f'>>> Gemma 審核完成，合格採納: {len(verdicts)} 個')
    apply_approved_words(verdicts)

if __name__ == '__main__':
    main()
